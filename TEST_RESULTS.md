# Happy Navigator — Playwright Test Results

## Summary

- **87 tests, 87 passed, 0 failed** (main suite, chromium project)
- **7 tests, 7 passed, 0 failed** (mobile project, Pixel 5 viewport)
- **Total: 94 tests green**

---

## What was tested

### 01 — Search form (14 tests)
- Page loads with correct heading and title
- Mode tabs (address / URL) visible and switchable
- Address mode: start + end inputs visible; URL mode: URL input visible
- Submit button gated: disabled when fields empty, enabled after filling both
- Swap button correctly swaps start ↔ end values
- Clear buttons reset individual fields

### 02 — Loading states (4 tests)
- Loading steps container appears after form submit
- Individual loading step elements rendered
- Submit button shows spinner/loading text during search
- Loading disappears after results arrive

### 03 — Results rendering (13 tests)
- AI summary card with bullet points renders
- Route comparison strip shows all routes (hidden when only 1 route)
- Route cards rendered for each route with distance/time text
- "Best Route ★" badge on the bestRouteId card
- "Happiest ★" label in comparison strip for best route
- Scores in strip match fixture data exactly
- Start/end names shown in summary card
- Partial data italic text shown when `signals.partial === true`
- No-routes (404), rate-limit (429), server error (502) all show error banner
- Error banner is dismissible

### 04 — Route selection (8 tests)
- Default selected route is `bestRouteId` after results load (aria-pressed="true")
- Clicking strip button changes selected route
- Clicking route card changes selected route
- Selected card gets shadow/border visual distinction
- Selected card shows expanded details (score bar, badges, GPX export)
- Keyboard Enter and Space select route cards
- Score in strip matches fixture data

### 05 — Happiest route (KEY TEST, 11 tests)
Tests the critical invariant: UI always uses `bestRouteId` from the API response.

**Behavioral rule (documented from code):**
- The server sorts routes descending by `happyScore`
- The AI may choose any valid route as best (not necessarily the highest scorer)
- The server validates: if AI's `bestRouteId` is in `validIds` → use it; else fallback to `scoredRoutes[0].id`
- The UI blindly uses `nav.bestRouteId` (see `page.tsx: setSelectedRouteId(nav.bestRouteId)`)
- **The UI does NOT independently compute the happiest route** — it trusts the server

