import { NextResponse } from "next/server";
import { normalizeDomain, assertPublicHostname } from "@/lib/net";
import { checkSsl } from "@/lib/checks/ssl";
import { checkHeaders } from "@/lib/checks/headers";
import { checkExposedFiles } from "@/lib/checks/exposedFiles";
import { checkDns } from "@/lib/checks/dns";
import { checkCms } from "@/lib/checks/cms";
import { checkPageSpeed } from "@/lib/checks/pagespeed";
import { checkDomainExpiry } from "@/lib/checks/domainExpiry";
import { scoreCategory, overallScore } from "@/lib/scoring";
import { explainFindings } from "@/lib/report";
import { isRateLimited } from "@/lib/rateLimit";
import type { Finding, ScanResult } from "@/lib/types";

export const dynamic = "force-dynamic";

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many scans from this connection — please wait a minute and try again." }, { status: 429 });
  }

  let body: { domain?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const domain = normalizeDomain(body.domain ?? "");
  if (!DOMAIN_RE.test(domain)) {
    return NextResponse.json({ error: "Enter a valid domain, e.g. example.co.za" }, { status: 400 });
  }

  try {
    await assertPublicHostname(domain);
  } catch {
    return NextResponse.json({ error: "This domain can't be scanned." }, { status: 400 });
  }

  const url = `https://${domain}`;
  const errors: string[] = [];

  const [sslRes, headersRes, exposedRes, dnsRes, cmsRes, pageSpeedRes, domainRes] = await Promise.allSettled([
    checkSsl(domain),
    checkHeaders(url),
    checkExposedFiles(url),
    checkDns(domain),
    checkCms(url),
    checkPageSpeed(url),
    checkDomainExpiry(domain),
  ]);

  let findings: Finding[] = [];
  const collect = (result: PromiseSettledResult<Finding[]>, label: string) => {
    if (result.status === "fulfilled") {
      findings = findings.concat(result.value);
    } else {
      errors.push(`${label} check failed: ${String(result.reason)}`);
    }
  };

  collect(sslRes, "SSL");
  collect(headersRes, "Headers");
  collect(exposedRes, "Exposed files");
  collect(dnsRes, "DNS/email");
  collect(cmsRes, "Technology");
  collect(domainRes, "Domain expiry");

  let pageSpeedScores = { performance: null as number | null, seo: null as number | null };
  if (pageSpeedRes.status === "fulfilled") {
    pageSpeedScores = pageSpeedRes.value.scores;
    findings = findings.concat(pageSpeedRes.value.findings);
  } else {
    errors.push(`Performance/SEO check failed: ${String(pageSpeedRes.reason)}`);
  }

  findings = await explainFindings(findings);

  const security = scoreCategory(findings, "security");
  const performance = pageSpeedScores.performance ?? scoreCategory(findings, "performance");
  const seo = pageSpeedScores.seo ?? scoreCategory(findings, "seo");
  const overall = overallScore({ security, performance, seo });

  const result: ScanResult = {
    domain,
    scannedAt: new Date().toISOString(),
    scores: { overall, security, performance, seo },
    findings,
    errors,
  };

  return NextResponse.json(result);
}
