import { NextResponse } from "next/server";
import { getDb } from "@taa/db";
import { sql } from "drizzle-orm";
import { createConnection } from "net";
import { connect as tlsConnect } from "tls";

const WORKER_STALE_MS = 20 * 60 * 1000; // alert if worker hasn't checked in for 20 min
const FAILED_JOBS_THRESHOLD = 10;

// --- Minimal raw RESP client -------------------------------------------------
// Sends a pipeline of commands over a single TCP connection, returns responses.
// Understands simple strings (+), integers (:), bulk strings ($), errors (-).

function buildRespCommand(args: string[]): string {
  let cmd = `*${args.length}\r\n`;
  for (const arg of args) cmd += `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`;
  return cmd;
}

function parseRespResponses(buf: string): (string | null)[] {
  const results: (string | null)[] = [];
  let i = 0;

  while (i < buf.length) {
    const type = buf[i];
    const end = buf.indexOf("\r\n", i);
    if (end === -1) break;
    const line = buf.slice(i + 1, end);
    i = end + 2;

    if (type === "+" || type === "-" || type === ":") {
      results.push(line);
    } else if (type === "$") {
      const len = parseInt(line, 10);
      if (len === -1) {
        results.push(null);
      } else {
        results.push(buf.slice(i, i + len));
        i += len + 2; // skip data + \r\n
      }
    }
  }

  return results;
}

async function redisQuery(
  commands: string[][]
): Promise<(string | null)[]> {
  return new Promise((resolve) => {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    const isTls = url.startsWith("rediss://");
    const match = url.match(/rediss?:\/\/(?:[^@]+@)?([^:]+):(\d+)/);
    const host = match?.[1] ?? "localhost";
    const port = parseInt(match?.[2] ?? "6379", 10);

    const socket = isTls
      ? tlsConnect({ host, port, rejectUnauthorized: false })
      : createConnection({ host, port });
    let buffer = "";

    const timer = setTimeout(() => {
      socket.destroy();
      resolve(commands.map(() => null));
    }, 2000);

    const connectEvent = isTls ? "secureConnect" : "connect";
    socket.on(connectEvent, () => {
      const pipeline = commands.map(buildRespCommand).join("");
      socket.write(pipeline);
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const results = parseRespResponses(buffer);
      if (results.length >= commands.length) {
        clearTimeout(timer);
        socket.destroy();
        resolve(results.slice(0, commands.length));
      }
    });

    socket.on("error", () => {
      clearTimeout(timer);
      resolve(commands.map(() => null));
    });
  });
}

// --- Individual checks -------------------------------------------------------

async function checkDb(): Promise<boolean> {
  try {
    await getDb().execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

interface RedisChecks {
  ok: boolean;
  worker: { alive: boolean; lastSeenAgoMs: number | null };
  queues: { failed: number };
}

async function checkRedisAndWorker(): Promise<RedisChecks> {
  const results = await redisQuery([
    ["PING"],
    ["GET", "worker:last-seen"],
    ["ZCARD", "bull:deletion-check:failed"],
  ]);

  const pingOk = results[0] === "PONG";
  const lastSeenRaw = results[1];
  const failedCount = results[2] !== null ? parseInt(results[2], 10) : 0;

  let lastSeenAgoMs: number | null = null;
  let workerAlive = false;

  if (lastSeenRaw !== null) {
    lastSeenAgoMs = Date.now() - parseInt(lastSeenRaw, 10);
    workerAlive = lastSeenAgoMs < WORKER_STALE_MS;
  }

  return {
    ok: pingOk,
    worker: { alive: workerAlive, lastSeenAgoMs },
    queues: { failed: isNaN(failedCount) ? 0 : failedCount },
  };
}

// --- Route -------------------------------------------------------------------

export async function GET() {
  const [db, redisResult] = await Promise.all([
    checkDb(),
    checkRedisAndWorker(),
  ]);

  const { ok: redis, worker, queues } = redisResult;

  // Redis/worker checks are best-effort — Railway web can't reach VPS Redis.
  // DB health is the primary indicator; Redis degradation is informational only.
  const ok = db && (!redis || (worker.alive && queues.failed < FAILED_JOBS_THRESHOLD));

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      checks: {
        db,
        redis,
        worker,
        queues,
      },
    },
    { status: ok ? 200 : 503 }
  );
}
