import type { Finding } from "@/lib/types";

const SEVERITY_STYLES: Record<Finding["severity"], { label: string; badge: string; border: string }> = {
  critical: {
    label: "Critical",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    border: "border-l-red-500",
  },
  warning: {
    label: "Warning",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    border: "border-l-amber-500",
  },
  good: {
    label: "Good",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    border: "border-l-emerald-500",
  },
  info: {
    label: "Info",
    badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    border: "border-l-zinc-400",
  },
};

export function FindingCard({ finding }: { finding: Finding }) {
  const style = SEVERITY_STYLES[finding.severity];

  return (
    <div className={`rounded-lg border border-zinc-200 border-l-4 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${style.border}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{finding.title}</h3>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>{style.label}</span>
      </div>

      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{finding.plainEnglish || finding.detail}</p>

      {finding.howToFix && (
        <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700 whitespace-pre-line dark:bg-zinc-800/60 dark:text-zinc-300">
          <span className="font-medium">How to fix it: </span>
          {finding.howToFix}
        </div>
      )}
    </div>
  );
}
