"use client";

// Leaflet CSS must be imported in the client component that uses it.
// This component is always loaded via dynamic() with ssr:false.
import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { ScoredRoute, Coordinates } from "../types";
import { ROUTE_COLORS, ROUTE_LABELS } from "../lib/constants";

// ─── Auto-fit bounds helper ────────────────────────────────────────────────────

function FitBounds({
  routes,
  startCoords,
  endCoords,
}: {
  routes: ScoredRoute[];
  startCoords: Coordinates;
  endCoords: Coordinates;
}) {
  const map = useMap();

  useEffect(() => {
    if (!routes.length) return;

    const points: [number, number][] = [
      [startCoords.lat, startCoords.lng],
      [endCoords.lat, endCoords.lng],
      ...routes.flatMap((r) =>
        r.geometry.map(([lng, lat]) => [lat, lng] as [number, number])
      ),
    ];

    map.fitBounds(points as [number, number][], { padding: [48, 48] });
    // Only refit when the set of routes changes, not on every selectedRouteId change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes]);

  return null;
}

// ─── Single route polyline ─────────────────────────────────────────────────────

function RoutePolyline({
  route,
  index,
  isSelected,
  onSelect,
}: {
  route: ScoredRoute;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
  const label = ROUTE_LABELS[index % ROUTE_LABELS.length];

  // Memoize the coordinate conversion — [lng,lat] → [lat,lng]
  const positions = useMemo(
    () => route.geometry.map(([lng, lat]) => [lat, lng] as [number, number]),
    [route.geometry]
  );

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color,
        weight: isSelected ? 7 : 3,
        opacity: isSelected ? 0.95 : 0.35,
        lineCap: "round",
        lineJoin: "round",
      }}
      eventHandlers={{ click: onSelect }}
    >
      {/* Plain string content — Leaflet tooltips render outside React DOM */}
      <Tooltip sticky>{`${label} — Score: ${route.happyScore}/100`}</Tooltip>
    </Polyline>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface MapViewProps {
  routes: ScoredRoute[];
  selectedRouteId: number;
  startCoords: Coordinates;
  endCoords: Coordinates;
  onSelectRoute: (id: number) => void;
}

export default function MapView({
  routes,
  selectedRouteId,
  startCoords,
  endCoords,
  onSelectRoute,
}: MapViewProps) {
  // Build a stable id→originalIndex map once — used for consistent color/label assignment
  const indexById = useMemo(
    () => new Map(routes.map((r, i) => [r.id, i])),
    [routes]
  );

  // Stable handler to avoid new function references on every render
  const handleSelect = useCallback(
    (id: number) => onSelectRoute(id),
    [onSelectRoute]
  );

  // Render order: unselected first, selected last so it draws on top in SVG stacking
  const renderOrder = useMemo(
    () =>
      [...routes].sort((a, b) =>
        a.id === selectedRouteId ? 1 : b.id === selectedRouteId ? -1 : 0
      ),
    [routes, selectedRouteId]
  );

  return (
    <MapContainer
      center={[startCoords.lat, startCoords.lng]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {renderOrder.map((route) => (
        <RoutePolyline
          key={route.id}
          route={route}
          index={indexById.get(route.id) ?? 0}
          isSelected={route.id === selectedRouteId}
          onSelect={() => handleSelect(route.id)}
        />
      ))}

      {/* Start marker — green */}
      <CircleMarker
        center={[startCoords.lat, startCoords.lng]}
        radius={9}
        pathOptions={{
          fillColor: "#22c55e",
          color: "#fff",
          weight: 2.5,
          fillOpacity: 1,
        }}
      >
        <Tooltip direction="top" offset={[0, -12]} permanent>
          Start
        </Tooltip>
      </CircleMarker>

      {/* End marker — red */}
      <CircleMarker
        center={[endCoords.lat, endCoords.lng]}
        radius={9}
        pathOptions={{
          fillColor: "#ef4444",
          color: "#fff",
          weight: 2.5,
          fillOpacity: 1,
        }}
      >
        <Tooltip direction="top" offset={[0, -12]} permanent>
          End
        </Tooltip>
      </CircleMarker>

      <FitBounds
        routes={routes}
        startCoords={startCoords}
        endCoords={endCoords}
      />
    </MapContainer>
  );
}

