/**
 * Shared Uline fetcher.
 *
 * Node's built-in `fetch` cannot resolve www.uline.com in this environment
 * (getaddrinfo ENOTFOUND) and the only working route is the local HTTP proxy
 * that is already exported as HTTPS_PROXY. That proxy is also intermittent —
 * a request can come back as a 502 or a dropped connection at any moment — so
 * every call retries with a linear backoff.
 *
 * Everything that talks to Uline should go through here rather than calling
 * `fetch` directly.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);

export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const PROXY =
  process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || "";

export const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Uline serves a stripped page to bots unless we look like a browser. */
function baseArgs(url) {
  const args = [
    "-s",
    "--compressed",
    "-L",
    "-A",
    UA,
    "-H",
    "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "-H",
    "Accept-Language: en-US,en;q=0.9",
  ];
  if (PROXY) args.push("-x", PROXY);
  args.push(url);
  return args;
}

/**
 * Fetch a URL as text, retrying until it returns something substantial.
 * `minBytes` guards against Uline's short "please retry" interstitials.
 */
export async function fetchText(url, { retries = 8, timeoutMs = 30000, minBytes = 500 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const args = [...baseArgs(url), "--max-time", String(Math.round(timeoutMs / 1000))];
      const { stdout } = await run("curl", args, { maxBuffer: 96 * 1024 * 1024 });
      if (stdout && Buffer.byteLength(stdout) >= minBytes) return stdout;
      lastError = new Error(`short response (${Buffer.byteLength(stdout || "")} bytes)`);
    } catch (err) {
      // curl exits non-zero on a dropped connection; that is expected here.
      lastError = new Error(`curl failed: ${err.message.split("\n")[0]}`);
    }
    if (attempt < retries) await sleep(500 * attempt);
  }
  throw new Error(`${url} -> ${lastError?.message} (after ${retries} attempts)`);
}

/** Same retry policy, but for binary assets. Returns the buffer. */
export async function fetchBuffer(url, { retries = 6, timeoutMs = 30000, minBytes = 200 } = {}) {
  const tmp = path.join("/tmp", `uline-dl-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const args = [...baseArgs(url), "-o", tmp, "--max-time", String(Math.round(timeoutMs / 1000))];
      await run("curl", args, { maxBuffer: 16 * 1024 * 1024 });
      const { readFile, stat } = await import("node:fs/promises");
      const info = await stat(tmp);
      if (info.size >= minBytes) return await readFile(tmp);
      lastError = new Error(`short file (${info.size} bytes)`);
    } catch (err) {
      lastError = new Error(`curl failed: ${err.message.split("\n")[0]}`);
    }
    if (attempt < retries) await sleep(500 * attempt);
  }
  throw new Error(`${url} -> ${lastError?.message} (after ${retries} attempts)`);
}

/** Download straight to disk, creating the parent directory. */
export async function downloadTo(url, dest, opts) {
  const buf = await fetchBuffer(url, opts);
  mkdirSync(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return buf.length;
}

/** Uline renders some browse pages client-side, so those need a real browser. */
export async function fetchRendered(url, { timeoutMs = 120000, virtualTimeMs = 20000 } = {}) {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}`);
  const profile = `/tmp/uline-chrome-${process.pid}-${Date.now()}`;
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--disable-dev-shm-usage",
    "--user-data-dir=" + profile,
    "--virtual-time-budget=" + virtualTimeMs,
    "--dump-dom",
  ];
  if (PROXY) args.push("--proxy-server=" + PROXY);
  args.push(url);
  const { stdout } = await run(CHROME, args, { maxBuffer: 96 * 1024 * 1024, timeout: timeoutMs });
  return stdout;
}
