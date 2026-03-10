"use client";

import { useState, useRef, useCallback } from "react";
import { formatElevation } from "../types";

interface ElevationChartProps {
  points: number[];
  gainM: number;
  metric: boolean;
  totalDistanceM: number;
}

export default function ElevationChart({ points, gainM, metric, totalDistanceM }: ElevationChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 320;
  const height = 100;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 20;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = (x - padLeft) / chartWidth;
    const index = Math.round(ratio * (points.length - 1));
    if (index >= 0 && index < points.length) {
      setHoverIndex(index);
    }
  }, [points.length, chartWidth]);

  if (points.length < 2) return null;

  const minElev = Math.min(...points);
  const maxElev = Math.max(...points);
  const range = maxElev - minElev || 1;

  const getX = (i: number) => padLeft + (i / (points.length - 1)) * chartWidth;
  const getY = (v: number) => padTop + chartHeight - ((v - minElev) / range) * chartHeight;

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p)}`).join(" ");
  const areaD = `${pathD} L ${getX(points.length - 1)} ${padTop + chartHeight} L ${getX(0)} ${padTop + chartHeight} Z`;

  const elevLabel = metric ? "m" : "ft";
  const hoverElev = hoverIndex !== null
    ? metric ? points[hoverIndex] : Math.round(points[hoverIndex] * 3.28084)
    : null;
  const hoverDist = hoverIndex !== null
    ? ((hoverIndex / (points.length - 1)) * totalDistanceM / (metric ? 1000 : 1609.344)).toFixed(1)
    : null;

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">Elevation Profile</h4>
        <span className="text-xs font-medium text-amber">{formatElevation(gainM, metric)}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(160, 84%, 39%)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(160, 84%, 39%)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#elevFill)" />
        <path d={pathD} fill="none" stroke="hsl(160, 84%, 39%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hoverIndex !== null && (
          <>
            <line
              x1={getX(hoverIndex)} y1={padTop}
              x2={getX(hoverIndex)} y2={padTop + chartHeight}
              stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="3,3"
            />
            <circle cx={getX(hoverIndex)} cy={getY(points[hoverIndex])} r="3.5" fill="hsl(160, 84%, 39%)" stroke="white" strokeWidth="2" />
          </>
        )}
        <text x={padLeft} y={height - 3} fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="system-ui">Start</text>
        <text x={width - padRight} y={height - 3} fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="system-ui" textAnchor="end">End</text>
      </svg>
      {hoverIndex !== null && hoverElev !== null && (
        <div className="mt-1 text-center text-[10px] text-muted-foreground">
          {hoverElev} {elevLabel} &middot; {hoverDist} {metric ? "km" : "mi"}
        </div>
      )}
    </div>
  );
}
