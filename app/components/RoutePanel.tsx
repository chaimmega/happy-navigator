"use client";

import type { ScoredRoute, AIExplanation, ScoreBreakdown } from "../types";
import HappyScore from "./HappyScore";
import { ROUTE_COLORS, ROUTE_LABELS } from "../lib/constants";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function fmtTime(s: number): string {
  if (s < 60) return "< 1 min";
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// ─── Score breakdown bar ──────────────────────────────────────────────────────

const BREAKDOWN_SEGMENTS = [
  { key: "parks" as const, color: "bg-emerald-400", label: "Parks" },
  { key: "cycleways" as const, color: "bg-violet-400", label: "Cycleways" },
  { key: "water" as const, color: "bg-sky-400", label: "Water" },
  { key: "green" as const, color: "bg-lime-400", label: "Green" },
  { key: "base" as const, color: "bg-gray-300", label: "Base" },
] as const;

function ScoreBar({ breakdown, total }: { breakdown: ScoreBreakdown; total: number }) {
  if (total === 0) return null;
  return (
    <div className="mt-2.5">
      <div className="flex rounded-full overflow-hidden h-1.5 bg-gray-100">
        {BREAKDOWN_SEGMENTS.map(({ key, color }) => {
          const val = breakdown[key];
          if (val === 0) return null;
          return (
            <div
              key={key}
              className={`${color} h-full`}
              style={{ width: `${(val / 100) * 100}%` }}
              title={`${key}: ${val} pts`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
        {BREAKDOWN_SEGMENTS.filter(({ key }) => breakdown[key] > 0 && key !== "base").map(
          ({ key, color, label }) => (
            <span key={key} className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className={`w-2 h-2 rounded-full ${color} inline-block`} />
              {label} {breakdown[key]} pts
            </span>
          )
        )}
      </div>
    </div>
  );
}

// ─── Signal badges ────────────────────────────────────────────────────────────

function Badge({
  show,
  bg,
  label,
}: {
  show: boolean;
  bg: string;
  label: string;
}) {
  if (!show) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bg}`}>
      {label}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface RoutePanelProps {
  routes: ScoredRoute[];
  selectedRouteId: number;
  bestRouteId: number;
  explanation: AIExplanation | null;
  onSelectRoute: (id: number) => void;
  startName: string;
  endName: string;
}

export default function RoutePanel({
  routes,
  selectedRouteId,
  bestRouteId,
  explanation,
  onSelectRoute,
  startName,
  endName,
}: RoutePanelProps) {
  return (
    <div className="space-y-5">
      {/* ── Happy Route summary card ── */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl" aria-hidden>
            🌿
          </span>
          <h2 className="font-bold text-emerald-900 text-base leading-tight">
            Happy Route Found!
          </h2>
        </div>

        <p className="text-xs text-emerald-700 mb-3 leading-snug">
          <span className="font-semibold">{startName}</span>
          <span className="mx-1 opacity-60">→</span>
          <span className="font-semibold">{endName}</span>
        </p>

        {explanation ? (
          <>
            <ul className="space-y-1.5">
              {explanation.bullets.map((bullet, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm text-emerald-800 leading-snug"
                >
                  <span className="mt-0.5 flex-shrink-0 text-emerald-500">✦</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            {explanation.suggestedStops && explanation.suggestedStops.length > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-200">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">
                  Suggested stops
                </p>
                <ul className="space-y-1">
                  {explanation.suggestedStops.map((stop, i) => (
                    <li key={i} className="text-sm text-emerald-700 flex gap-1.5">
                      <span>📍</span>
                      <span>{stop}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-emerald-700 italic">
            AI explanation unavailable — check your API key in .env.local.
          </p>
        )}
      </div>

      {/* ── Route cards ── */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
          All routes — click to highlight on map
        </p>

        {routes.map((route, i) => {
          const isSelected = route.id === selectedRouteId;
          const isBest = route.id === bestRouteId;
          const color = ROUTE_COLORS[i % ROUTE_COLORS.length];

          return (
            <button
              key={route.id}
              onClick={() => onSelectRoute(route.id)}
              aria-label={`Select ${ROUTE_LABELS[i]}, Happy Score ${route.happyScore} out of 100`}
              aria-pressed={isSelected}
              className={`w-full text-left rounded-xl border-2 p-3.5 transition-all ${
                isSelected
                  ? "bg-white shadow-md"
                  : "border-transparent bg-gray-50 hover:bg-white hover:border-gray-200"
              }`}
              style={isSelected ? { borderColor: color } : {}}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-semibold text-gray-900 text-sm truncate">
                    {ROUTE_LABELS[i]}
                  </span>
                  {isBest && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                      Happy Route ★
                    </span>
                  )}
                </div>
                <HappyScore score={route.happyScore} size="sm" />
              </div>

              {/* Stats */}
              <div className="mt-2 flex gap-3 text-xs text-gray-500">
                <span>📏 {fmtDist(route.distance)}</span>
                <span>⏱ {fmtTime(route.duration)}</span>
              </div>

              {/* Score breakdown bar */}
              <ScoreBar breakdown={route.scoreBreakdown} total={route.happyScore} />

              {/* Signal badges */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge
                  show={route.signals.parkCount > 0}
                  bg="bg-green-100 text-green-700"
                  label={`🌳 ${route.signals.parkCount} park${route.signals.parkCount !== 1 ? "s" : ""}`}
                />
                <Badge
                  show={route.signals.waterCount > 0}
                  bg="bg-sky-100 text-sky-700"
                  label={`💧 ${route.signals.waterCount} water`}
                />
                <Badge
                  show={route.signals.cyclewayCount > 0}
                  bg="bg-violet-100 text-violet-700"
                  label={`🚴 ${route.signals.cyclewayCount} cycle paths`}
                />
                <Badge
                  show={route.signals.greenCount > 0}
                  bg="bg-lime-100 text-lime-700"
                  label={`🌿 ${route.signals.greenCount} green`}
                />
                {route.signals.partial && (
                  <Badge show bg="bg-gray-100 text-gray-400" label="~ partial data" />
                )}
                {!route.signals.parkCount &&
                  !route.signals.waterCount &&
                  !route.signals.cyclewayCount &&
                  !route.signals.greenCount && (
                    <span className="text-xs text-gray-400 italic">
                      No nearby green/cycle features found
                    </span>
                  )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
