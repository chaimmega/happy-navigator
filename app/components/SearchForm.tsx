"use client";

import { useState, useEffect } from "react";
import PlaceAutocomplete, { type PlaceValue } from "./PlaceAutocomplete";

// ─── Recent searches (persisted in localStorage) ──────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

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
}

export default function SearchForm({
  onSubmit,
  loading,
  mapPinPlace,
  mapPinTarget,
  onClearMapPin,
}: SearchFormProps) {
  const [startPlace, setStartPlace] = useState<PlaceValue>({ text: "" });
  const [endPlace, setEndPlace] = useState<PlaceValue>({ text: "" });
  const [viaPlace, setViaPlace] = useState<PlaceValue | null>(null);
  const [mapsUrl, setMapsUrl] = useState("");
  const [urlMode, setUrlMode] = useState(false);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    setRecentSearches(loadRecent());
  }, []);

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

    if (urlMode && mapsUrl.trim()) {
      onSubmit({
        start: startPlace.text,
        end: endPlace.text,
        startCoords: startPlace.coords,
        endCoords: endPlace.coords,
        googleMapsUrl: mapsUrl.trim(),
        via: viaData,
      });
    } else {
      onSubmit({
        start: startPlace.text,
        end: endPlace.text,
        startCoords: startPlace.coords,
        endCoords: endPlace.coords,
        via: viaData,
      });
    }
    setShowRecent(false);
    onClearMapPin?.();
  };

  const canSubmit =
    !loading &&
    (urlMode
      ? mapsUrl.trim() !== ""
      : startPlace.text.trim() !== "" && endPlace.text.trim() !== "");

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
    setUrlMode(false);
    setShowRecent(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg text-sm">
        <button
          type="button"
          onClick={() => { setUrlMode(false); setShowManualFallback(false); }}
          className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
            !urlMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Type addresses
        </button>
        <button
          type="button"
          onClick={() => { setUrlMode(true); setShowManualFallback(false); }}
          className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
            urlMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Paste Maps URL
        </button>
      </div>

      {/* URL mode */}
      {urlMode && (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Google Maps directions URL
            </label>
            <input
              type="url"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              placeholder="https://www.google.com/maps/dir/..."
              autoFocus
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
            />
          </div>

          {!showManualFallback ? (
            <button
              type="button"
              onClick={() => setShowManualFallback(true)}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
            >
              URL not parsing correctly? Enter addresses manually as fallback
            </button>
          ) : (
            <div className="space-y-3 pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                These will be used if the URL above cannot be parsed.
              </p>
              <PlaceAutocomplete id="start-fallback" label="Start (fallback)" placeholder="e.g. Central Park, New York" value={startPlace} onChange={setStartPlace} />
              <PlaceAutocomplete id="end-fallback" label="End (fallback)" placeholder="e.g. Brooklyn Bridge, New York" value={endPlace} onChange={setEndPlace} />
            </div>
          )}
        </>
      )}

      {/* Manual address mode */}
      {!urlMode && (
        <>
          {/* From field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="start" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                From
              </label>
              <button
                type="button"
                onClick={handleGps}
                disabled={gpsLoading}
                title="Use my current location"
                aria-label="Use my current GPS location as start"
                className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {gpsLoading ? (
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <circle cx="12" cy="12" r="3" />
                    <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  </svg>
                )}
                Use my location
              </button>
            </div>
            <PlaceAutocomplete
              id="start"
              label=""
              placeholder="e.g. Central Park, New York"
              value={startPlace}
              onChange={(v) => { setStartPlace(v); setGpsError(null); }}
              required
              autoFocus
            />
            {gpsError && <p className="mt-1 text-xs text-red-500">{gpsError}</p>}
          </div>

          {/* Via-point section */}
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-gray-100" />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSwap}
                title="Swap start and end"
                aria-label="Swap start and end locations"
                className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors text-sm"
              >
                ⇅
              </button>
              {viaPlace === null && (
                <button
                  type="button"
                  onClick={() => setViaPlace({ text: "" })}
                  title="Add a via-point (route through a specific location)"
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-dashed border-gray-300 bg-white text-gray-400 hover:text-emerald-600 hover:border-emerald-400 transition-colors text-base leading-none"
                >
                  +
                </button>
              )}
            </div>
            <div className="flex-1 border-t border-gray-100" />
          </div>

          {/* Via-point input (shown when added) */}
          {viaPlace !== null && (
            <div className="relative">
              <PlaceAutocomplete
                id="via"
                label="Via (optional stop)"
                placeholder="e.g. Riverside Park"
                value={viaPlace}
                onChange={setViaPlace}
              />
              <button
                type="button"
                onClick={() => setViaPlace(null)}
                aria-label="Remove via stop"
                className="absolute right-2 top-1 text-gray-300 hover:text-red-400 transition-colors text-lg leading-none font-bold"
                title="Remove via stop"
              >
                ×
              </button>
            </div>
          )}

          <PlaceAutocomplete
            id="end"
            label="To"
            placeholder="e.g. Brooklyn Bridge, New York"
            value={endPlace}
            onChange={setEndPlace}
            required
          />
        </>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Finding Happy Routes…
          </>
        ) : (
          "Find Happy Routes"
        )}
      </button>

      {/* Recent searches */}
      {recentSearches.length > 0 && !urlMode && (
        <div>
          <button
            type="button"
            onClick={() => setShowRecent((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
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
                    className="w-full text-left text-xs px-2.5 py-2 rounded-lg bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-gray-600 truncate"
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
