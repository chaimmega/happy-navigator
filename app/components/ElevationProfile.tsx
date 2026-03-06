"use client";

import { useState } from "react";

interface ElevationProfileProps {
  points: number[];    // elevation values in metres (raw from API), sampled along route
  gainM: number;       // total ascent in metres (raw from API)
  distanceMi: number;  // route distance in miles
  useMetric?: boolean;
}

const M_TO_FT = 3.28084;

/**
 * Interactive SVG elevation profile.
 * Hover over the chart to see elevation and distance at any point.
 */
export default function ElevationProfile({ points, gainM, distanceMi, useMetric = false }: ElevationProfileProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length < 2) return null;

  const W = 240;
  const H = 56;
  const PAD = 2;

  const ptsDisplay = useMetric ? points : points.map((m) => m * M_TO_FT);
  const minDisplay = Math.min(...ptsDisplay);
  const maxDisplay = Math.max(...ptsDisplay);
  const range = Math.max(maxDisplay - minDisplay, useMetric ? 3 : 10);

  const xs = ptsDisplay.map((_, i) => (i / (ptsDisplay.length - 1)) * W);
  const ys = ptsDisplay.map((e) => H - PAD - ((e - minDisplay) / range) * (H - PAD * 2));

  const linePath = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;

  const gainDisplay = useMetric ? Math.round(gainM) : Math.round(gainM * M_TO_FT);
  const gainUnit = useMetric ? "m" : "ft";
  const totalDist = useMetric ? distanceMi * 1.60934 : distanceMi;
  const distUnit = useMetric ? "km" : "mi";
  const elevUnit = useMetric ? "m" : "ft";

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(ratio * (ptsDisplay.length - 1));
    setHoverIdx(idx);
  };

  const hovered = hoverIdx !== null ? {
    x: xs[hoverIdx],
    y: ys[hoverIdx],
    elev: Math.round(ptsDisplay[hoverIdx]),
    dist: ((hoverIdx / (ptsDisplay.length - 1)) * totalDist).toFixed(1),
  } : null;

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

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-crosshair"
          style={{ height: 56 }}
          aria-label={`Elevation profile: ${gainDisplay} ${gainUnit} total ascent over ${totalDist.toFixed(1)} ${distUnit}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
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

          {/* Hover indicator */}
          {hovered && (
            <>
              <line
                x1={hovered.x} y1={PAD}
                x2={hovered.x} y2={H}
                stroke="#059669"
                strokeWidth="0.75"
                strokeDasharray="2,2"
              />
              <circle cx={hovered.x} cy={hovered.y} r="3" fill="#059669" />
            </>
          )}
        </svg>

        {/* Hover tooltip */}
        {hovered && (
          <div
            className="absolute top-0 pointer-events-none z-10 bg-gray-900/90 text-white text-[10px] rounded px-1.5 py-1 whitespace-nowrap"
            style={{
              left: `${(hoverIdx! / (ptsDisplay.length - 1)) * 100}%`,
              transform: hoverIdx! > ptsDisplay.length / 2 ? "translateX(-110%)" : "translateX(10%)",
            }}
          >
            {hovered.elev} {elevUnit} · {hovered.dist} {distUnit}
          </div>
        )}
      </div>

      <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
        <span>Start</span>
        <span>{Math.round(minDisplay)}–{Math.round(maxDisplay)} {elevUnit}</span>
        <span>{totalDist.toFixed(1)} {distUnit}</span>
      </div>
    </div>
  );
}
