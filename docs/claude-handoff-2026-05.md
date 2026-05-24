# Travel Hub for SharePoint — Status brief for Claude (May 2026)

## 1. What this product is

**Travel Hub** is an SPFx React/TypeScript single-page app inside SharePoint for **private trip planning** and a **restricted shared “follow the trip” view**. Data lives in SharePoint lists/libraries; UX must feel like an app, not classic list forms.

**Repo:** `https://github.com/thestylecollectivenz/travelhub.git`  
**Current deployed package version:** **1.0.9.4** (`src/appVersion.ts`, `config/package-solution.json`, `sharepoint/solution/travel-hub.sppkg`)

**Source of truth documents (read these before proposing changes):**

| Document | Path | Role |
|----------|------|------|
| Functional Specification v1.0 | `docs/functional-spec.md` | Core product behaviour |
| Extended Scope v1.0 | `docs/extended-scope.md` | Phased roadmap, Phase 8 AI/affiliate, commercial direction |
| Extended Scope v3 | `docs/extended-scope-3.md` | Bug fixes, category fields, mobile, pre–Phase 8 prerequisites |
| Architecture spec | `docs/travel-hub-architecture-spec.md` | SPFx + future web-app wrapper, data-access rules |

**Cursor workspace rules** (`.cursor/rules/travel-planner.mdc`) reinforce: NZD/home-currency rollups, working-amount financial model, private vs shared field separation, no classic SharePoint forms.

---

## 2. Planned phases vs actual progress (high level)

The **extended-scope phase table is outdated** (still lists Phases 4–7 as “Planned”). In practice, **most core product areas are substantially built** in SPFx; what remains is polish, Phase 8 AI/affiliate, multi-trip intelligence, and commercial installer (Phase 9).

| Area | Spec / phase | Implementation status |
|------|----------------|-------------------------|
| Multi-trip browser, create trip, hero, lifecycle | Phases 1–3 + cleanup | **Done** — `TripBrowser`, `CreateTripPanel`, `TripHero`, edit/delete trip |
| Trip days, editable titles, day types | Spec §8 | **Done** — Place/Port, Sea, Transit, Pre-trip |
| Itinerary cards, inline edit, DnD reorder | Spec §16–19 | **Done** — `ItineraryCard`, portal edit, `@dnd-kit` |
| Category-specific fields (accommodation, flights, transport return, cruise) | ES3 + spec | **Mostly done** — `ItineraryCardEditCategoryLayouts.tsx` |
| Sub-items / “options” | Spec §20, ES3-2 | **Done** — booking required, files/links, create task; cost certainty on options (v1.0.9.4) |
| Financial model, FX, home currency | Spec §10–11, 22 | **Done** — `FxService`, configurable `homeCurrency` in Settings |
| Multi-day allocation (hotels, cruise, etc.) | Spec §23 | **Done** — utilities in financial/day rollups |
| Budget summary cards + sidebar by category | Spec §10, 12, 15 | **Done** — hero stats, `SidebarCategoryBudget`, day `BudgetBreakdownTile` |
| Budget tab (full trip detail) | Phase 7 | **Done** — `TripBudgetDetailView`, Excel export |
| Journal, photos, likes, comments | Spec §26, 28 | **Done** — `TripJournalFeed`, `JournalEntryCard`, `TripPhotoAlbum` |
| Documents & links (trip-level + per entry) | Spec §24 | **Done** — `TripFilesLinksView`, `TripDocumentsView`, `TripLinksView`, attachments context |
| Trip search (mixed types) | Spec §25 | **Done** — search panel in `TripWorkspace.tsx` |
| Maps, route strip, place pins | Spec §13, Phase 6 | **Done** — `TripMap`, `RouteStrip`, multi-trip map in `TripBrowser` |
| Tasks / reminders | Spec §29, Phase 7 | **Done** — `TripTasksView`, calendar, derived booking/payment tasks |
| Packing list + templates | Phase 7 | **Done** — `PackingListView`; **templates = separate Plan tab** (v1.0.9.4) |
| Cruise import (URL/PDF) | Spec §7 | **Done** — `CruiseItineraryImport.tsx` |
| Day planner grid + print | P7-7 | **Done** — `ItineraryDayPlannerView`, `DayPlannerPrintSheet` |
| Excel export | Spec §30.1 | **Partial** — full-trip itinerary Excel + budget Excel; **not** a dedicated “selected day only” export called out in spec |
| Journal PDF book | Spec §30.2–30.4 | **Done** — `JournalPdfExport.tsx` with scope/options |
| Shared trip view | Spec §27 | **Done** — `SharedTripView`, no financials in shared paths |
| Config panel | Cleanup sprint | **Done** — home currency, °C/°F, km/mi, journal author, sidebar width, **Visual Crossing weather API key** |
| Tip calculator | Phase 7 | **Done** — `TipCalculator.tsx` |
| T&Cs page | Phase 7 | **Done** — `TermsAndConditions` in app router |
| **Phase 8: AI + affiliate** | Extended scope §4.6, §8 table | **Not implemented** — UI placeholders only (see §5) |
| **Phase 9: Web installer / SaaS** | Architecture spec | **Not started** |
| Mobile-optimised layout | ES3-14 | **Parked** — commit `94d83ea` explicitly parked mobile UI work |
| Web app wrapper (MSAL/Graph) | Architecture spec | **Not started** — SPFx only in production path |

