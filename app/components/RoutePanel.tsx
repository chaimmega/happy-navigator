"use client";

import type { ScoredRoute, AIExplanation, ScoreBreakdown } from "../types";
import HappyScore from "./HappyScore";
import ElevationProfile from "./ElevationProfile";
import { ROUTE_COLORS, ROUTE_LABELS } from "../lib/constants";

// ─── Unit formatting ───────────────────────────────────────────────────────────

function fmtDist(m: number, metric: boolean): string {
  if (metric) {
    const km = m / 1000;
    return km < 0.1 ? "< 0.1 km" : `${km.toFixed(1)} km`;
  }
  const mi = m / 1609.344;
  return mi < 0.1 ? "< 0.1 mi" : `${mi.toFixed(1)} mi`;
}

function fmtTime(s: number): string {
  if (s < 60) return "< 1 min";
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function fmtElev(gainM: number, metric: boolean): string {
  return metric ? `↑ ${Math.round(gainM)} m` : `↑ ${Math.round(gainM * 3.28084)} ft`;
}

// ─── Calories & CO2 estimates ─────────────────────────────────────────────────
// Calories: ~4 MET × 70 kg × hours ≈ 280 × hours (moderate paddling)
// CO2 saved vs car: avg petrol car ≈ 120 g CO₂/km

function estimateCalories(durationS: number): number {
  return Math.round(280 * (durationS / 3600));
}

function estimateCO2Saved(distanceM: number): string {
  const grams = Math.round((distanceM / 1000) * 120);
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${grams} g`;
}

// ─── Route type label ─────────────────────────────────────────────────────────

function getRouteTypeLabel(route: ScoredRoute, allRoutes: ScoredRoute[]): string | null {
  if (allRoutes.length < 2) return null;

  const shortestId = allRoutes.reduce((a, b) => (a.distance < b.distance ? a : b)).id;

  const withElev = allRoutes.filter((r) => r.elevationGainM != null);
  const flattestId =
    withElev.length > 1
      ? withElev.reduce((a, b) => ((a.elevationGainM ?? Infinity) < (b.elevationGainM ?? Infinity) ? a : b)).id
      : null;

  // Prioritise flattest → then shortest
  if (flattestId !== null && route.id === flattestId) return "Flattest";
  if (route.id === shortestId) return "Shortest";
  return null;
}

// ─── Route comparison strip ───────────────────────────────────────────────────

function ComparisonStrip({
  routes,
  selectedRouteId,
  bestRouteId,
  onSelect,
  useMetric,
}: {
  routes: ScoredRoute[];
  selectedRouteId: number;
  bestRouteId: number;
  onSelect: (id: number) => void;
  useMetric: boolean;
}) {
  if (routes.length < 2) return null;
  return (
    <div className="grid gap-1.5 mb-3" style={{ gridTemplateColumns: `repeat(${routes.length}, 1fr)` }}>
      {routes.map((r, i) => {
        const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
        const isSelected = r.id === selectedRouteId;
        const isBest = r.id === bestRouteId;
        const typeLabel = getRouteTypeLabel(r, routes);
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r.id)}
            className={`rounded-lg p-2 text-center transition-all border-2 ${
              isSelected ? "bg-white shadow-sm" : "bg-gray-50 border-transparent hover:bg-white"
            }`}
            style={isSelected ? { borderColor: color } : {}}
          >
            <div className="text-xs font-semibold text-gray-700 truncate">{ROUTE_LABELS[i]}</div>
            <div
              className="text-lg font-bold leading-tight mt-0.5"
              style={{ color }}
            >
              {r.happyScore}
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5 truncate">
              {fmtDist(r.distance, useMetric)}
            </div>
            {(isBest || typeLabel) && (
              <div className="mt-0.5 text-[9px] font-bold truncate" style={{ color }}>
                {isBest ? "Happiest ★" : typeLabel}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── GPX export ───────────────────────────────────────────────────────────────

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

// ─── Score breakdown bar ──────────────────────────────────────────────────────

const BREAKDOWN_SEGMENTS: {
  key: keyof Omit<ScoreBreakdown, "rapids" | "elevation" | "motorBoat">;
  color: string;
  label: string;
}[] = [
  { key: "parks",     color: "bg-emerald-400", label: "Parks" },
  { key: "waterways", color: "bg-blue-400",    label: "Waterways" },
  { key: "water",     color: "bg-sky-400",     label: "Water" },
  { key: "green",     color: "bg-lime-400",    label: "Green" },
  { key: "calmWater", color: "bg-sky-300",     label: "Calm Water" },
  { key: "launch",    color: "bg-teal-400",    label: "Launch" },
  { key: "portage",   color: "bg-indigo-300",  label: "Portage" },
  { key: "lit",       color: "bg-amber-400",   label: "Lit" },
  { key: "base",      color: "bg-gray-300",    label: "Base" },
];

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
              title={`${key}: +${val} pts`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
        {BREAKDOWN_SEGMENTS.filter(({ key }) => breakdown[key] > 0 && key !== "base").map(
          ({ key, color, label }) => (
            <span key={key} className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className={`w-2 h-2 rounded-full ${color} inline-block`} />
              {label} +{breakdown[key]}
            </span>
          )
        )}
        {breakdown.rapids > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-orange-500">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            Rapids −{breakdown.rapids}
          </span>
        )}
        {breakdown.motorBoat > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-red-500">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            Motorboat −{breakdown.motorBoat}
          </span>
        )}
        {breakdown.elevation > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-300 inline-block" />
            Hilly −{breakdown.elevation}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Signal badge ─────────────────────────────────────────────────────────────

function Badge({ show, bg, label }: { show: boolean; bg: string; label: string }) {
  if (!show) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bg}`}>{label}</span>
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
  useMetric: boolean;
}

