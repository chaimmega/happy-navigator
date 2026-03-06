"use client";

import { useState } from "react";
import PlaceAutocomplete, { type PlaceValue } from "./PlaceAutocomplete";

interface SearchFormProps {
  onSubmit: (data: {
    start: string;
    end: string;
    startCoords?: { lat: number; lng: number };
    endCoords?: { lat: number; lng: number };
    googleMapsUrl?: string;
  }) => void;
  loading: boolean;
}

export default function SearchForm({ onSubmit, loading }: SearchFormProps) {
  const [startPlace, setStartPlace] = useState<PlaceValue>({ text: "" });
  const [endPlace, setEndPlace] = useState<PlaceValue>({ text: "" });
  const [mapsUrl, setMapsUrl] = useState("");
  const [urlMode, setUrlMode] = useState(false);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlMode && mapsUrl.trim()) {
      onSubmit({
        start: startPlace.text,
        end: endPlace.text,
        startCoords: startPlace.coords,
        endCoords: endPlace.coords,
        googleMapsUrl: mapsUrl.trim(),
      });
    } else {
      onSubmit({
        start: startPlace.text,
        end: endPlace.text,
        startCoords: startPlace.coords,
        endCoords: endPlace.coords,
      });
    }
  };

  const canSubmit =
    !loading &&
    (urlMode
      ? mapsUrl.trim() !== ""
      : startPlace.text.trim() !== "" && endPlace.text.trim() !== "");

  const switchToUrl = () => {
    setUrlMode(true);
    setShowManualFallback(false);
  };

  const switchToManual = () => {
    setUrlMode(false);
    setShowManualFallback(false);
  };

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
      () => {
        setGpsError("Location access denied. Enable it in browser settings.");
        setGpsLoading(false);
      },
      { timeout: 8000 }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg text-sm">
        <button
          type="button"
          onClick={switchToManual}
          className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
            !urlMode
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Type addresses
        </button>
        <button
          type="button"
          onClick={switchToUrl}
          className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
            urlMode
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
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

          {/* Fallback toggle */}
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
              <PlaceAutocomplete
                id="start-fallback"
                label="Start (fallback)"
                placeholder="e.g. Central Park, New York"
                value={startPlace}
                onChange={setStartPlace}
              />
              <PlaceAutocomplete
                id="end-fallback"
                label="End (fallback)"
                placeholder="e.g. Brooklyn Bridge, New York"
                value={endPlace}
                onChange={setEndPlace}
              />
            </div>
          )}
        </>
      )}

      {/* Manual address mode */}
      {!urlMode && (
        <>
          {/* From field with GPS button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="start"
                className="block text-xs font-semibold text-gray-500 uppercase tracking-wide"
              >
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
            {gpsError && (
              <p className="mt-1 text-xs text-red-500">{gpsError}</p>
            )}
          </div>

          {/* Swap button */}
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-gray-100" />
            <button
              type="button"
              onClick={handleSwap}
              title="Swap start and end"
              aria-label="Swap start and end locations"
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors text-sm"
            >
              ⇅
            </button>
            <div className="flex-1 border-t border-gray-100" />
          </div>

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
    </form>
  );
}
