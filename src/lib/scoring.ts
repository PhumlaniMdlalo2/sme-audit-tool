import type { Category, Finding, ScanScores } from "./types";

const PENALTY: Record<Finding["severity"], number> = {
  critical: 25,
  warning: 10,
  good: 0,
  info: 0,
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Falls back to a penalty-based score when no external grader (e.g. PageSpeed) supplied one. */
export function scoreCategory(findings: Finding[], category: Category, baseScore?: number | null): number {
  if (typeof baseScore === "number") return clamp(baseScore);
  let score = 100;
  for (const f of findings) {
    if (f.category === category) score -= PENALTY[f.severity];
  }
  return clamp(score);
}

export function overallScore(scores: Omit<ScanScores, "overall">): number {
  return clamp(scores.security * 0.5 + scores.performance * 0.25 + scores.seo * 0.25);
}