---

## 3. What shipped recently (since ~v1.0.8.0)

Git history from `b728f20` → `a108a8c` covers the bulk of recent UX/product work:

### v1.0.8.0 – v1.0.9.0

- New itinerary fields (accommodation, flights, activities, transport return journey).
- Itinerary-linked tasks (`ReminderService`, `linkedEntryTask` on cards).
- Map grouping, task filters, styled confirm dialogs.
- Day planner, budget tab, task calendar, cruise geocode fixes.

### v1.0.9.1 – v1.0.9.2

- Task scroll/focus fixes, locations panel, packing improvements.
- **Location info** as an itinerary **category** (`Location info`), auto-synced cards per place (`locationInfoCardSync.ts`).
- Day UX: collapsible locations/place panels, sticky day toolbar, place display as **“City, Country”** only.
- Place info panel: weather (Visual Crossing), typical/seasonal, currency/tipping from static country data.
- Tasks: checkbox + icon actions, print, packing templates manager (initially embedded in tasks view).

### v1.0.9.3

- Day toolbar order fix, forecast strip attempted, linked task assignee on cards.

### v1.0.9.4 (latest)

- **Forecast:** from **actual today** at place coordinates for N days (N = days place appears on trip, max 15) — **not** trip calendar months ahead.
- **Day header layout:** Place info **left**, Locations **right**; denser place info card.
- **Location info cards:** unified **Highlights** section (sight / food / drink / souvenir icons); collapsible; single title line with pin; remove (×) fix for checklist items; sorted to top of day stack.
- **Tasks:** custom `Custom` reminders in **To do** with `Reminder:` prefix; due-date sort; icon/checkbox pattern on bookings/payments/cancellations; **Packing templates** = dedicated Plan tab.
- **Options (sub-items):** cost certainty + improved cost/currency/footer layout.
- **Sidebar:** page scroll (not trapped internal scroll when main panel ends).
- **AI:** still **placeholders** — “Research with AI (coming soon)”, per-row ↻ disabled.

---

## 4. Place / location intelligence — spec vs built (critical for AI questions)

### What the functional spec says

- **Places** are lightweight: primary overnight + additional visited places per day; **no heavy Places admin** (§9).
- **Phase 6 (extended scope):** weather, seasonal averages, currency, tipping per place.
- **Phase 8 (extended scope):** originally “AI suggestions per day” + affiliate platform links; §8 table also mentions:
  - **Gemini API** (user-supplied key in `UserConfig`)
  - **“Best known for” card per place** — 4-category AI JSON **cached on Places list**
  - `BestKnownFor` column, `GeminiApiKey`, `AppConfig` list for affiliates

### What we actually built (hybrid — not in original functional spec verbatim)

Two related UI surfaces:

**A) Day header — “Place info” panel** (`PlaceInfoPanel.tsx`, `DayHeader.tsx`)

- Live **current weather** + **forecast strip** (Visual Crossing; key in Settings).
- **Typical for [month]** (historical API or static `SEASONAL_BY_REGION`).
- **Currency and tipping** (static `COUNTRY_DATA`).
- Local time for place timezone.
- **Not AI-generated.**

**B) Itinerary — “Location info” cards** (category `Location info`)

- One card **per place per trip**, auto-created on first day that place is used (`syncLocationInfoCards`).
- Card lives on **first day** that place appears; **sorts to top** of that day’s cards; draggable; collapsible.
- Notes stored as **JSON** in itinerary `notes` (`locationInfoEntry.ts`):
  - `placeId`, `overview`, `iconicSights` / `foodDrink` (legacy text)
  - `iconicSightsItems`, `foodDrinkItems`, `drinkItems`, `souvenirItems` (checklists)
  - AI placeholder strings only
- View: `LocationInfoHighlights.tsx` — single section, emoji icons (🏛 🍽 🍷 🎁), checkboxes, manual add, disabled refresh.
- Edit: same via `LocationInfoEditLayout` in `ItineraryCardEditCategoryLayouts.tsx`.

### Gaps vs Phase 8 / user intent

| Item | Status |
|------|--------|
| AI-generated overview | **Manual only**; editable textarea in edit mode |
| AI-generated highlights | **Manual only**; refresh buttons disabled |
| Cache on **Places** list (`BestKnownFor`) | **Not built** — data on **itinerary card notes** only |
| `GeminiApiKey` in UserConfig | **Not built** — only `weatherApiKey` exists |
| `AppConfig` list / affiliate links | **Not built** |
| Cross-trip checklist progress per place | **Not built** — progress is per card/day only |
| Sightseeing preference profile | **Not built** |
| AI suggestions per **day** (Phase 8 table) | **Not built** — direction shifted to **per-place Location info cards** |

---

## 5. Decisions already made in implementation (don’t re-litigate without reason)

