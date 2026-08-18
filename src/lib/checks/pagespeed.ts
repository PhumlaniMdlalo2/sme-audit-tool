import type { Finding } from "../types";

interface PageSpeedScores {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
}

export interface PageSpeedResult {
  scores: PageSpeedScores;
  findings: Finding[];
}

const AUDITS_OF_INTEREST: { id: string; title: string; category: Finding["category"] }[] = [
  { id: "viewport", title: "Missing responsive viewport tag", category: "seo" },
  { id: "is-on-https", title: "Site is not served entirely over HTTPS", category: "security" },
  { id: "image-alt", title: "Images missing alt text", category: "seo" },
  { id: "meta-description", title: "Missing meta description", category: "seo" },
  { id: "document-title", title: "Missing or unhelpful page title", category: "seo" },
  { id: "largest-contentful-paint", title: "Slow largest contentful paint — page feels slow to load", category: "performance" },
  { id: "uses-responsive-images", title: "Images aren't sized/optimized for how they're displayed", category: "performance" },
];

export async function checkPageSpeed(url: string): Promise<PageSpeedResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  const params = new URLSearchParams({ url, strategy: "mobile" });
  for (const c of ["performance", "seo", "accessibility", "best-practices"]) params.append("category", c);
  if (apiKey) params.set("key", apiKey);

  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`PageSpeed API returned HTTP ${res.status}`);

    const data = await res.json();
    const categories = data.lighthouseResult?.categories ?? {};
    const scoreOf = (key: string): number | null => {
      const score = categories[key]?.score;
      return typeof score === "number" ? Math.round(score * 100) : null;
    };

    const scores: PageSpeedScores = {
      performance: scoreOf("performance"),
      seo: scoreOf("seo"),
      accessibility: scoreOf("accessibility"),
      bestPractices: scoreOf("best-practices"),
    };

    const audits = data.lighthouseResult?.audits ?? {};
    const findings: Finding[] = [];
    for (const { id, title, category } of AUDITS_OF_INTEREST) {
      const audit = audits[id];
      if (audit && typeof audit.score === "number" && audit.score < 0.9) {
        findings.push({
          id: `pagespeed-${id}`,
          category,
          title,
          severity: audit.score < 0.5 ? "warning" : "info",
          detail: audit.displayValue || audit.description || "",
        });
      }
    }

    return { scores, findings };
  } catch (err) {
    return {
      scores: { performance: null, seo: null, accessibility: null, bestPractices: null },
      findings: [
        {
          id: "pagespeed-failed",
          category: "performance",
          title: "Could not run the performance/SEO scan",
          severity: "info",
          detail: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }
}
