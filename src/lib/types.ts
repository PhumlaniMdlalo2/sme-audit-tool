export type Severity = "critical" | "warning" | "good" | "info";
export type Category = "security" | "performance" | "seo" | "domain";

export interface Finding {
  id: string;
  category: Category;
  title: string;
  severity: Severity;
  detail: string;
  plainEnglish?: string;
  howToFix?: string;
}

export interface ScanScores {
  overall: number;
  security: number;
  performance: number;
  seo: number;
}

export interface ScanResult {
  domain: string;
  scannedAt: string;
  scores: ScanScores;
  findings: Finding[];
  errors: string[];
}
