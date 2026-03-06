"use client";

interface ElevationProfileProps {
  points: number[];   // elevation values in metres, sampled along route
  gainM: number;      // total ascent in metres
  distanceKm: number;
}

/**
 * Lightweight SVG elevation profile chart.
 * No external dependencies — renders a filled area chart from raw elevation points.
 */
export default function ElevationProfile({ points, gainM, distanceKm }: ElevationProfileProps) {
  if (points.length < 2) return null;

  const W = 240;
  const H = 48;
  const PADDING = 2;

  const minE = Math.min(...points);
  const maxE = Math.max(...points);
  const range = Math.max(maxE - minE, 5); // avoid flat-line issues on pancake routes

  const xs = points.map((_, i) => (i / (points.length - 1)) * W);
  const ys = points.map((e) => H - PADDING - ((e - minE) / range) * (H - PADDING * 2));

  const linePath = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          Elevation profile
        </span>
        <span className="text-xs font-semibold text-amber-600">
          ↑ {Math.round(gainM)} m gain
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 48 }}
        aria-label={`Elevation profile: ${Math.round(gainM)} m total ascent over ${distanceKm.toFixed(1)} km`}
      >
        {/* Area fill */}
        <path d={areaPath} fill="#10b981" opacity={0.15} />
        {/* Line */}
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
          {Math.round(minE)}–{Math.round(maxE)} m elevation
        </span>
        <span>{distanceKm.toFixed(1)} km</span>
      </div>
    </div>
  );
}