export default function RoutePanel({
  routes,
  selectedRouteId,
  bestRouteId,
  explanation,
  onSelectRoute,
  startName,
  endName,
  useMetric,
}: RoutePanelProps) {
  const selectedRoute = routes.find((r) => r.id === selectedRouteId);

  // Pre-compute type labels once (avoids O(n²) re-computation in the render loop)
  const routeTypeLabels = new Map(
    routes.map((r) => [r.id, getRouteTypeLabel(r, routes)])
  );

  return (
    <div className="space-y-5">
      {/* ── Happy Route summary card ── */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl" aria-hidden>🌿</span>
          <h2 className="font-bold text-emerald-900 text-base leading-tight">Happy Route Found!</h2>
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
                <li key={i} className="flex gap-2 text-sm text-emerald-800 leading-snug">
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

      {/* ── Route comparison strip (2+ routes) ── */}
      <ComparisonStrip
        routes={routes}
        selectedRouteId={selectedRouteId}
        bestRouteId={bestRouteId}
        onSelect={onSelectRoute}
        useMetric={useMetric}
      />

      {/* ── Route cards ── */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
          All routes — click to highlight on map
        </p>

        {routes.map((route, i) => {
          const isSelected = route.id === selectedRouteId;
          const isBest = route.id === bestRouteId;
          const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
          const typeLabel = routeTypeLabels.get(route.id) ?? null;
          const calories = estimateCalories(route.duration);
          const co2 = estimateCO2Saved(route.distance);

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
              {/* Header */}
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
                  {!isBest && typeLabel && (
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                      {typeLabel}
                    </span>
                  )}
                </div>
                <HappyScore score={route.happyScore} size="sm" />
              </div>

              {/* Stats */}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                <span>📏 {fmtDist(route.distance, useMetric)}</span>
                <span>⏱ {fmtTime(route.duration)}</span>
                {route.elevationGainM != null && (
                  <span className="text-amber-600">{fmtElev(route.elevationGainM, useMetric)}</span>
                )}
                <span title="Estimated calories burned paddling (70 kg paddler)">🔥 ~{calories} kcal</span>
                <span title="CO₂ saved vs driving to the put-in" className="text-emerald-600">
                  🌱 saves ~{co2} CO₂
                </span>
              </div>

              {/* Score breakdown bar */}
              <ScoreBar breakdown={route.scoreBreakdown} total={route.happyScore} />

              {/* Signal badges */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge show={route.signals.parkCount > 0}       bg="bg-green-100 text-green-700"   label={`🌳 ${route.signals.parkCount} park${route.signals.parkCount !== 1 ? "s" : ""}`} />
                <Badge show={route.signals.waterCount > 0}      bg="bg-sky-100 text-sky-700"       label={`💧 ${route.signals.waterCount} water`} />
                <Badge show={route.signals.waterwayCount > 0}   bg="bg-blue-100 text-blue-700"     label={`🌊 ${route.signals.waterwayCount} waterways`} />
                <Badge show={route.signals.greenCount > 0}      bg="bg-lime-100 text-lime-700"     label={`🌿 ${route.signals.greenCount} green`} />
                <Badge show={route.signals.litCount > 0}        bg="bg-amber-100 text-amber-700"   label={`💡 ${route.signals.litCount} lit`} />
                <Badge show={route.signals.calmWaterCount > 0}  bg="bg-cyan-100 text-cyan-700"     label={`🏊 ${route.signals.calmWaterCount} calm water`} />
                <Badge show={route.signals.launchCount > 0}     bg="bg-teal-100 text-teal-700"     label={`⛵ ${route.signals.launchCount} launches`} />
                <Badge show={route.signals.portageCount > 0}    bg="bg-indigo-100 text-indigo-600" label={`🛶 ${route.signals.portageCount} portage`} />
                <Badge show={route.signals.motorBoatCount > 0}  bg="bg-red-100 text-red-600"       label={`🚤 ${route.signals.motorBoatCount} motorboats`} />
                <Badge show={route.signals.rapidCount > 0}      bg="bg-orange-100 text-orange-700" label={`🌀 ${route.signals.rapidCount} rapids`} />
                {route.signals.partial && (
                  <Badge show bg="bg-gray-100 text-gray-400" label="~ partial data" />
                )}
                {!route.signals.parkCount && !route.signals.waterCount &&
                  !route.signals.waterwayCount && !route.signals.greenCount &&
                  !route.signals.litCount && !route.signals.calmWaterCount &&
                  !route.signals.launchCount && (
                    <span className="text-xs text-gray-400 italic">
                      No nearby waterway features found
                    </span>
                  )}
              </div>

              {/* GPX export */}
              {isSelected && (
                <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); exportGPX(route, startName, endName); }}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 transition-colors font-medium"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export GPX for GPS device
                  </button>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Elevation profile for selected route ── */}
      {selectedRoute && (
        selectedRoute.elevationPoints && selectedRoute.elevationPoints.length >= 2 && selectedRoute.elevationGainM != null
          ? <ElevationProfile
              points={selectedRoute.elevationPoints}
              gainM={selectedRoute.elevationGainM}
              distanceMi={selectedRoute.distance / 1609.344}
              useMetric={useMetric}
            />
          : <p className="text-xs text-gray-400 text-center py-2">Elevation data unavailable</p>
      )}
    </div>
  );
}
