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
          <PlaceAutocomplete
            id="start"
            label="From"
            placeholder="e.g. Central Park, New York"
            value={startPlace}
            onChange={setStartPlace}
            required
            autoFocus
          />
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
