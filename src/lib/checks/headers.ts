import { safeFetch } from "../net";
import type { Finding, Severity } from "../types";

const SECURITY_HEADERS: { header: string; id: string; title: string; missingSeverity: Severity; whyMissing: string }[] = [
  {
    header: "strict-transport-security",
    id: "hsts",
    title: "HSTS (Strict-Transport-Security)",
    missingSeverity: "warning",
    whyMissing: "Without HSTS, visitors can be tricked onto an insecure http:// version of the site by an attacker on the same network.",
  },
  {
    header: "content-security-policy",
    id: "csp",
    title: "Content-Security-Policy",
    missingSeverity: "warning",
    whyMissing: "Without a CSP, the site has less protection if an attacker manages to inject malicious scripts.",
  },
  {
    header: "x-content-type-options",
    id: "xcto",
    title: "X-Content-Type-Options",
    missingSeverity: "info",
    whyMissing: "Without this, browsers may misinterpret uploaded file types in ways attackers can exploit.",
  },
  {
    header: "x-frame-options",
    id: "xfo",
    title: "X-Frame-Options",
    missingSeverity: "info",
    whyMissing: "Without this, the site can potentially be embedded in a hidden frame for clickjacking attacks.",
  },
  {
    header: "referrer-policy",
    id: "refpol",
    title: "Referrer-Policy",
    missingSeverity: "info",
    whyMissing: "Without this, full page URLs (sometimes containing sensitive data) may leak to third-party sites.",
  },
  {
    header: "permissions-policy",
    id: "permpol",
    title: "Permissions-Policy",
    missingSeverity: "info",
    whyMissing: "Without this, browser features like camera/microphone access aren't explicitly restricted.",
  },
];

export async function checkHeaders(url: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  try {
    const res = await safeFetch(url, { redirect: "follow" });

    for (const { header, id, title, missingSeverity, whyMissing } of SECURITY_HEADERS) {
      if (!res.headers.has(header)) {
        findings.push({
          id: `header-${id}-missing`,
          category: "security",
          title: `Missing ${title} header`,
          severity: missingSeverity,
          detail: whyMissing,
        });
      } else {
        findings.push({
          id: `header-${id}-present`,
          category: "security",
          title: `${title} header is set`,
          severity: "good",
          detail: res.headers.get(header) ?? "",
        });
      }
    }

    const server = res.headers.get("server");
    if (server && /\d/.test(server)) {
      findings.push({
        id: "server-version-leak",
        category: "security",
        title: "Server header reveals software/version details",
        severity: "info",
        detail: `Server: ${server}. This makes it slightly easier for an attacker to target known vulnerabilities.`,
      });
    }
  } catch (err) {
    findings.push({
      id: "headers-fetch-failed",
      category: "security",
      title: "Could not fetch the site to check its response headers",
      severity: "warning",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
  return findings;
}
