import dns from "node:dns/promises";
import dnsSync from "node:dns";
import http from "node:http";
import https from "node:https";
import { Buffer } from "node:buffer";

// Prefer IPv4 for outbound connections. Node's default Happy Eyeballs order
// tries IPv6 first; on networks with a broken/unreachable IPv6 route (common
// enough in the wild, not just this dev box) that adds a slow failure before
// falling back to IPv4, or times out entirely instead of falling back. Every
// check in this app depends on reliably reaching arbitrary third-party
// domains, so this is set once for the whole process.
dnsSync.setDefaultResultOrder("ipv4first");

/**
 * Strips protocol/path/port from user input so we're left with a bare hostname.
 */
export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0];
  d = d.split(":")[0];
  d = d.replace(/\.$/, "");
  return d;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.split(":").pop();
    if (v4 && /^\d+\.\d+\.\d+\.\d+$/.test(v4)) return isPrivateIPv4(v4);
  }
  return false;
}

function assertResolvableAndPublic(hostname: string, addresses: { address: string; family: number }[]): void {
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("Blocked hostname");
  }
  if (addresses.length === 0) throw new Error("Domain does not resolve");
  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) throw new Error("Blocked private IPv4 target");
    if (family === 6 && isPrivateIPv6(address)) throw new Error("Blocked private IPv6 target");
  }
}

/**
 * Fast-fail gate used once up front in the API route, purely for a quick,
 * friendly rejection of obviously-bad input before running seven checks.
 * NOT the actual SSRF defense on its own — see resolvePinnedPublicAddress,
 * which every outbound connection re-validates against immediately before
 * connecting (a separate "check early for UX" call like this one is subject
 * to DNS-rebinding TOCTOU if anything downstream trusted it alone).
 */
export async function assertPublicHostname(hostname: string): Promise<void> {
  const addresses = await dns.lookup(hostname, { all: true });
  assertResolvableAndPublic(hostname, addresses);
}

/**
 * Resolves hostname -> a single validated public IP, to be used *immediately*
 * for the actual connection (not cached, not reused across a later request).
 * This is what closes the DNS-rebinding gap: a malicious DNS server can't
 * hand out a private IP after passing an earlier, separate check if there
 * never is a gap between "resolve" and "connect".
 */
export async function resolvePinnedPublicAddress(hostname: string): Promise<string> {
  const addresses = await dns.lookup(hostname, { all: true });
  assertResolvableAndPublic(hostname, addresses);
  const ipv4 = addresses.find((a) => a.family === 4);
  return (ipv4 ?? addresses[0]).address;
}

interface SafeFetchOptions {
  method?: "GET" | "HEAD";
  redirect?: "manual" | "follow";
  timeoutMs?: number;
  maxRedirects?: number;
}

function rawRequest(url: URL, pinnedIp: string, method: string, timeoutMs: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;

    const req = transport.request(
      {
        host: pinnedIp,
        port: url.port ? Number(url.port) : isHttps ? 443 : 80,
        path: url.pathname + url.search,
        method,
        // Connecting to the pinned IP, but SNI/cert + Host header still
        // target the real hostname — this is what makes IP-pinning
        // transparent to virtual hosting and TLS validation.
        servername: isHttps ? url.hostname : undefined,
        headers: { Host: url.hostname, "User-Agent": "SiteCheckBot/1.0 (+free website audit tool)" },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const headers = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
            else if (value) headers.set(key, value);
          }
          resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 0, headers }));
        });
        res.on("error", reject);
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * fetch()-alike for checks that need to hit a user-submitted domain. Unlike
 * plain fetch(), every hop — including ones a redirect sends us to — gets its
 * hostname freshly resolved, validated as public, and pinned immediately
 * before connecting. Plain `fetch(url, { redirect: "follow" })` would happily
 * follow a 302 from an attacker's own domain straight to
 * http://169.254.169.254/ or an internal service; this won't.
 */
export async function safeFetch(inputUrl: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { method = "GET", redirect = "follow", timeoutMs = 8000, maxRedirects = 5 } = options;

  let currentUrl = new URL(inputUrl);
  let redirectsLeft = maxRedirects;

  for (;;) {
    const pinnedIp = await resolvePinnedPublicAddress(currentUrl.hostname);
    const response = await rawRequest(currentUrl, pinnedIp, method, timeoutMs);

    if (redirect === "follow" && response.status >= 300 && response.status < 400 && redirectsLeft > 0) {
      const location = response.headers.get("location");
      if (location) {
        currentUrl = new URL(location, currentUrl);
        redirectsLeft -= 1;
        continue;
      }
    }

    return response;
  }
}
