"use client";

interface HappyScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export default function HappyScore({ score, size = "md" }: HappyScoreProps) {
  const color =
    score >= 70
      ? { stroke: "#059669", text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200" }
      : score >= 40
      ? { stroke: "#d97706", text: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200" }
      : { stroke: "#9ca3af", text: "text-gray-500", bg: "bg-gray-50", ring: "ring-gray-200" };

  const label = score >= 70 ? "Scenic" : score >= 40 ? "Okay" : "Low";

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-xs font-bold ${color.text} ${color.bg} ${color.ring}`}
      >
        {score}
      </span>
    );
  }

  // Circular progress ring
  const radius = size === "lg" ? 28 : 20;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - progress);
  const svgSize = (radius + 4) * 2;

  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      <svg width={svgSize} height={svgSize} className="transform -rotate-90">
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={size === "lg" ? 4 : 3}
        />
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke={color.stroke}
          strokeWidth={size === "lg" ? 4 : 3}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
        <text
          x={svgSize / 2}
          y={svgSize / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className={`${size === "lg" ? "text-base" : "text-xs"} font-bold fill-current ${color.text}`}
          transform={`rotate(90, ${svgSize / 2}, ${svgSize / 2})`}
        >
          {score}
        </text>
      </svg>
      {size === "lg" && (
        <span className="text-[10px] font-medium text-gray-400 tracking-wide">{label}</span>
      )}
    </div>
  );
}
