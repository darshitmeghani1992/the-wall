# 11 · Performance *(living)*

Measurable targets. Validated on a mid-range physical device during the ship
phase; record actuals as they're measured.

## Budgets

| Metric | Target | Actual | Notes |
|---|---|---|---|
| Cold launch → interactive | < 2.0 s | — | fonts preloaded, splash held |
| Wall first paint (cached) | < 1.0 s | — | marks paginated |
| Mark create → on wall | < 500 ms | optimistic insert + realtime |
| Realtime propagation | < 250 ms | Supabase realtime |
| Image upload (≤6 MB) | < 3.0 s | good network; progress shown |
| Scroll | ~60 fps (target 90 on capable devices) | — | FlashList for long walls |
| Crash-free sessions | ≥ 99.8% | — | via crash reporting |

## Tactics
- Long walls use **FlashList** (masonry) with windowing; the current simple
  2-column `Masonry` is fine for small walls and gets swapped when counts grow.
- **Paginate** marks (e.g. 30/page) with infinite scroll; don't fetch whole walls.
- Cache images (`expo-image`), resize/compress before upload.
- Debounce network checks (handle availability, search).
- Avoid re-render storms: memoize mark rows; stable keys by `mark.id`.
- Preload fonts before first paint to avoid layout shift.

## How we measure
- React DevTools / Flipper for renders; `performance.now()` around critical paths.
- EAS build on a physical device for launch/scroll; PostHog for real-world timings.

> Fill "Actual" as measurements happen; flag any regression in `14_Changelog`.
