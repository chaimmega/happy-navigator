"use client";

// Leaflet CSS must be imported in the client component that uses it.
// This component is always loaded via dynamic() with ssr:false.
import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useCallback, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { ScoredRoute, Coordinates } from "../types";
import { ROUTE_COLORS, ROUTE_LABELS } from "../lib/constants";

// ─── Tile layer configurations ─────────────────────────────────────────────────

const TILE_LAYERS = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    label: "Standard",
  },
  cyclosm: {
    url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.cyclosm.org">CyclOSM</a>',
    label: "CyclOSM",
  },
} as const;

type TileLayerKey = keyof typeof TILE_LAYERS;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes]);

  return null;
}

// ─── Map click handler ─────────────────────────────────────────────────────────

function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
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
      <Tooltip sticky>{`${label} — Score: ${route.happyScore}/100`}</Tooltip>
    </Polyline>
  );
}

// ─── Tile toggle button (rendered outside MapContainer to avoid Leaflet z-index) ─

function TileToggle({
  current,
  onChange,
}: {
  current: TileLayerKey;
  onChange: (key: TileLayerKey) => void;
}) {
  const next: TileLayerKey = current === "osm" ? "cyclosm" : "osm";
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`Switch to ${TILE_LAYERS[next].label} map`}
      className="absolute bottom-8 right-3 z-[1000] bg-white border border-gray-200 shadow-md rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
    >
      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      {TILE_LAYERS[next].label}
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface MapViewProps {
  routes: ScoredRoute[];
  selectedRouteId: number;
  startCoords: Coordinates;
  endCoords: Coordinates;
  onSelectRoute: (id: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
}

export default function MapView({
  routes,
  selectedRouteId,
  startCoords,
  endCoords,
  onSelectRoute,
  onMapClick,
}: MapViewProps) {
  const [tileLayer, setTileLayer] = useState<TileLayerKey>("osm");

  const indexById = useMemo(
    () => new Map(routes.map((r, i) => [r.id, i])),
    [routes]
  );

  const handleSelect = useCallback(
    (id: number) => onSelectRoute(id),
    [onSelectRoute]
  );

  const renderOrder = useMemo(
    () =>
      [...routes].sort((a, b) =>
        a.id === selectedRouteId ? 1 : b.id === selectedRouteId ? -1 : 0
      ),
    [routes, selectedRouteId]
  );

  const tile = TILE_LAYERS[tileLayer];

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[startCoords.lat, startCoords.lng]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer attribution={tile.attribution} url={tile.url} />

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
          pathOptions={{ fillColor: "#22c55e", color: "#fff", weight: 2.5, fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -12]} permanent>Start</Tooltip>
        </CircleMarker>

        {/* End marker — red */}
        <CircleMarker
          center={[endCoords.lat, endCoords.lng]}
          radius={9}
          pathOptions={{ fillColor: "#ef4444", color: "#fff", weight: 2.5, fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -12]} permanent>End</Tooltip>
        </CircleMarker>

        <FitBounds routes={routes} startCoords={startCoords} endCoords={endCoords} />
        <MapClickHandler onMapClick={onMapClick} />
      </MapContainer>

      {/* Tile layer toggle — outside MapContainer to avoid Leaflet z-index conflicts */}
      <TileToggle current={tileLayer} onChange={setTileLayer} />

      {onMapClick && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm rounded-full px-3 py-1 text-xs text-gray-500 pointer-events-none">
          Click map to set location
        </div>
      )}
    </div>
  );
}
