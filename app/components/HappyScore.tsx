"use client";

interface HappyScoreProps {
  score: number;
  size?: "sm" | "md";
}

export default function HappyScore({ score, size = "md" }: HappyScoreProps) {
  const color =
    score >= 70
      ? "text-emerald-600 bg-emerald-50 ring-emerald-200"
      : score >= 40
      ? "text-amber-600 bg-amber-50 ring-amber-200"
      : "text-gray-500 bg-gray-50 ring-gray-200";

  const emoji = score >= 70 ? "😊" : score >= 40 ? "😐" : "😕";

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 text-xs font-semibold ${color}`}
      >
        {emoji} {score}
      </span>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl ring-1 px-3 py-1.5 flex-shrink-0 ${color}`}
    >
      <span className="text-xl font-bold leading-tight">{score}</span>
      <span className="text-[10px] font-medium opacity-70 leading-tight">/ 100</span>
    </div>
  );
}
