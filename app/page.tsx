"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import GoogleMapsProvider from "./components/GoogleMapsProvider";
import SearchForm, { saveRecentSearch } from "./components/SearchForm";
import RoutePanel from "./components/RoutePanel";
import type { NavigateResponse } from "./types";
import type { PlaceValue } from "./components/PlaceAutocomplete";

const MapView = dynamic(() => import("./components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-400 text-sm">Loading map…</p>
    </div>
  ),
});

// ─── Animated loading steps ───────────────────────────────────────────────────

const LOADING_STEPS = [
  { label: "Geocoding your locations…",           icon: "📍" },
  { label: "Fetching canoe route alternatives…",   icon: "🚣" },
  { label: "Scanning waterways, parks & portage points…", icon: "🌿" },
  { label: "AI is finding your happiest route…",  icon: "✨" },
];

function LoadingSteps({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) { setStep(0); return; }
    const timers = LOADING_STEPS.map((_, i) =>
      setTimeout(() => setStep(i), i * 4500)
    );
    return () => timers.forEach(clearTimeout);
  }, [active]);

  if (!active) return null;

  return (
    <div className="flex-1 flex flex-col justify-center px-6 gap-4">
      <div className="space-y-2">
        {LOADING_STEPS.map((s, i) => {
          const done    = i < step;
          const current = i === step;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-opacity duration-500 ${
                i > step ? "opacity-20" : "opacity-100"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                  done ? "bg-emerald-100 text-emerald-600" :
                  current ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={
                  current ? "text-gray-800 font-medium" :
                  done    ? "text-gray-400 line-through" : "text-gray-400"
                }
              >
                {s.label}
              </span>
              {current && <span className="text-base animate-pulse">{s.icon}</span>}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 italic pl-9">
        First search takes 15–20 seconds — free APIs at work!
      </p>
    </div>
  );
}

// ─── Empty map placeholder ────────────────────────────────────────────────────

function MapPlaceholder() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400 select-none bg-gray-50">
      <div className="text-7xl mb-4 opacity-50" aria-hidden>🗺️</div>
      <p className="text-lg font-semibold text-gray-500">Enter locations to find your happy route</p>
      <p className="text-sm mt-1.5 text-gray-400 text-center max-w-xs leading-relaxed">
        We score each route by waterways, parks, calm water, lighting, portage difficulty and motorboat traffic
        — then ask AI to explain why one is happiest.
      </p>
    </div>
  );
}

// ─── Metric toggle button ─────────────────────────────────────────────────────

function MetricToggle({ useMetric, onToggle }: { useMetric: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Switch to ${useMetric ? "imperial" : "metric"} units`}
      className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1 bg-white hover:bg-gray-50 transition-colors"
    >
      <span className={useMetric ? "text-emerald-600 font-bold" : ""}>km</span>
      <span className="text-gray-300">/</span>
      <span className={!useMetric ? "text-emerald-600 font-bold" : ""}>mi</span>
    </button>
  );
}

// ─── Map pin mode banner ──────────────────────────────────────────────────────

function PinModeBanner({ target, onCancel }: { target: "start" | "end"; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
      <span className="animate-pulse">📍</span>
      <span className="flex-1">Click on the map to set the <strong>{target}</strong> location</span>
      <button
        type="button"
        onClick={onCancel}
        className="text-emerald-500 hover:text-emerald-700 font-bold leading-none"
      >
        ×
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [result, setResult]               = useState<NavigateResponse | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(0);
  const [useMetric, setUseMetric]         = useState(false);
  const [mapPinTarget, setMapPinTarget]   = useState<"start" | "end" | null>(null);
  const [mapPinPlace, setMapPinPlace]     = useState<PlaceValue | undefined>(undefined);
  const [pinLoading, setPinLoading]       = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // Load saved metric preference
  useEffect(() => {
    try {
      setUseMetric(localStorage.getItem("happynav_metric") === "true");
    } catch { /* ignore */ }
  }, []);

  const toggleMetric = () => {
    setUseMetric((v) => {
      try { localStorage.setItem("happynav_metric", String(!v)); } catch { /* ignore */ }
      return !v;
    });
  };

  const handleSubmit = async (data: {
    start: string;
    end: string;
    startCoords?: { lat: number; lng: number };
    endCoords?: { lat: number; lng: number };
    googleMapsUrl?: string;
    via?: { text: string; coords?: { lat: number; lng: number } };
  }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResult(null);

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

      // Save to recent searches
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
        to:   `${nav.endCoords.lat},${nav.endCoords.lng}`,
      });
      window.history.replaceState(null, "", `?${params.toString()}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Network error — please check your connection and try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  // Auto-search from URL params (shareable links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const to   = params.get("to");
    if (!from || !to) return;

    const [fromLat, fromLng] = from.split(",").map(Number);
    const [toLat,   toLng]   = to.split(",").map(Number);
    if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) return;

    handleSubmit({
      start: from,
      end:   to,
      startCoords: { lat: fromLat, lng: fromLng },
      endCoords:   { lat: toLat,   lng: toLng   },
    });
  }, []); // intentionally run once on mount

  // Handle map click: reverse geocode the point then set as start/end
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

  return (
    <GoogleMapsProvider>
    <main className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <span className="text-3xl" aria-hidden>🛶</span>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight truncate">
            Happy Navigator
          </h1>
          <p className="text-xs text-gray-400 leading-tight hidden sm:block">
            Score canoe routes by waterways, parks &amp; scenic paddling
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <MetricToggle useMetric={useMetric} onToggle={toggleMetric} />
          {/* Map pin mode buttons — only shown when routes are displayed */}
          {result && !mapPinTarget && (
            <div className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMapPinTarget("start")}
                title="Click map to set start location"
                className="text-[10px] text-gray-400 hover:text-emerald-600 border border-gray-200 rounded px-1.5 py-1 transition-colors bg-white"
              >
                📍 Pin start
              </button>
              <button
                type="button"
                onClick={() => setMapPinTarget("end")}
                title="Click map to set end location"
                className="text-[10px] text-gray-400 hover:text-emerald-600 border border-gray-200 rounded px-1.5 py-1 transition-colors bg-white"
              >
                📍 Pin end
              </button>
            </div>
          )}
          {pinLoading && (
            <span className="text-xs text-gray-400 animate-pulse">Locating…</span>
          )}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Google Maps
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + map ── */}
      {/* On mobile: flex-col (sidebar on top), on desktop: flex-row */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">

        {/* Sidebar */}
        {/* Mobile: fixed height so map is visible below; scrolls as a unit.
            Desktop: full height with split-scroll sections. */}
        <aside className="w-full md:w-[22rem] flex-shrink-0 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col h-[46vh] md:h-auto overflow-y-auto md:overflow-hidden">

          {/* Search form — always visible */}
          <div className="p-4 md:p-5 border-b border-gray-100 flex-shrink-0">
            <SearchForm
              onSubmit={handleSubmit}
              loading={loading}
              mapPinPlace={mapPinPlace}
              mapPinTarget={mapPinTarget ?? undefined}
              onClearMapPin={cancelMapPin}
            />

            {/* Map pin mode banner */}
            {mapPinTarget && (
              <PinModeBanner target={mapPinTarget} onCancel={cancelMapPin} />
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex gap-2 items-start">
                <span className="flex-shrink-0 mt-0.5">⚠️</span>
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                  className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors leading-none text-base"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Loading steps */}
          <LoadingSteps active={loading} />

          {/* Results */}
          {result && !loading && (
            <div className="flex-1 overflow-y-auto p-4 md:p-5 min-h-0 sidebar-scroll">
              <RoutePanel
                routes={result.routes}
                selectedRouteId={selectedRouteId}
                bestRouteId={result.bestRouteId}
                explanation={result.explanation}
                onSelectRoute={setSelectedRouteId}
                startName={result.startName}
                endName={result.endName}
                useMetric={useMetric}
              />
            </div>
          )}

          {/* Idle hint */}
          {!result && !loading && !error && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2 text-gray-400">
              <span className="text-4xl" aria-hidden>🚣</span>
              <p className="text-sm text-gray-500">Enter put-in and take-out locations to begin.</p>
              <p className="text-xs">
                Try: <em>put-in</em> → <em>take-out</em>
              </p>
            </div>
          )}
        </aside>

        {/* Map — flex-1 fills remaining height on desktop; min-h-[200px] on mobile */}
        <div className={`flex-1 min-h-[200px] md:min-h-0 relative${mapPinTarget ? " map-pin-mode" : ""}`}>
          {result ? (
            <MapView
              routes={result.routes}
              selectedRouteId={selectedRouteId}
              startCoords={result.startCoords}
              endCoords={result.endCoords}
              onSelectRoute={setSelectedRouteId}
              onMapClick={mapPinTarget ? handleMapClick : undefined}
            />
          ) : (
            <MapPlaceholder />
          )}
        </div>
      </div>
    </main>
    </GoogleMapsProvider>
  );
}
