import dns from "node:dns/promises";
import type { Finding } from "../types";

export async function checkDns(domain: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const records = await dns.resolveTxt(domain);
    const flat = records.map((r) => r.join(""));
    const spf = flat.find((r) => r.toLowerCase().startsWith("v=spf1"));
    if (spf) {
      findings.push({ id: "spf-present", category: "security", title: "SPF record found", severity: "good", detail: spf });
    } else {
      findings.push({
        id: "spf-missing",
        category: "security",
        title: "No SPF record found",
        severity: "warning",
        detail: "Without SPF, it's easier for attackers to send phishing emails that appear to come from this domain.",
      });
    }
  } catch {
    findings.push({
      id: "spf-missing",
      category: "security",
      title: "No SPF record found",
      severity: "warning",
      detail: "Without SPF, it's easier for attackers to send phishing emails that appear to come from this domain.",
    });
  }

  try {
    const records = await dns.resolveTxt(`_dmarc.${domain}`);
    const flat = records.map((r) => r.join(""));
    const dmarc = flat.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
    if (dmarc) {
      findings.push({ id: "dmarc-present", category: "security", title: "DMARC record found", severity: "good", detail: dmarc });
    } else {
      findings.push({
        id: "dmarc-missing",
        category: "security",
        title: "No DMARC record found",
        severity: "critical",
        detail: "Without DMARC, spoofed emails pretending to be from this domain aren't blocked or reported to you.",
      });
    }
  } catch {
    findings.push({
      id: "dmarc-missing",
      category: "security",
      title: "No DMARC record found",
      severity: "critical",
      detail: "Without DMARC, spoofed emails pretending to be from this domain aren't blocked or reported to you.",
    });
  }

  return findings;
}
