# Claude handoff — Travel Hub post–Phase 7 (May 2026)

This document summarizes **what was implemented**, **where it lives**, and **what to watch next**. It is written for another assistant (or future you) picking up the repo after the “Post-Phase-7 Fix Pass + Extended Field Scope” work.

---

## 1. Original ask (condensed)

From the user’s task brief (build order **B1 → B4 → N1 → N4 → N2 → N3 → N5 → N6**, plus **N7**):

| ID | Theme |
|----|--------|
| **B1** | `ReminderType: 'Option'` tasks appear in Task view; `TaskNote`; no hardcoded type whitelist blocking `Option`. |
| **B2** | Accommodation (and carryover) drag handle + tile order persisted via `SortOrder`; no category-based re-sort overriding user order. |
| **B3** | Google Maps: primary **place** URL, secondary **directions**; both on accommodation and activities cards. |
| **B4** | OData: `$select` fallback when tenant lacks new columns; log warnings, do not brick the app. |
| **N1** | “Add to tasks” everywhere: optional inline description → `TaskNote`; provision column if missing. |
| **N2** | Accommodation: `PerksIncluded`, `CancellationPolicy`, `CancellationDeadline`; auto reminder `CancellationDeadline` with dedupe by `entryId` + type. |
| **N3** | Accommodation card: inline “Create a task” → `ManualEntryTask` + context in `TaskNote`. |
| **N4** | Per-night display: native + home currency when entry currency ≠ home. |
| **N5** | Cruise-specific columns + UI; hide generic Supplier for Cruise in favour of `CruiseLineName`. |
| **N6** | Transport: `TransportFrom` / `TransportTo` / `TransportMode`; auto title; return leg display reversal. |
| **N7** | Pre-trip day must **never** receive accommodation (or other) **span/carryover** rows—only `dayId === preTripDayId`. |

**Note:** The brief referenced **`ITravelHubDataService.ts`** — that file **does not exist** in this repo; writes remain on concrete services (`ItineraryService`, `ReminderService`, etc.).

---

## 2. Key files touched (by theme)

### Tasks / reminders

- `src/components/tasks/TripTasksView.tsx` — loads reminders; resolves `entryId` to parent or sub-item for **Open in itinerary**; shows `TaskNote`; heading **Reminders & tasks**; linked row day uses **`target.openDayId`** (fix for `ManualEntryTask` / sparse `DayId` on reminder).
- `src/services/ReminderService.ts` — `TaskNote` on model and `$select`; **400 retry** without `TaskNote`; **`deleteByEntryIds(tripId, entryIds)`** for cleanup.
- `src/components/itinerary/SubItem.tsx` — inline optional note before creating **Option** reminder.
- `src/components/itinerary/ItineraryCardView.tsx` — main **Add to tasks** + optional note; **ManualEntryTask** inline form; maps links.
- `src/components/itinerary/ItineraryTimeline.tsx` — loads reminders for `hasTask` + **`cancellationDeadlineEntryIds`**; passes **`hasCancellationDeadlineReminder`**; **`draggable`** enabled for all timeline cards (carryover included).
- `scripts/provision-lists.ps1` — `TripReminders` / `TaskNote` and itinerary columns as in schema summary.

### Cancellation auto-task (N2)

- `src/services/accommodationCancellationReminderSync.ts` — create/update/delete **`CancellationDeadline`** reminder when accommodation deadline changes.
- `src/context/TripWorkspaceContext.tsx` — calls sync after **create / update / duplicate** itinerary entry; **`deleteEntry`** / **`deleteSubItem`** cascade SP deletes and **`deleteByEntryIds`** + **`trip-reminders-updated`** event.

### Itinerary data / OData (B4)

- `src/services/ItineraryService.ts` — **`SELECT_BASE`** vs full **`SELECT`**; **`getAll` / `getById`** retry on **400** with **`SELECT_FALLBACK`**; **`assembleTree`** sorts parents by **`dayId` then `sortOrder`** (no category sort).

### Day composition / pre-trip (N7)

