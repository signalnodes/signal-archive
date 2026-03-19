/**
 * Import cookies into the running Chrome instance via CDP.
 *
 * Usage:
 *   1. Export x.com cookies from local Chrome using Cookie-Editor extension (JSON format)
 *   2. Copy cookies.json to VPS, then into the chrome container:
 *        docker cp cookies.json deploy-chrome-1:/tmp/cookies.json
 *   3. Run from inside the chrome container:
 *        docker exec deploy-chrome-1 npx tsx scripts/import-cookies.ts
 *
 * CDP_URL defaults to http://localhost:9222 (correct inside the container).
 */

import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const CDP_URL = process.env.CDP_URL ?? "http://localhost:9222";
const COOKIES_FILE = process.argv[2] ?? "/tmp/cookies.json";

interface CookieEditorCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expirationDate?: number;
}

async function main() {
  if (!fs.existsSync(COOKIES_FILE)) {
    console.error(`Cookie file not found: ${COOKIES_FILE}`);
    console.error("Copy it into the container first:");
    console.error("  docker cp cookies.json deploy-chrome-1:/tmp/cookies.json");
    process.exit(1);
  }

  const raw: CookieEditorCookie[] = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf-8"));
  console.log(`Loaded ${raw.length} cookies from ${COOKIES_FILE}`);

  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0] ?? await browser.newContext();

  const cookies = raw.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path ?? "/",
    secure: c.secure ?? false,
    httpOnly: c.httpOnly ?? false,
    sameSite: (["None", "Lax", "Strict"].includes(c.sameSite) ? c.sameSite : "None") as "None" | "Lax" | "Strict",
    expires: c.expirationDate ?? -1,
  }));

  await context.addCookies(cookies);
  console.log(`Imported ${cookies.length} cookies.`);

  // Verify login by navigating to x.com/home
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const url = page.url();
  console.log(`Landed on: ${url}`);

  if (url.includes("/home") || url.includes("/feed")) {
    console.log("✓ Login successful — session is active.");
  } else {
    console.log("✗ Not on home feed. Cookies may be stale or login failed.");
    console.log("  Current URL:", url);
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
