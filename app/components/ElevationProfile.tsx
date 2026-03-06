"use client";

interface ElevationProfileProps {
  points: number[];    // elevation values in metres (raw from API), sampled along route
  gainM: number;       // total ascent in metres (raw from API)
  distanceMi: number;  // route distance in miles
  useMetric?: boolean;
}

const M_TO_FT = 3.28084;

/**
 * Lightweight SVG elevation profile chart.
 * Displays in user-preferred units (metric or imperial).
 */
export default function ElevationProfile({ points, gainM, distanceMi, useMetric = false }: ElevationProfileProps) {
  if (points.length < 2) return null;

  const W = 240;
  const H = 48;
  const PADDING = 2;

  // Convert to display units
  const ptsDisplay = useMetric ? points : points.map((m) => m * M_TO_FT);
  const minDisplay = Math.min(...ptsDisplay);
  const maxDisplay = Math.max(...ptsDisplay);
  const range = Math.max(maxDisplay - minDisplay, useMetric ? 3 : 10);

  const xs = ptsDisplay.map((_, i) => (i / (ptsDisplay.length - 1)) * W);
  const ys = ptsDisplay.map((e) => H - PADDING - ((e - minDisplay) / range) * (H - PADDING * 2));

  const linePath = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;

  const gainDisplay = useMetric ? Math.round(gainM) : Math.round(gainM * M_TO_FT);
  const gainUnit = useMetric ? "m" : "ft";
  const distDisplay = useMetric ? (distanceMi * 1.60934).toFixed(1) : distanceMi.toFixed(1);
  const distUnit = useMetric ? "km" : "mi";
  const elevUnit = useMetric ? "m" : "ft";

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          Elevation profile
        </span>
        <span className="text-xs font-semibold text-amber-600">
          ↑ {gainDisplay} {gainUnit} gain
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 48 }}
        aria-label={`Elevation profile: ${gainDisplay} ${gainUnit} total ascent over ${distDisplay} ${distUnit}`}
      >
        <path d={areaPath} fill="#10b981" opacity={0.15} />
        <path
          d={linePath}
          stroke="#059669"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
        <span>Start</span>
        <span>
          {Math.round(minDisplay)}–{Math.round(maxDisplay)} {elevUnit}
        </span>
        <span>{distDisplay} {distUnit}</span>
      </div>
    </div>
  );
}
