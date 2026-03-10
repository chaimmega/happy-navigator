"use client";

import { useState, useEffect } from "react";
import { ArrowUpDown, Plus, Navigation, Search } from "lucide-react";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "framer-motion";
import PlaceAutocomplete, { type PlaceValue } from "./PlaceAutocomplete";

// ─── Recent searches ────────────────────────────────────────────────────────

const STORAGE_KEY = "happynav_recent";
const MAX_RECENT = 5;

interface RecentSearch {
  startName: string;
  endName: string;
  startCoords: { lat: number; lng: number };
  endCoords: { lat: number; lng: number };
}

function loadRecent(): RecentSearch[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveRecentSearch(entry: RecentSearch) {
  try {
    const existing = loadRecent().filter(
      (r) =>
        !(
          Math.abs(r.startCoords.lat - entry.startCoords.lat) < 0.0001 &&
          Math.abs(r.endCoords.lat - entry.endCoords.lat) < 0.0001
        )
    );
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([entry, ...existing].slice(0, MAX_RECENT))
    );
  } catch {
    // localStorage may be unavailable
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

interface SearchFormProps {
  onSubmit: (data: {
    start: string;
    end: string;
    startCoords?: { lat: number; lng: number };
    endCoords?: { lat: number; lng: number };
    googleMapsUrl?: string;
    via?: { text: string; coords?: { lat: number; lng: number } };
  }) => void;
  loading: boolean;
  mapPinPlace?: PlaceValue;
  mapPinTarget?: "start" | "end";
  onClearMapPin?: () => void;
  initialStart?: PlaceValue;
  initialEnd?: PlaceValue;
}

export default function SearchForm({
  onSubmit,
  loading,
  mapPinPlace,
  mapPinTarget,
  onClearMapPin,
  initialStart,
  initialEnd,
}: SearchFormProps) {
  const [startPlace, setStartPlace] = useState<PlaceValue>({ text: "" });
  const [endPlace, setEndPlace] = useState<PlaceValue>({ text: "" });
  const [viaPlace, setViaPlace] = useState<PlaceValue | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    setRecentSearches(loadRecent());
  }, []);

  useEffect(() => {
    if (initialStart) setStartPlace(initialStart);
  }, [initialStart]);
  useEffect(() => {
    if (initialEnd) setEndPlace(initialEnd);
  }, [initialEnd]);

  useEffect(() => {
    if (!mapPinPlace) return;
    if (mapPinTarget === "start") setStartPlace(mapPinPlace);
    else setEndPlace(mapPinPlace);
  }, [mapPinPlace, mapPinTarget]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const viaData =
      viaPlace && viaPlace.text.trim()
        ? { text: viaPlace.text, coords: viaPlace.coords }
        : undefined;

    onSubmit({
      start: startPlace.text,
      end: endPlace.text,
      startCoords: startPlace.coords,
      endCoords: endPlace.coords,
      via: viaData,
    });
    setShowRecent(false);
    onClearMapPin?.();
  };

  const canSubmit = !loading && startPlace.text.trim() !== "" && endPlace.text.trim() !== "";

  const handleSwap = () => {
    setStartPlace(endPlace);
    setEndPlace(startPlace);
  };

  const handleGps = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setStartPlace({ text: "My location", coords: { lat, lng } });
        setGpsLoading(false);
      },
      (err) => {
        const msg =
          err.code === err.TIMEOUT
            ? "Location timed out. Try again or enter an address."
            : "Location access denied. Enable it in browser settings.";
        setGpsError(msg);
        setGpsLoading(false);
      },
      { timeout: 8000 }
    );
  };

  const applyRecent = (r: RecentSearch) => {
    setStartPlace({ text: r.startName, coords: r.startCoords });
    setEndPlace({ text: r.endName, coords: r.endCoords });
    setViaPlace(null);
    setShowRecent(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative space-y-2">
        {/* From field */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
              <span className="text-[10px] font-bold text-primary-foreground">S</span>
            </div>
          </div>
          <PlaceAutocomplete
            id="start"
            placeholder="Starting point"
            value={startPlace}
            onChange={(v) => { setStartPlace(v); setGpsError(null); }}
            autoFocus
          />
          <button
            type="button"
            onClick={handleGps}
            disabled={gpsLoading}
            className="absolute right-10 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground z-10"
            title="Use my location"
          >
            {gpsLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent block" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </button>
        </div>

        {gpsError && <p className="text-xs text-destructive">{gpsError}</p>}

        {/* Swap button */}
        <div className="absolute right-12 top-[calc(50%-20px)] z-10">
          <button
            type="button"
            onClick={handleSwap}
            className="flex h-8 w-8 items-center justify-center rounded-full border bg-card shadow-sm transition-all hover:bg-accent hover:shadow-md active:scale-95"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Via point */}
        <AnimatePresence>
          {viaPlace !== null && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                  <div className="h-2 w-2 rounded-full bg-amber" />
                </div>
                <PlaceAutocomplete
                  id="via"
                  placeholder="Via point (optional waypoint)"
                  value={viaPlace}
                  onChange={setViaPlace}
                />
                <button
                  type="button"
                  onClick={() => setViaPlace(null)}
                  aria-label="Remove via stop"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-destructive transition-colors text-lg leading-none font-bold z-10"
                >
                  ×
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* To field */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive">
              <span className="text-[10px] font-bold text-primary-foreground">E</span>
            </div>
          </div>
          <PlaceAutocomplete
            id="end"
            placeholder="Destination"
            value={endPlace}
            onChange={setEndPlace}
          />
        </div>
      </div>

      {/* Via toggle */}
      {viaPlace === null && (
        <button
          type="button"
          onClick={() => setViaPlace({ text: "" })}
          className="flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:opacity-75"
        >
          <Plus className="h-3.5 w-3.5" />
          Add waypoint
        </button>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-xl py-6 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, hsl(210, 90%, 55%), hsl(155, 75%, 42%))" }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Finding routes...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Find Happy Routes
          </span>
        )}
      </Button>

      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowRecent((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {showRecent ? "Hide" : "Recent searches"}
          </button>

          {showRecent && (
            <ul className="mt-2 space-y-1">
              {recentSearches.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => applyRecent(r)}
                    className="w-full text-left text-xs px-2.5 py-2 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground truncate"
                  >
                    <span className="font-medium">{r.startName}</span>
                    <span className="mx-1 opacity-50">→</span>
                    <span className="font-medium">{r.endName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
