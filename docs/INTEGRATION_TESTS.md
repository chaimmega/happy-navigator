# Integration Tests — Happy Navigator

Real API test suite that exercises the full server pipeline end-to-end with no mocks.

## File

```
e2e/integration/api.integration.spec.ts
```

## What it tests

18 tests across 5 categories, all hitting the live `/api/navigate` endpoint:

| Category | Tests | What's verified |
|---|---|---|
| **Response structure** | 6 | HTTP 200, required fields present, routes non-empty, per-route schema, score 0–100, descending sort order |
| **Scoring invariants** | 4 | `bestRouteId === routes[0].id`, base score always 5, all breakdown values ≥ 0, partial-data penalty ≤ 85 |
| **Scenic feature detection** | 3 | Charles River (Boston) has `waterfrontCount`/`scenicRoadCount` > 0, score > base, AI bullets present |
| **Error handling** | 2 | Missing `start` → 400, missing `end` → 400 |
| **Score comparison** | 2 | Riverside Park (NYC) waterfront has scenic signals, `parks + scenicRoads + waterfront` breakdown > 0 |

### Locations used

| Route | Coordinates | Why |
|---|---|---|
| Hudson River, NYC | Inwood Hill Park → The Battery | Dense OSM data, reliable driving routes |
| Charles River, Boston | Cambridge → Back Bay | Well-mapped urban area with waterfront |
| Riverside Park, NYC | 79th St → 96th St | Predictable park + waterfront signals |

## How to run

**Requires:** dev server running + real API keys in `.env.local`

```bash
# Start the dev server first (in a separate terminal)
npm run dev -- -p 3010

# Then run integration tests
npm run test:integration
```

Or let Playwright auto-start the server:

```bash
npm run test:integration
```

Playwright's `webServer` block will start the dev server on port 3010 automatically if it isn't already running.

## API keys required

All three must be set in `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
GOOGLE_MAPS_SERVER_KEY=...          # optional but recommended
```

If `ANTHROPIC_API_KEY` is missing, the AI explanation will be `null`. Tests that check `explanation` are written to handle `null` gracefully.

## Overnight soak loop

`soak-loop.ps1` runs `npm run test:integration` on a loop for 8 hours:

```powershell
powershell.exe -ExecutionPolicy Bypass -File soak-loop.ps1
```

- Stops after **5 consecutive unfixed failures** (raised from 3 — real APIs are occasionally flaky)
- On failure: runs `node scripts/soak-autofix.js` to attempt automated fixes, then re-runs
- Writes `soak-summary.md` and a timestamped log file when done

## Difference from the mocked e2e suite

| | Mocked suite (`test:e2e`) | Integration suite (`test:integration`) |
|---|---|---|
| Network calls | None — all mocked via `page.route()` | Real — Google Maps, Overpass, Anthropic |
| Speed | ~35s per full run | ~3–5 min per full run |
| What it catches | UI bugs, React hydration issues, selector breaks | API outages, key expiry, scoring regressions, Overpass downtime |
| Runs in CI | Yes (every push) | No — requires real keys and is slow |
| Good for overnight | No (too fast, too deterministic) | Yes — finds real-world regressions |

## Timeout

Each test allows **45 seconds**. The full pipeline (geocode → directions → Overpass → elevation → AI) typically takes 15–25 seconds on first run, faster on cache hits.
