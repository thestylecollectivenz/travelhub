# iPad UI — Phase A (shipped)

## Summary

Travel Hub now has **four viewport shells** routed by `useShellMode()`:

| Mode | When | UI |
|------|------|-----|
| `phone` | Width ≤ 767px | `src/components/mobile/` |
| `ipad-portrait` | Tablet device, 768–1366px, height > width | Mobile shell + `data-shell="ipad-portrait"` styling |
| `ipad-landscape` | Tablet device, 768–1366px, width ≥ height | `IpadLandscapePlaceholder` — rotate to portrait |
| `desktop` | Width > 1366px, or tablet band with fine pointer | `TripWorkspace` / `TripBrowser` |

## Key files

- `src/hooks/useShellMode.ts` — routing logic
- `src/hooks/useMobileMode.ts` — deprecated wrapper; true for phone + iPad portrait
- `src/components/ipad/IpadLandscapePlaceholder.tsx` — landscape placeholder
- `src/webparts/travelHub/components/app/AppRouter.tsx` — home / trip list routing
- `src/components/workspace/TripWorkspace.tsx` — in-trip routing

## Phase B (not started)

- Dedicated iPad landscape shell under `src/components/ipad/`
- Touch-first layout mirroring post-refresh desktop (sidebar + main, split detail where appropriate)
- Depends on desktop UI refresh

## Spec updates

- `docs/functional-spec.md` §31.2 — tablet behaviour
- `docs/extended-scope-3.md` ES3-13 — iPad note

## SharePoint columns

None for Phase A.
