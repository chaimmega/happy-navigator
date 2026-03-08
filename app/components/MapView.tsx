"use client";

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { GoogleMap, Polyline, Marker, InfoWindow } from "@react-google-maps/api";
import type { ScoredRoute, Coordinates } from "../types";
import { ROUTE_COLORS, ROUTE_LABELS } from "../lib/constants";

const MAP_CONTAINER_STYLE = { height: "100%", width: "100%" };

// ─── Main component ────────────────────────────────────────────────────────

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
  const mapRef = useRef<google.maps.Map | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

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

  // Fit bounds when routes change
  useEffect(() => {
    if (!mapRef.current || !routes.length) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: startCoords.lat, lng: startCoords.lng });
    bounds.extend({ lat: endCoords.lat, lng: endCoords.lng });

    routes.forEach((r) =>
      r.geometry.forEach(([lng, lat]) => bounds.extend({ lat, lng }))
    );

    mapRef.current.fitBounds(bounds, { top: 48, bottom: 48, left: 48, right: 48 });
  }, [routes, startCoords, endCoords]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (onMapClick && e.latLng) {
        onMapClick(e.latLng.lat(), e.latLng.lng());
      }
    },
    [onMapClick]
  );



  return (
    <div className="relative h-full w-full">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={{ lat: startCoords.lat, lng: startCoords.lng }}
        zoom={13}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          draggableCursor: onMapClick ? "crosshair" : undefined,
        }}
        onLoad={(map) => { mapRef.current = map; }}
        onClick={onMapClick ? handleMapClick : undefined}
      >
        {/* Route polylines */}
        {renderOrder.map((route) => {
          const index = indexById.get(route.id) ?? 0;
          const isSelected = route.id === selectedRouteId;
          const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
          const path = route.geometry.map(([lng, lat]) => ({ lat, lng }));

          return (
            <Polyline
              key={route.id}
              path={path}
              options={{
                strokeColor: color,
                strokeWeight: isSelected ? 7 : 3,
                strokeOpacity: isSelected ? 0.95 : 0.35,
                clickable: true,
                zIndex: isSelected ? 10 : 1,
              }}
              onClick={() => {
                handleSelect(route.id);
                setActiveTooltip(route.id);
              }}
              onMouseOver={() => setActiveTooltip(route.id)}
              onMouseOut={() => setActiveTooltip(null)}
            />
          );
        })}

        {/* Route tooltip on hover */}
        {activeTooltip !== null && (() => {
          const route = routes.find((r) => r.id === activeTooltip);
          if (!route || !route.geometry.length) return null;
          const midIdx = Math.floor(route.geometry.length / 2);
          const [lng, lat] = route.geometry[midIdx];
          const index = indexById.get(route.id) ?? 0;
          const label = ROUTE_LABELS[index % ROUTE_LABELS.length];
          return (
            <InfoWindow
              position={{ lat, lng }}
              options={{ disableAutoPan: true, pixelOffset: new google.maps.Size(0, -10) }}
              onCloseClick={() => setActiveTooltip(null)}
            >
              <div className="text-xs font-medium text-gray-700 whitespace-nowrap">
                {label} — Score: {route.happyScore}/100
              </div>
            </InfoWindow>
          );
        })()}

        {/* Start marker — green */}
        <Marker
          position={{ lat: startCoords.lat, lng: startCoords.lng }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#22c55e",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2.5,
          }}
          label={{
            text: "S",
            color: "#fff",
            fontSize: "10px",
            fontWeight: "bold",
          }}
          title="Start"
        />

        {/* End marker — red */}
        <Marker
          position={{ lat: endCoords.lat, lng: endCoords.lng }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2.5,
          }}
          label={{
            text: "E",
            color: "#fff",
            fontSize: "10px",
            fontWeight: "bold",
          }}
          title="End"
        />
      </GoogleMap>

      {onMapClick && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm rounded-full px-3 py-1 text-xs text-gray-500 pointer-events-none">
          Click map to set location
        </div>
      )}
    </div>
  );
}
