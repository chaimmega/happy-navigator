"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import GoogleMapsProvider from "./components/GoogleMapsProvider";
import SearchForm, { saveRecentSearch } from "./components/SearchForm";
import { Header } from "./components/Header";
import { RouteCard } from "./components/RouteCard";
import { AISummaryCard } from "./components/AISummaryCard";
import { LoadingSteps } from "./components/LoadingSteps";
import ElevationChart from "./components/ElevationProfile";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./components/ui/resizable";
import { motion, AnimatePresence } from "framer-motion";
import { ROUTE_COLORS, ROUTE_NAMES } from "./lib/constants";
import { formatDistance } from "./types";
import type { NavigateResponse } from "./types";
import type { PlaceValue } from "./components/PlaceAutocomplete";

const MapView = dynamic(() => import("./components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-accent to-secondary">
      <p className="text-muted-foreground text-sm">Loading map...</p>
    </div>
  ),
});

// ─── Map placeholder ─────────────────────────────────────────────────────────

function MapPlaceholder() {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-secondary overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `
          linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
          linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />
      <div className="text-center space-y-4 relative z-10 max-w-sm px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center"
        >
          <span className="text-4xl">🚗</span>
        </motion.div>
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <h2 className="text-xl font-bold text-foreground tracking-tight">Your happy route awaits</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Enter start and destination to discover the most scenic, stress-free route — scored for parks, waterfront views, and green spaces.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function IdleHint() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex flex-1 flex-col items-center justify-center text-center px-8 gap-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <span className="text-3xl">🗺️</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Enter your start and end locations</p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-[18rem] mx-auto">
          We&apos;ll find alternative routes and score them for scenic roads, parks, waterfront, and overall enjoyment.
        </p>
      </div>
    </motion.div>
  );
}

function PinModeBanner({ target, onCancel }: { target: "start" | "end"; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-xs text-primary">
      <span className="animate-pulse">📍</span>
      <span className="flex-1">Click on the map to set the <strong>{target}</strong> location</span>
      <button type="button" onClick={onCancel} className="text-primary hover:text-primary/70 font-bold leading-none">
        ×
      </button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Home() {
  const [result, setResult] = useState<NavigateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState(0);
  const [metric, setMetric] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mapPinTarget, setMapPinTarget] = useState<"start" | "end" | null>(null);
  const [mapPinPlace, setMapPinPlace] = useState<PlaceValue | undefined>(undefined);
  const [pinLoading, setPinLoading] = useState(false);
  const [formStart, setFormStart] = useState<PlaceValue | undefined>(undefined);
  const [formEnd, setFormEnd] = useState<PlaceValue | undefined>(undefined);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("happynav_metric");
      if (saved !== null) setMetric(saved !== "false");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("happynav_metric", String(metric)); } catch { /* ignore */ }
  }, [metric]);

  const handleSearch = useCallback(async (data: {
    start: string;
    end: string;
    startCoords?: { lat: number; lng: number };
    endCoords?: { lat: number; lng: number };
    via?: { text: string; coords?: { lat: number; lng: number } };
  }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadingStep(0);
    setError(null);
    setResult(null);

    // Animate loading steps
    const stepDurations = [800, 4000, 8000, 12000];
    const timers = stepDurations.map((dur, i) =>
      setTimeout(() => setLoadingStep(i), dur)
    );

    try {
      const res = await fetch("/api/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }

      const nav = json as NavigateResponse;
      setResult(nav);
      setSelectedRouteId(nav.bestRouteId);

      setFormStart({ text: nav.startName, coords: nav.startCoords });
      setFormEnd({ text: nav.endName, coords: nav.endCoords });

      if (nav.startCoords && nav.endCoords) {
        saveRecentSearch({
          startName: nav.startName,
          endName: nav.endName,
          startCoords: nav.startCoords,
          endCoords: nav.endCoords,
        });
      }

      // Update URL for shareability
      const params = new URLSearchParams({
        from: `${nav.startCoords.lat},${nav.startCoords.lng}`,
        to: `${nav.endCoords.lat},${nav.endCoords.lng}`,
      });
      window.history.replaceState(null, "", `?${params.toString()}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Network error — please check your connection and try again.");
    } finally {
      timers.forEach(clearTimeout);
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // Auto-search from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const to = params.get("to");
    if (!from || !to) return;

    const [fromLat, fromLng] = from.split(",").map(Number);
    const [toLat, toLng] = to.split(",").map(Number);
    if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) return;

    handleSearch({
      start: from,
      end: to,
      startCoords: { lat: fromLat, lng: fromLng },
      endCoords: { lat: toLat, lng: toLng },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle map click for pin mode
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!mapPinTarget) return;
    setPinLoading(true);
    try {
      const res = await fetch(`/api/reverse?lat=${lat}&lng=${lng}`);
      const data: { name: string; lat: number; lng: number } = await res.json();
      setMapPinPlace({ text: data.name, coords: { lat: data.lat, lng: data.lng } });
    } catch {
      setMapPinPlace({
        text: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        coords: { lat, lng },
      });
    } finally {
      setPinLoading(false);
      setMapPinTarget(null);
    }
  }, [mapPinTarget]);

  const cancelMapPin = () => {
    setMapPinTarget(null);
    setMapPinPlace(undefined);
  };

  const selectedRoute = result?.routes.find((r) => r.id === selectedRouteId);

  const sidebarContent = (
    <div className="p-5 space-y-5">
      <SearchForm
        onSubmit={handleSearch}
        loading={loading}
        mapPinPlace={mapPinPlace}
        mapPinTarget={mapPinTarget ?? undefined}
        onClearMapPin={cancelMapPin}
        initialStart={formStart}
        initialEnd={formEnd}
      />

      {mapPinTarget && (
        <PinModeBanner target={mapPinTarget} onCancel={cancelMapPin} />
      )}

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive flex gap-2 items-start">
          <span className="flex-shrink-0 mt-0.5">⚠️</span>
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="flex-shrink-0 text-destructive/50 hover:text-destructive transition-colors leading-none text-base"
          >
            ×
          </button>
        </div>
      )}

      <AnimatePresence>
        {loading && <LoadingSteps currentStep={loadingStep} />}
      </AnimatePresence>

      {result && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {result.explanation && (
            <AISummaryCard
              bullets={result.explanation.bullets}
              suggestedStops={result.explanation.suggestedStops}
              startName={result.startName}
              endName={result.endName}
            />
          )}

          <div className="h-px bg-border" />

          {/* Route comparison strip */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${result.routes.length}, 1fr)` }}>
            {result.routes.map((route) => {
              const isSelected = route.id === selectedRouteId;
              const isBest = route.id === result.bestRouteId;
              const color = ROUTE_COLORS[route.id];
              return (
                <button
                  key={route.id}
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`rounded-xl border-2 p-2.5 text-center transition-all ${
                    isSelected
                      ? "bg-card shadow-md"
                      : "border-transparent bg-muted/50 hover:bg-accent"
                  }`}
                  style={isSelected ? { borderColor: color + "50" } : {}}
                >
                  <p className="text-xs font-semibold text-foreground truncate">
                    {ROUTE_NAMES[route.id]}
                  </p>
                  <p className="text-lg font-bold mt-0.5" style={{ color }}>
                    {route.happyScore}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {formatDistance(route.distance, metric)}
                  </p>
                  {isBest && (
                    <p className="text-[9px] font-bold mt-0.5" style={{ color }}>
                      Happiest ★
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Route cards */}
          <div className="space-y-3">
            {result.routes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                isBest={route.id === result.bestRouteId}
                isSelected={route.id === selectedRouteId}
                metric={metric}
                onClick={() => setSelectedRouteId(route.id)}
                startName={result.startName}
                endName={result.endName}
              />
            ))}
          </div>

          {selectedRoute?.elevationPoints && selectedRoute.elevationPoints.length >= 2 && selectedRoute.elevationGainM != null && (
            <ElevationChart
              points={selectedRoute.elevationPoints}
              gainM={selectedRoute.elevationGainM}
              metric={metric}
              totalDistanceM={selectedRoute.distance}
            />
          )}
        </motion.div>
      )}

      {!result && !loading && !error && <IdleHint />}
    </div>
  );

  const mapContent = result ? (
    <MapView
      routes={result.routes}
      selectedRouteId={selectedRouteId}
      startCoords={result.startCoords}
      endCoords={result.endCoords}
      startName={result.startName}
      endName={result.endName}
      onSelectRoute={setSelectedRouteId}
      onMapClick={mapPinTarget ? handleMapClick : undefined}
    />
  ) : (
    <MapPlaceholder />
  );

  return (
    <GoogleMapsProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <Header
          metric={metric}
          onToggleMetric={() => setMetric((v) => !v)}
          result={result}
          mapPinTarget={mapPinTarget}
          pinLoading={pinLoading}
          onSetPinTarget={setMapPinTarget}
        />

        {isMobile ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-shrink-0 overflow-y-auto custom-scrollbar" style={{ maxHeight: "46vh" }}>
              {sidebarContent}
            </div>
            <div className="flex-1 min-h-[200px]">
              {mapContent}
            </div>
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={30} minSize={22} maxSize={45}>
              <div className="h-full overflow-y-auto custom-scrollbar">
                {sidebarContent}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70}>
              {mapContent}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </GoogleMapsProvider>
  );
}
