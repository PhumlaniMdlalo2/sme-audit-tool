import { safeFetch } from "../net";
import type { Finding } from "../types";

export async function checkCms(url: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  try {
    const res = await safeFetch(url, { redirect: "follow" });
    const html = await res.text();

    const generatorMatch = html.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/i);
    if (generatorMatch) {
      const generator = generatorMatch[1];
      findings.push({
        id: "cms-generator",
        category: "security",
        title: `Site technology publicly visible: ${generator}`,
        severity: "info",
        detail: "The generator tag reveals the CMS (and sometimes its version), which makes version-targeted attacks slightly easier. Consider removing it.",
      });

      const wpVersionMatch = generator.match(/WordPress\s+([\d.]+)/i);
      if (wpVersionMatch) {
        findings.push({
          id: "wp-version-exposed",
          category: "security",
          title: "WordPress version number is publicly exposed",
          severity: "warning",
          detail: `Detected version ${wpVersionMatch[1]}. Keep WordPress core, themes and plugins updated to the latest version.`,
        });
      }
    } else if (/wp-content|wp-includes/i.test(html)) {
      findings.push({
        id: "cms-wordpress-detected",
        category: "security",
        title: "Site appears to run WordPress",
        severity: "info",
        detail: "The version/generator tag is hidden, which is good practice — just make sure core, theme and plugins are still kept up to date.",
      });
    }
  } catch (err) {
    findings.push({
      id: "cms-check-failed",
      category: "security",
      title: "Could not check site technology",
      severity: "info",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
  return findings;
}
