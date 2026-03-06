"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import SearchForm from "./components/SearchForm";
import RoutePanel from "./components/RoutePanel";
import type { NavigateResponse } from "./types";

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
  { label: "Geocoding your locations…", icon: "📍" },
  { label: "Fetching bike route alternatives…", icon: "🛤️" },
  { label: "Scanning parks, cycleways & surfaces…", icon: "🌿" },
  { label: "AI is finding your happiest route…", icon: "✨" },
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
          const done = i < step;
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
                  done
                    ? "bg-emerald-100 text-emerald-600"
                    : current
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={
                  current
                    ? "text-gray-800 font-medium"
                    : done
                    ? "text-gray-400 line-through"
                    : "text-gray-400"
                }
              >
                {s.label}
              </span>
              {current && (
                <span className="text-base animate-pulse">{s.icon}</span>
              )}
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
      <div className="text-7xl mb-4 opacity-50" aria-hidden>
        🗺️
      </div>
      <p className="text-lg font-semibold text-gray-500">
        Enter locations to find your happy route
      </p>
      <p className="text-sm mt-1.5 text-gray-400 text-center max-w-xs leading-relaxed">
        We score each route by nearby parks, cycleways, water, lighting, and
        surface quality — then ask AI to explain why one is happiest.
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [result, setResult] = useState<NavigateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(0);
  // Ref to the current in-flight AbortController — lets us cancel stale requests
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async (data: {
    start: string;
    end: string;
    startCoords?: { lat: number; lng: number };
    endCoords?: { lat: number; lng: number };
    googleMapsUrl?: string;
  }) => {
    // Cancel any in-flight request from a previous submit
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

      // Update URL so the search is shareable — coords are the canonical form
      const params = new URLSearchParams({
        from: `${nav.startCoords.lat},${nav.startCoords.lng}`,
        to:   `${nav.endCoords.lat},${nav.endCoords.lng}`,
      });
      window.history.replaceState(null, "", `?${params.toString()}`);
    } catch (err) {
      // AbortError means a newer search superseded this one — silently discard
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Network error — please check your connection and try again.");
    } finally {
      // Only clear loading state if this request wasn't superseded
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  // Auto-search from URL params on first load (handles shareable links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const to   = params.get("to");
    if (!from || !to) return;

    const [fromLat, fromLng] = from.split(",").map(Number);
    const [toLat, toLng]     = to.split(",").map(Number);
    if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) return;

    handleSubmit({
      start: from,
      end:   to,
      startCoords: { lat: fromLat, lng: fromLng },
      endCoords:   { lat: toLat,   lng: toLng   },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  return (
    // h-screen + overflow-hidden gives flex children a defined height
    // so the map div can fill its parent with height:100%
    <main className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center gap-3 flex-shrink-0">
        <span className="text-3xl" aria-hidden>
          🚴
        </span>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            Happy Navigator
          </h1>
          <p className="text-xs text-gray-400 leading-tight">
            Score bike routes by parks, cycleways &amp; scenic spots
          </p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          Powered by OpenStreetMap + OSRM
        </div>
      </header>

      {/* ── Body: sidebar + map ── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-[22rem] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-0">
          <div className="p-5 border-b border-gray-100 flex-shrink-0">
            <SearchForm onSubmit={handleSubmit} loading={loading} />

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
            <div className="flex-1 overflow-y-auto p-5 min-h-0 sidebar-scroll">
              <RoutePanel
                routes={result.routes}
                selectedRouteId={selectedRouteId}
                bestRouteId={result.bestRouteId}
                explanation={result.explanation}
                onSelectRoute={setSelectedRouteId}
                startName={result.startName}
                endName={result.endName}
              />
            </div>
          )}

          {/* Idle hint */}
          {!result && !loading && !error && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2 text-gray-400">
              <span className="text-4xl" aria-hidden>
                🛤️
              </span>
              <p className="text-sm text-gray-500">
                Enter a start and end location to begin.
              </p>
              <p className="text-xs">
                Try: <em>Battersea Park</em> → <em>Southwark Bridge, London</em>
              </p>
            </div>
          )}
        </aside>

        {/* Map */}
        <div className="flex-1 min-h-0">
          {result ? (
            <MapView
              routes={result.routes}
              selectedRouteId={selectedRouteId}
              startCoords={result.startCoords}
              endCoords={result.endCoords}
              onSelectRoute={setSelectedRouteId}
            />
          ) : (
            <MapPlaceholder />
          )}
        </div>
      </div>
    </main>
  );
}