1. **Financial model:** Working amount + paid/unpaid rollups; **Estimated / Confirmed** (`costCertainty`) on main items and options; home currency from settings (default NZD).
2. **No top-level “per person” summary card** on trip header (per spec).
3. **Private vs shared:** Shared view uses `SharedTripView` / `SharedDayPanel`; financial fields must not render there.
4. **Weather:** Visual Crossing (user API key), not OpenWeatherMap from early Phase 6 notes.
5. **Forecast semantics (v1.0.9.4):** “What’s the weather **from today** for the next N days **at this place**” where N follows multi-day stay length — **not** “forecast on trip dates in 6 months.”
6. **Location info = itinerary cards**, not a separate SharePoint entity — sync keeps one card per `placeId`.
7. **UX:** Inline/slide-in editing; portal for narrow planner columns; confirm dialogs for deletes.
8. **Architecture direction (not implemented):** Future `travelhub.app` web wrapper + Graph API; all data access should stay in `src/services/*`.

---

## 6. Key technical pointers for AI integration design

| Concern | Current state |
|---------|----------------|
| **Settings storage** | `UserConfig` SharePoint list via `ConfigService` — fields: `homeCurrency`, `temperatureUnit`, `distanceUnit`, `journalAuthorName`, `sidebarWidth`, `weatherApiKey`, `dayBreakdownVisibleByDefault` |
| **Place records** | `PlaceService` / `Places` list — geocoded lat/long, country, timezone; **no AI cache column yet** |
| **Location info payload** | `src/utils/locationInfoEntry.ts` — parse/serialize JSON in itinerary notes |
| **When cards appear** | `src/utils/locationInfoCardSync.ts` on location changes in `DayHeader` |
| **Highlight UI** | `src/components/itinerary/LocationInfoHighlights.tsx` |
| **Security** | SPFx runs in user context; **API keys in browser Settings** = same pattern as weather (acceptable for personal use; weak for commercial — architecture spec prefers backend for SaaS) |

**Extended scope originally proposed for Phase 8 AI:**

- Provider: **Gemini**, user-supplied key
- Cache: **Places.BestKnownFor** JSON
- Affiliate: **AppConfig** list + optional remote refresh from `travelhub.app`

**Recent product direction (from user, v1.0.9.x):**

- Overview + highlights (sights, food, drink, souvenirs) on **Location info cards**
- Multiple items per type if AI suggests
- Per-item “refresh suggestion”
- Optional “Research all” for a place
- **Cross-trip progress view** — deferred

---

## 7. Open questions we need Claude to help answer (AI + product)

1. **Provider & hosting:** Gemini (per extended scope) vs OpenAI/Azure Anthropic? **Client-side key** (like weather) vs **Azure Function** proxy for commercial?
2. **Data model:** Cache on **Places** (`BestKnownFor`) vs only on **Location info card notes** vs both (Places = canonical, cards = synced copy)?
3. **Sync rules:** When place added / card created / user clicks Refresh — what triggers generation? Idempotency and cost caps?
4. **JSON schema:** Stable structure for overview + `highlights[]` with `{ kind, label, done? }` — align with existing `locationInfoEntry.ts`.
5. **Personalisation:** Sightseeing preferences in UserConfig — required for v1 or post-MVP?
6. **Shared view:** Are AI highlights **private-only** (recommended) or visible to followers?
7. **Affiliate links (Phase 8b):** AppConfig list + platform search URLs — same phase or after core AI works?
8. **Cross-trip checklist view:** Aggregate completion by `placeId` across all Location info cards — UX location and write-back rules.

---

## 8. Other notable gaps vs functional spec (non-AI)

| Spec item | Gap |
|-----------|-----|
| Excel export **selected day** line-by-line | Trip-level export exists; day-scoped export may be incomplete |
| “Named groupings” for sub-items (e.g. “Activities nearby (2)”) | Not implemented as labelled groups |
| Broader notifications for reminders | In-app task view only |
| Multi-trip layer “filter/sort trips” | Basic list + map; not full spec richness |
| Country/city tracker across all trips | Not built |
| Distances travelled analytics | Not built |
| Complex threaded comments | Correctly out of scope |
| Phase 8 prerequisites in ES3 (some category tile polish, mobile audit P7-14) | Partially done; mobile parked |

---

## 9. Suggested prompt for Claude

> You are advising on Phase 8 AI integration for Travel Hub (SharePoint SPFx travel planner). Read this brief and the referenced docs in the repo. The app is at v1.0.9.4 with Location info itinerary cards storing JSON notes (overview + highlight checklists), Place info weather via Visual Crossing, and no Gemini/AI wired yet. Extended scope originally specified Gemini + Places.BestKnownFor cache + AppConfig affiliates. Recent UX merged “best known for” into per-place Location info cards with sights/food/drink/souvenirs. Recommend: (1) API provider and key storage, (2) data model and cache location, (3) JSON schema and sync with existing `locationInfoEntry.ts`, (4) prompt design and refresh flows, (5) privacy in shared view, (6) phased plan before affiliate links. Align with commercial SaaS direction in `docs/travel-hub-architecture-spec.md`.

---

*Document generated for handoff to Claude, May 2026. Update when major releases ship (especially Phase 8 AI).*
