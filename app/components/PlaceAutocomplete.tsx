"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { searchPlaces, type PhotonResult } from "../lib/photon";

// ─── Place type → emoji mapping (Komoot / Citymapper style) ──────────────────

const TYPE_ICON: Record<string, string> = {
  // Green / nature
  park: "🌳",
  garden: "🌳",
  wood: "🌲",
  forest: "🌲",
  nature_reserve: "🌿",
  beach: "🏖️",
  water: "💧",
  // Transport
  station: "🚉",
  halt: "🚉",
  tram_stop: "🚊",
  bus_stop: "🚌",
  ferry_terminal: "⛴️",
  airport: "✈️",
  // Cities / admin
  city: "🏙️",
  town: "🏘️",
  village: "🏡",
  hamlet: "🏡",
  suburb: "📍",
  quarter: "📍",
  neighbourhood: "📍",
  // POI
  museum: "🏛️",
  gallery: "🎨",
  artwork: "🎨",
  theatre: "🎭",
  cinema: "🎬",
  stadium: "🏟️",
  attraction: "🎡",
  viewpoint: "👁️",
  // Food / drink
  restaurant: "🍽️",
  cafe: "☕",
  bar: "🍺",
  pub: "🍺",
  fast_food: "🍔",
  // Accommodation
  hotel: "🏨",
  hostel: "🏨",
  // Health
  hospital: "🏥",
  pharmacy: "💊",
  // Education
  school: "🏫",
  university: "🎓",
  college: "🎓",
  library: "📚",
  // Shopping
  supermarket: "🛒",
  marketplace: "🛒",
  // Default
  default: "📍",
};

function placeIcon(osm_value: string): string {
  return TYPE_ICON[osm_value] ?? TYPE_ICON.default;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface PlaceValue {
  text: string;
  coords?: { lat: number; lng: number };
}

type Hint =
  | { type: "did-you-mean"; result: PhotonResult }
  | { type: "no-results"; query: string };

interface PlaceAutocompleteProps {
  label: string;
  placeholder: string;
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
}

export default function PlaceAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  required,
  autoFocus,
  id,
}: PlaceAutocompleteProps) {
  const [results, setResults] = useState<PhotonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [hint, setHint] = useState<Hint | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Track the last query that returned results for "did you mean" hint
  const lastResultsRef = useRef<PhotonResult[]>([]);

  // Close dropdown when user clicks outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        if (open && lastResultsRef.current.length > 0 && !value.coords) {
          setHint({ type: "did-you-mean", result: lastResultsRef.current[0] });
        }
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, value.coords]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      listRef.current.children[activeIdx]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  const triggerSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setHint(null);
      lastResultsRef.current = [];
      return;
    }

    setLoading(true);
    setHint(null);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await searchPlaces(q, controller.signal);

      if (!controller.signal.aborted) {
        setResults(res);
        lastResultsRef.current = res;
        if (res.length > 0) {
          setOpen(true);
          setHint(null);
        } else {
          setOpen(false);
          setHint({ type: "no-results", query: q.trim() });
        }
        setActiveIdx(-1);
        setLoading(false);
      }
    }, 280);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    onChange({ text, coords: undefined });
    setHint(null);
    triggerSearch(text);
  };

  const commit = (result: PhotonResult) => {
    const text = [result.displayName, result.subtitle].filter(Boolean).join(", ");
    onChange({ text, coords: { lat: result.lat, lng: result.lng } });
    setOpen(false);
    setResults([]);
    setActiveIdx(-1);
    setHint(null);
    lastResultsRef.current = [];
  };

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
        if (lastResultsRef.current.length > 0 && !value.coords) {
          setHint({ type: "did-you-mean", result: lastResultsRef.current[0] });
        }
        setOpen(false);
        break;
    }
  };

  const handleClear = () => {
    onChange({ text: "", coords: undefined });
    setResults([]);
    setOpen(false);
    setHint(null);
    lastResultsRef.current = [];
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
          aria-expanded={open}
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
          {/* Resolved coords tick */}
          {hasCoords && !loading && (
            <span className="text-emerald-500 text-xs font-bold" title="Location resolved">
              ✓
            </span>
          )}
          {/* Spinner while fetching */}
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
          {/* Clear button */}
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
              key={i}
              id={id ? `${id}-option-${i}` : undefined}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before commit
                commit(result);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer select-none transition-colors ${
                i === activeIdx ? "bg-emerald-50" : "hover:bg-gray-50"
              } ${i > 0 ? "border-t border-gray-100" : ""}`}
            >
              <span className="text-base flex-shrink-0 mt-0.5" aria-hidden>
                {placeIcon(result.osm_value)}
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

      {/* Did you mean / No results hints */}
      {!open && hint && (
        <div className="mt-1.5">
          {hint.type === "did-you-mean" && (
            <p className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
              <span>Did you mean</span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(hint.result);
                }}
                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium underline underline-offset-2 transition-colors"
              >
                <span aria-hidden>{placeIcon(hint.result.osm_value)}</span>
                <span>
                  {hint.result.displayName}
                  {hint.result.subtitle ? `, ${hint.result.subtitle}` : ""}
                </span>
              </button>
              <span>?</span>
            </p>
          )}
          {hint.type === "no-results" && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <span>No places found for</span>
              <em>&ldquo;{hint.query}&rdquo;</em>
              <span>— try a different spelling.</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