Tests cover:
- THREE_ROUTES (bestRouteId=0, highest scorer): selects route 0
- TWO_ROUTES (bestRouteId=0): selects route 0
- WRONG_BEST_ROUTE_ID (bestRouteId=1, not highest): UI correctly selects route 1 (AI's choice)
- INVALID_BEST_ROUTE_ID (server already corrected to 0): handles gracefully
- SINGLE_ROUTE: single route selected, shows Best Route badge
- Routes are ordered descending by score in the UI
- Score values match fixture data exactly

### 06 — Autocomplete (11 tests)
- Start/end inputs accept typed text
- Clear buttons appear after typing and reset fields
- Start input has autoFocus on page load
- Escape key doesn't crash
- URL mode input accepts URL text
- URL mode enables submit button after URL typed
- Note: Google Places dropdown tests skipped (require live API key + network)

### 07 — Mobile viewport (7 tests, also run as separate "mobile" project)
- Form, submit button visible on mobile
- Submit button in viewport on Pixel 5
- Results, comparison strip render on mobile
- Map container present in DOM
- Error banner visible on mobile
- Swap functionality works on mobile

### 08 — Accessibility smoke (14 tests)
- Start/end inputs have accessible placeholders
- Submit button has accessible text
- Swap button has aria-label
- GPS button has aria-label
- Route cards have aria-pressed, aria-label, tabindex="0"
- Error banner/dismiss button accessible
- Tab navigation through mode buttons works
- Enter key on focused submit button submits form

### 09 — URL sharing (5 tests)
- After successful search, URL updates with `?from=lat,lng&to=lat,lng`
- URL params match the response's startCoords/endCoords
- Loading page with valid `?from=&to=` auto-triggers search
- Invalid URL params are silently ignored (no crash, no auto-search)
- Missing URL params result in idle state (no auto-search)

### Smoke — Live API (`e2e/smoke/live.spec.ts`)
- **Skipped by default** — requires `SMOKE_TEST=1` env var
- Tests real API with NYC routes (Central Park → Brooklyn Bridge)
- Runs with 35-second timeout for the full pipeline

### Soak — Overnight (`e2e/soak/overnight.spec.ts`)
- Repeats the mocked happy path N times (default 50, configurable via `SOAK_ITERATIONS`)
- Fresh browser context per iteration
- Tracks pass rate, timing, failures
- Allows up to 2% failure rate
- Uses `--workers=1` for serial execution

---

## data-testid attributes added

| Element | testid |
|---|---|
| Loading steps container | `loading-steps` |
| Individual loading step | `loading-step-{0..3}` |
| Error banner | `error-banner` |
| Error dismiss button | `error-dismiss` |
| Map container | `map-container` |
| Address mode tab | `tab-address` |
| URL mode tab | `tab-url` |
| Start input | `input-start` |
| End input | `input-end` |
| URL input | `input-url` |
| Submit button | `btn-submit` |
| Swap button | `btn-swap` |
| Clear start button | `btn-clear-start` |
| Clear end button | `btn-clear-end` |
| AI summary bullets list | `ai-summary` |
| Route comparison strip | `route-comparison-strip` |
| Strip button per route | `route-strip-btn-{id}` |
| Score in strip per route | `route-score-{id}` |
| Route card | `route-card-{id}` |
| Partial data badge | `partial-badge` |
| GPX export button | `btn-export-gpx` |
| Autocomplete dropdown | `autocomplete-dropdown-{id}` |
| Autocomplete option | `autocomplete-option-{i}` |

---

## Bugs found and fixed

None found — the codebase was already solid. Key behaviors verified:

1. **bestRouteId handling**: The UI correctly trusts `nav.bestRouteId` from the API. The server validates AI's choice and falls back to the highest scorer if invalid. This is the intended design.

2. **Error banner**: Already had a dismiss button (`aria-label="Dismiss error"`). Working as expected.

3. **Route card ordering**: Routes already sorted descending by `happyScore` server-side. UI renders in that order.

4. **Partial data badge**: Shows italic text in compact mode ("Partial data — features may be underreported") and a `~ partial data` badge in expanded (selected) mode.

---

## Remaining risks

1. **Google Places Autocomplete** — Not testable without live API keys. The autocomplete dropdown tests would require either: (a) mocking `window.google.maps.places`, or (b) a separate live integration suite. Currently only the input-level behavior is tested.

2. **Google Maps rendering** — MapView loads the Google Maps JS API client-side. In tests, the map area shows the placeholder ("Loading map…" or the actual map if script loads). Not asserting map visual rendering.

3. **Elevation profile** — Not tested (requires `elevationPoints` data in fixture). Could add a fixture with elevation data.

4. **Rate limiter** — The server-side rate limiter is tested at the API mock level but not end-to-end (would require bypassing the mock).

5. **WebSocket/SSE** — Not applicable (standard REST).

6. **Cross-browser** — Only Chromium tested. Firefox and WebKit projects can be added easily.

---

## Commands to rerun

```bash
# Full mocked suite (87 tests, ~40s)
npm run test:e2e

# Mobile viewport tests (7 tests)
npm run test:e2e:mobile

# All tests (chromium + mobile)
npx playwright test --reporter=line

# Headed mode (see browser)
npm run test:e2e:headed

# Interactive UI
npm run test:e2e:ui

# Live smoke (requires real API keys + SMOKE_TEST=1)
SMOKE_TEST=1 npm run test:e2e:smoke

# Overnight soak (default 50 iterations, ~25 min)
npm run test:e2e:soak

# Custom soak iterations
SOAK_ITERATIONS=100 npm run test:e2e:soak

# HTML report
npm run test:e2e:report
```

---

## File structure

```
e2e/
├── fixtures/
│   └── api-responses.ts      # Canned API fixtures (9 scenarios)
├── helpers/
│   └── mock.ts               # Route mocking helpers, page setup
├── tests/
│   ├── 01-search-form.spec.ts
│   ├── 02-loading.spec.ts
│   ├── 03-results.spec.ts
│   ├── 04-route-selection.spec.ts
│   ├── 05-happiest-route.spec.ts   ← KEY TEST
│   ├── 06-autocomplete.spec.ts
│   ├── 07-mobile.spec.ts
│   ├── 08-accessibility.spec.ts
│   └── 09-url-sharing.spec.ts
├── smoke/
│   └── live.spec.ts          # Real API, requires SMOKE_TEST=1
└── soak/
    └── overnight.spec.ts     # Repeat N times, overnight reliability
playwright.config.ts
```
