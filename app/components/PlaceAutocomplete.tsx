"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlacePrediction {
  displayName: string;
  subtitle: string;
  placeId: string;
}

export interface PlaceValue {
  text: string;
  coords?: { lat: number; lng: number };
}

interface PlaceAutocompleteProps {
  label: string;
  placeholder: string;
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlaceAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  required,
  autoFocus,
  id,
}: PlaceAutocompleteProps) {
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [noResults, setNoResults] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Initialize services when google is available
  useEffect(() => {
    const init = () => {
      if (typeof google !== "undefined" && google.maps?.places) {
        autocompleteService.current = new google.maps.places.AutocompleteService();
        geocoder.current = new google.maps.Geocoder();
        sessionToken.current = new google.maps.places.AutocompleteSessionToken();
      }
    };
    init();
    // Retry after a short delay in case Google Maps script hasn't loaded yet
    const timer = setTimeout(init, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Close dropdown when user clicks outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      listRef.current.children[activeIdx]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  const triggerSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setNoResults(false);
      return;
    }

    setLoading(true);
    setNoResults(false);

    debounceRef.current = setTimeout(() => {
      if (!autocompleteService.current) {
        setLoading(false);
        return;
      }

      autocompleteService.current.getPlacePredictions(
        { input: q, sessionToken: sessionToken.current ?? undefined },
        (predictions, status) => {
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            predictions &&
            predictions.length > 0
          ) {
            setResults(
              predictions.slice(0, 6).map((p) => ({
                displayName: p.structured_formatting.main_text,
                subtitle: p.structured_formatting.secondary_text || "",
                placeId: p.place_id,
              }))
            );
            setOpen(true);
            setNoResults(false);
          } else {
            setResults([]);
            setOpen(false);
            setNoResults(true);
          }
          setActiveIdx(-1);
          setLoading(false);
        }
      );
    }, 280);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    onChange({ text, coords: undefined });
    setNoResults(false);
    triggerSearch(text);
  };

  const commit = useCallback(
    (result: PlacePrediction) => {
      if (!geocoder.current) return;

      geocoder.current.geocode({ placeId: result.placeId }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const loc = results[0].geometry.location;
          const text = [result.displayName, result.subtitle].filter(Boolean).join(", ");
          onChange({ text, coords: { lat: loc.lat(), lng: loc.lng() } });
        } else {
          const text = [result.displayName, result.subtitle].filter(Boolean).join(", ");
          onChange({ text, coords: undefined });
        }
      });

      setOpen(false);
      setResults([]);
      setActiveIdx(-1);
      setNoResults(false);
      // Session token is consumed after selection — create a new one for the next search
      if (typeof google !== "undefined") {
        sessionToken.current = new google.maps.places.AutocompleteSessionToken();
      }
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !results.length) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (activeIdx >= 0) {
          e.preventDefault();
          commit(results[activeIdx]);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  };

  const handleClear = () => {
    onChange({ text: "", coords: undefined });
    setResults([]);
    setOpen(false);
    setNoResults(false);
    inputRef.current?.focus();
  };

  const hasCoords = !!value.coords;

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
      >
        {label}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value.text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls={id ? `${id}-listbox` : undefined}
          aria-activedescendant={
            activeIdx >= 0 && id ? `${id}-option-${activeIdx}` : undefined
          }
          className={`w-full px-3 py-2.5 pr-16 text-sm border rounded-lg outline-none transition
            ${
              hasCoords
                ? "border-emerald-400 bg-emerald-50/40 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                : "border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            }`}
        />

        {/* Right-side indicators */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {hasCoords && !loading && (
            <span className="text-emerald-500 text-xs font-bold" title="Location resolved">
              ✓
            </span>
          )}
          {loading && (
            <svg
              className="h-4 w-4 animate-spin text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {value.text && !loading && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear"
              className="text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-[9999] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
        >
          {results.map((result, i) => (
            <li
              key={result.placeId}
              id={id ? `${id}-option-${i}` : undefined}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(result);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer select-none transition-colors ${
                i === activeIdx ? "bg-emerald-50" : "hover:bg-gray-50"
              } ${i > 0 ? "border-t border-gray-100" : ""}`}
            >
              <span className="text-base flex-shrink-0 mt-0.5" aria-hidden>
                📍
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {result.displayName}
                </p>
                {result.subtitle && (
                  <p className="text-xs text-gray-400 truncate">{result.subtitle}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* No results hint */}
      {!open && noResults && (
        <div className="mt-1.5">
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <span>No places found — try a different spelling.</span>
          </p>
        </div>
      )}
    </div>
  );
}
