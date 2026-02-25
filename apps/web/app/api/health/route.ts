import { NextResponse } from "next/server";
import { getDb } from "@taa/db";
import { sql } from "drizzle-orm";
import { createConnection } from "net";

async function checkRedis(): Promise<boolean> {
  return new Promise((resolve) => {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    const match = url.match(/redis:\/\/(?:[^@]+@)?([^:]+):(\d+)/);
    const host = match?.[1] ?? "localhost";
    const port = parseInt(match?.[2] ?? "6379", 10);

    const socket = createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 2000);

    socket.on("connect", () => {
      clearTimeout(timer);
      socket.write("PING\r\n");
    });

    socket.on("data", (d) => {
      clearTimeout(timer);
      socket.destroy();
      resolve(d.toString().includes("+PONG"));
    });

    socket.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function checkDb(): Promise<boolean> {
  try {
    await getDb().execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);

  const ok = db && redis;
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", checks: { db, redis } },
    { status: ok ? 200 : 503 }
  );
}
