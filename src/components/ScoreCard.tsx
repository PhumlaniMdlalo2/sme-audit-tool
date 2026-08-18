function grade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function ringColor(score: number): string {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 60) return "stroke-amber-500";
  return "stroke-red-500";
}

function ScoreRing({ label, score, big }: { label: string; score: number; big?: boolean }) {
  const size = big ? 128 : 84;
  const stroke = big ? 10 : 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            className="fill-none stroke-zinc-200 dark:stroke-zinc-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`fill-none transition-[stroke-dashoffset] duration-700 ease-out ${ringColor(score)}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${big ? "text-3xl" : "text-xl"} ${scoreColor(score)}`}>{score}</span>
          {big && <span className={`text-xs font-medium ${scoreColor(score)}`}>{grade(score)}</span>}
        </div>
      </div>
      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
    </div>
  );
}

export function ScoreCard({
  overall,
  security,
  performance,
  seo,
}: {
  overall: number;
  security: number;
  performance: number;
  seo: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-8 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 sm:justify-between">
      <ScoreRing label="Overall" score={overall} big />
      <div className="flex flex-wrap justify-center gap-6">
        <ScoreRing label="Security" score={security} />
        <ScoreRing label="Performance" score={performance} />
        <ScoreRing label="SEO" score={seo} />
      </div>
    </div>
  );
}
