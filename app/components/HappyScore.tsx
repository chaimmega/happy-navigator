"use client";

import { motion } from "framer-motion";
import { getScoreTier } from "../types";

interface HappyScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}

export default function HappyScore({ score, size = "md", animate = true }: HappyScoreProps) {
  const tier = getScoreTier(score);

  const tierColors = {
    scenic: { stroke: "hsl(160, 84%, 39%)", bg: "hsl(152, 81%, 96%)", text: "hsl(163, 94%, 24%)" },
    okay: { stroke: "hsl(38, 92%, 50%)", bg: "hsl(48, 96%, 89%)", text: "hsl(32, 95%, 44%)" },
    low: { stroke: "hsl(220, 9%, 46%)", bg: "hsl(220, 14%, 96%)", text: "hsl(220, 9%, 46%)" },
  };

  const colors = tierColors[tier];
  const tierLabel = tier === "scenic" ? "Scenic" : tier === "okay" ? "Okay" : "Low";

  if (size === "sm") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        style={{ backgroundColor: colors.bg, color: colors.text }}
      >
        {score}
      </span>
    );
  }

  const diameter = size === "lg" ? 64 : 48;
  const strokeWidth = size === "lg" ? 4 : 3.5;
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: diameter, height: diameter }}>
        <svg width={diameter} height={diameter} className="-rotate-90">
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={animate ? { strokeDashoffset: circumference } : { strokeDashoffset: offset }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color: colors.text }}>
            {score}
          </span>
        </div>
      </div>
      {size === "lg" && (
        <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: colors.text }}>
          {tierLabel}
        </span>
      )}
    </div>
  );
}
