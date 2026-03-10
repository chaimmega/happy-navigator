"use client";

import { motion } from "framer-motion";
import { Download, Leaf, Flame } from "lucide-react";
import type { ScoredRoute, ScoreBreakdown } from "../types";
import { formatDistance, formatDuration, formatElevation, estimateCO2Saved } from "../types";
import { ROUTE_COLORS, ROUTE_NAMES } from "../lib/constants";
import HappyScore from "./HappyScore";

interface RouteCardProps {
  route: ScoredRoute;
  isBest: boolean;
  isSelected: boolean;
  metric: boolean;
  onClick: () => void;
  startName: string;
  endName: string;
}

const signalChips = [
  { key: "parkCount", emoji: "🌳", label: "parks" },
  { key: "waterwayCount", emoji: "🌊", label: "waterways" },
  { key: "waterCount", emoji: "💧", label: "water" },
  { key: "calmWaterCount", emoji: "🏊", label: "calm water" },
  { key: "greenCount", emoji: "🌿", label: "green" },
  { key: "launchCount", emoji: "⛵", label: "launches" },
  { key: "litCount", emoji: "💡", label: "lit" },
] as const;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function exportGPX(route: ScoredRoute, startName: string, endName: string) {
  const trackPoints = route.geometry
    .map(([lng, lat]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"></trkpt>`)
    .join("\n");

  const safeName = escapeXml(`${startName} to ${endName}`);
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Happy Navigator" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeName}</name>
    <desc>Happy Score: ${route.happyScore}/100</desc>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `happy-route-${route.id + 1}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const positiveBreakdown: { key: keyof ScoreBreakdown; color: string; label: string }[] = [
  { key: "parks", color: "hsl(160, 84%, 39%)", label: "Parks" },
  { key: "waterways", color: "hsl(217, 91%, 60%)", label: "Waterways" },
  { key: "water", color: "hsl(199, 89%, 48%)", label: "Water" },
  { key: "green", color: "hsl(84, 85%, 50%)", label: "Green" },
  { key: "calmWater", color: "hsl(199, 95%, 74%)", label: "Calm Water" },
  { key: "launch", color: "hsl(172, 66%, 50%)", label: "Launches" },
  { key: "portage", color: "hsl(239, 84%, 67%)", label: "Portage" },
  { key: "lit", color: "hsl(38, 92%, 50%)", label: "Well-Lit" },
  { key: "base", color: "hsl(220, 9%, 75%)", label: "Base" },
];

export function RouteCard({ route, isBest, isSelected, metric, onClick, startName, endName }: RouteCardProps) {
  const routeColor = ROUTE_COLORS[route.id] || ROUTE_COLORS[0];
  const routeName = ROUTE_NAMES[route.id] || `Route ${route.id + 1}`;

  const topSignals = signalChips
    .filter((s) => {
      const val = route.signals[s.key as keyof typeof route.signals];
      return typeof val === "number" && val > 0;
    })
    .slice(0, 3);

  const totalPositive = positiveBreakdown.reduce(
    (sum, s) => sum + (route.scoreBreakdown[s.key] || 0), 0
  );

  const calories = Math.round(280 * (route.duration / 3600));
  const co2Grams = estimateCO2Saved(route.distance);
  const co2Display = co2Grams >= 1000 ? `${(co2Grams / 1000).toFixed(1)} kg` : `${co2Grams} g`;

  return (
    <motion.div
      layout
      onClick={onClick}
      className={`cursor-pointer rounded-2xl border-2 transition-all ${
        isSelected
          ? "bg-card shadow-lg ring-1 ring-primary/10"
          : "border-transparent bg-card shadow-sm hover:shadow-md hover:border-primary/10"
      }`}
      style={isSelected ? { borderColor: routeColor + "40" } : {}}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: routeColor }} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[15px] tracking-tight">{routeName}</span>
                {isBest && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                    Best Route ★
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="font-medium">{formatDistance(route.distance, metric)}</span>
                <span className="opacity-40">&middot;</span>
                <span>{formatDuration(route.duration)}</span>
                {route.elevationGainM != null && (
                  <>
                    <span className="opacity-40">&middot;</span>
                    <span className="text-amber">{formatElevation(route.elevationGainM, metric)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <HappyScore score={route.happyScore} size={isSelected ? "md" : "sm"} />
        </div>

        {/* Signal chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topSignals.map((s) => (
            <span key={s.key}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground"
            >
              {s.emoji} {route.signals[s.key as keyof typeof route.signals] as number} {s.label}
            </span>
          ))}
          {!topSignals.length && route.signals.partial && (
            <span className="text-xs text-muted-foreground italic">Partial data</span>
          )}
        </div>

        {/* Expanded details */}
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3 border-t pt-3">
              {/* Score breakdown bar */}
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Score Breakdown
                </p>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                  {positiveBreakdown.map((seg) => {
                    const val = route.scoreBreakdown[seg.key] || 0;
                    if (val <= 0) return null;
                    return (
                      <div key={seg.key} className="transition-all"
                        style={{ width: `${(val / totalPositive) * 100}%`, backgroundColor: seg.color }}
                        title={`${seg.label}: ${val}`} />
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {positiveBreakdown.map((seg) => {
                    const val = route.scoreBreakdown[seg.key] || 0;
                    if (val <= 0) return null;
                    return (
                      <span key={seg.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
                        {seg.label} +{val}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Penalties */}
              {(route.scoreBreakdown.rapids !== 0 || route.scoreBreakdown.elevation !== 0 || route.scoreBreakdown.motorBoat !== 0) && (
                <div className="flex flex-wrap gap-2.5 text-[11px]">
                  {route.scoreBreakdown.rapids !== 0 && (
                    <span className="text-orange-500">🌀 Rapids {route.scoreBreakdown.rapids}</span>
                  )}
                  {route.scoreBreakdown.elevation !== 0 && (
                    <span className="text-amber">⛰️ Hilly {route.scoreBreakdown.elevation}</span>
                  )}
                  {route.scoreBreakdown.motorBoat !== 0 && (
                    <span className="text-destructive">🚤 Motorboat {route.scoreBreakdown.motorBoat}</span>
                  )}
                </div>
              )}

              {/* All signals grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {signalChips.map((s) => {
                  const count = route.signals[s.key as keyof typeof route.signals];
                  return (
                    <span key={s.key} className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-[11px]">
                      {s.emoji} <span className="font-medium">{count as number}</span> {s.label}
                    </span>
                  );
                })}
              </div>

              {/* Calories & CO2 */}
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1" title="Estimated calories burned">
                  <Flame className="h-3 w-3 text-orange-400" />
                  ~{calories} kcal
                </span>
                <span className="flex items-center gap-1 text-primary" title="CO₂ saved vs average route">
                  <Leaf className="h-3 w-3" />
                  saves ~{co2Display} CO₂
                </span>
              </div>

              {/* Export GPX */}
              <button
                onClick={(e) => { e.stopPropagation(); exportGPX(route, startName, endName); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-accent py-2 text-xs font-medium text-primary transition-colors hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Export GPX
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