- `src/utils/itineraryDayEntries.ts` — **`EntryCalendarMatchContext`**, pre-trip excluded from span when viewing pre-trip; **`sortEntriesForDay(..., preTripDayId)`**, **`resolvePreTripDayId`**.
- Wired from `TripContent.tsx`, `ItineraryTimeline.tsx`, `ItineraryDayPlannerView.tsx`, `SharedDayPanel.tsx`, `SharedItinerarySummary.tsx` (where applicable).

### Drag / reorder (B2 + follow-up)

- `src/components/workspace/TripContent.tsx` — on drag end, **`orderIdsByHomeDayFromVisualList`** then **`reorderEntries(dayId, ids)`** for **each** distinct `dayId` in the visual list (carryover-safe persistence).
- `src/utils/itineraryReorderByDay.ts` + **`itineraryReorderByDay.test.ts`** — pure helper + **3 Jest tests**.
- `src/context/TripWorkspaceContext.tsx` — **`moveEntryToDay`** computes **`nextSort`**, updates state, calls **`ItineraryService.moveToDay(entryId, targetDayId, nextSort)`** so SharePoint gets **DayId + SortOrder** in one flow.

### Maps (B3)

- `src/utils/googleMapsLink.ts` — **`googleMapsPlaceUrl`**, **`googleMapsDirectionsUrl`**.
- `ItineraryCardView.tsx`, `ItineraryDayPlannerView.tsx` — **View on map** / **Get directions**; CSS in `ItineraryCardView.module.css`.

### Models / edit UI (N2, N5, N6)

- `src/models/ItineraryEntry.ts` — extended fields.
- `src/components/itinerary/ItineraryCardEdit.tsx` — accommodation perks/cancellation/deadline; cruise block; transport From/To/Mode; title rules for transport.
- `ItineraryCardView.tsx` — display blocks for cruise, transport titles, N4 amounts, etc.

### Packaging

- **`sharepoint/solution/travel-hub.sppkg`** — built via **`heft package-solution`**; committed when refreshing for tenant test. **`.gitignore`** keeps **`sharepoint/solution/debug/`** out of git but **allows** this one `.sppkg` path.

---

## 3. Events and cross-component refresh

- **`trip-reminders-updated`** — `window` `CustomEvent` / `Event`; `ItineraryTimeline` listens and refetches reminder sets for pills.

---

## 4. Gaps and follow-ups (honest)

1. **Day Planner** (`ItineraryDayPlannerView`) still uses **`draggable={false}`** on cards by design (narrow columns); main itinerary timeline is where DnD is fully enabled.
2. **B4 “provision on app load”** was **not** implemented; **OData retry + console warnings** is what shipped.
3. **`npm run build`** uses **`heft test --clean`** — can fail with **EBUSY** on Dropbox (`temp/build`, `lib`, or `sharepoint/solution/debug`). Workaround: **`npx heft test --production`**, then clear **`sharepoint/solution/debug`** if needed, then **`npx heft package-solution --production`**.
4. **Git cadence:** user brief asked for commit per task; delivery used **fewer aggregate commits** plus later **`build: refresh travel-hub.sppkg`**.
5. **Move to day + accommodation:** moving an entry to another day updates **`DayId` / `SortOrder`** only; **check-in / check-out dates** are not auto-shifted (would be a separate product decision).

---

## 5. Suggested next steps for Claude

1. Run **`docs/test-plan-post-phase-7.md`** against a freshly uploaded `.sppkg`.  
2. If **Option** reminders fail on some tenants, check whether **`ReminderType`** is a **Choice** column with a closed set — may need tenant admin to allow new values or switch column to text.  
3. Consider **unit tests** for `itineraryDayEntries` (pre-trip + span edge cases).  
4. Optional: **app-start provisioning** for new columns to satisfy B4 “preferred” path without relying on 400 fallback.

---

## 6. Git reference (recent)

Commits on `main` include (non-exhaustive): post-phase-7 feature batch, **B2** reminder delete + carryover reorder, **moveToDay `sortOrder`** + reorder util + Jest, **TripTasksView** day label fix, **`build: refresh travel-hub.sppkg`**. Use `git log --oneline -15` for exact hashes.

---

*End of handoff.*
