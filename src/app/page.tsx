"use client";

import { useState } from "react";
import { ScoreCard } from "@/components/ScoreCard";
import { FindingCard } from "@/components/FindingCard";
import type { Category, ScanResult } from "@/lib/types";

const CATEGORY_LABEL: Record<Category, string> = {
  security: "Security",
  performance: "Performance",
  seo: "SEO",
  domain: "Domain",
};

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2, good: 3 };

export default function Home() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult(data as ScanResult);
    } catch {
      setError("Couldn't reach the scanner. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const groupedFindings = result
    ? (Object.keys(CATEGORY_LABEL) as Category[])
        .map((category) => ({
          category,
          findings: result.findings
            .filter((f) => f.category === category)
            .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
        }))
        .filter((group) => group.findings.length > 0)
    : [];

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16 sm:py-24">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            Is your website putting your business at risk?
          </h1>
          <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
            Get a free, instant audit of your website&apos;s security, performance and SEO — in plain
            English, with clear steps to fix what&apos;s wrong.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            required
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourbusiness.co.za"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {loading ? "Scanning…" : "Scan my website"}
          </button>
        </form>

        {loading && (
          <p className="text-center text-sm text-zinc-500">
            Checking security headers, SSL, email spoofing protection, performance and SEO — this takes a few seconds.
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-8">
            <ScoreCard
              overall={result.scores.overall}
              security={result.scores.security}
              performance={result.scores.performance}
              seo={result.scores.seo}
            />

            {groupedFindings.map(({ category, findings }) => (
              <div key={category} className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {CATEGORY_LABEL[category]}
                </h2>
                <div className="flex flex-col gap-3">
                  {findings.map((finding) => (
                    <FindingCard key={finding.id} finding={finding} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
