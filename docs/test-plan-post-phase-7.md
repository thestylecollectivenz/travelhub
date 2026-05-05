# Travel Hub — Test plan (post–Phase 7 fix pass)

**Audience:** Manual QA after deploying `sharepoint/solution/travel-hub.sppkg` to the tenant App Catalog.  
**Prerequisites:** Lists provisioned (including Phase 7 columns and `TripReminders.TaskNote` where applicable). Use a non-production site first if possible.

---

## 1. Tasks and reminders (`TripTasksView`)

| # | Case | Steps | Expected |
|---|------|--------|----------|
| 1.1 | Option-type task visible | Add sub-item → Booking required → Add to tasks (optional note) → open **Plan → Tasks** | Task appears under **Reminders & tasks**; type includes **Option**; **Open in itinerary** focuses parent day and entry. |
| 1.2 | Task note | Same flow with custom note | **Note:** line shows `TaskNote`; SharePoint row has `TaskNote` if column exists. |
| 1.3 | Manual accommodation task | Accommodation card → **Create a task** → save | Row appears with `ManualEntryTask`; meta shows parent context; day label matches **parent itinerary day** (not stale `DayId` on reminder). |
| 1.4 | Cancellation deadline task | Save accommodation with **Cancellation deadline** set | Auto row with `CancellationDeadline`; title/note pattern per spec; editing deadline updates same row (no duplicate). |
| 1.5 | Clear deadline | Remove cancellation deadline → save | Auto cancellation reminder removed from list (if implemented). |
| 1.6 | Complete / delete reminder | Use **Complete** and **Delete** on custom rows | List refreshes; no console errors. |

---

## 2. Itinerary ordering and drag (B2 + follow-ups)

| # | Case | Steps | Expected |
|---|------|--------|----------|
| 2.1 | Same-day reorder | Day with multiple entries → drag card | Order matches after **F5**; `SortOrder` persisted for that `dayId`. |
| 2.2 | Mixed carryover + native day | Day showing carryover accommodation + native items → reorder across them | After reload, order correct **per home `dayId`** (carryover keeps parent day’s order segment). |
| 2.3 | Accommodation handle | Accommodation card on timeline | Drag handle visible (not hidden for category). |
| 2.4 | Move to sidebar day | Drag entry onto **another day** in sidebar | Entry’s **DayId** and **SortOrder** (last on target day) persist after reload. |

---

## 3. Pre-trip and span (N7)

| # | Case | Steps | Expected |
|---|------|--------|----------|
| 3.1 | Pre-trip isolation | Multi-night hotel starting Day 1 → select **Pre-trip** | Pre-trip shows **only** entries whose `dayId` is the pre-trip day; **no** carryover from Day 1. |
| 3.2 | Carryover on real days | Same hotel → Day 2, Day 3 | Hotel still appears on covered calendar days (not pre-trip). |

---

## 4. Google Maps (B3)

| # | Case | Steps | Expected |
|---|------|--------|----------|
| 4.1 | Accommodation | Expand accommodation with address | **View on map** opens place search; **Get directions** opens directions; both `target="_blank"` `rel="noopener noreferrer"`. |
| 4.2 | Activities | Same on activities card with address | Same behaviour. |

---

## 5. OData / legacy tenant (B4)

| # | Case | Steps | Expected |
|---|------|--------|----------|
| 5.1 | Itinerary without new columns | Tenant **without** Phase 7 columns on `ItineraryEntries` (or simulate 400 on `$select`) | App loads itinerary; console **warn** about fallback; no hard crash. |
| 5.2 | Reminders without `TaskNote` | List without `TaskNote` | `getForTrip` retries without field; tasks still load. |

---

## 6. Accommodation fields (N2, N4)

| # | Case | Steps | Expected |
|---|------|--------|----------|
| 6.1 | Perks / cancellation / deadline | Edit accommodation → fill fields → save | Values persist; expanded card shows text; deadline formatted sensibly. |
| 6.2 | Cancellation task indicator | With deadline + auto task | Expanded shows **Cancellation task created** when reminder exists. |
| 6.3 | Dual currency per night | Amount in **non–home** currency | Collapsed/amount row shows **native** total and per-night, **home** in brackets (FX path used elsewhere). |

---

## 7. Cruise (N5)

| # | Case | Steps | Expected |
|---|------|--------|----------|
| 7.1 | New fields | Cruise entry → edit → fill reference, line, ship, cabin, package, inclusions | Persist and show in collapsed/expanded card per spec. |
| 7.2 | Supplier hidden | Cruise category | Generic **Supplier** hidden when cruise-specific line is used; `CruiseLineName` is primary input. |

---

## 8. Transport (N6)

| # | Case | Steps | Expected |
|---|------|--------|----------|
| 8.1 | From / To / Mode | Create transport with blank title but From+To+Mode | Saves; display title derives `From → To (Mode)`. |
| 8.2 | Return leg | Return journey + return date on a later day | That day shows reversed **To → From** (or title + return behaviour per implementation). |

---

## 9. Delete and reminder hygiene

| # | Case | Steps | Expected |
|---|------|--------|----------|
| 9.1 | Delete parent with sub-items | Delete itinerary parent that has options/sub-rows | Children removed from UI; SP child rows deleted where applicable; reminders with matching `EntryId` removed. |
| 9.2 | Delete sub-item only | Delete one option row | Its Option reminders removed; parent unchanged. |

---

## 10. Regression smoke

- **Journal / photos / files / map** tabs open without errors.  
- **Create trip**, **day sidebar**, **budget rollup** still behave.  
- **Shared preview** / summary panels if used: pre-trip guard does not break totals.

---

## 11. Build and package (developer)

- **`npm run build`** (includes `--clean`) may hit **EBUSY** under Dropbox; use **`npx heft test --production`** then **`npx heft package-solution --production`**; if packaging fails cleaning `debug`, remove `sharepoint/solution/debug` manually and retry.  
- Ship **`sharepoint/solution/travel-hub.sppkg`** from App Catalog.

---

## Sign-off

| Area | Tester | Date | Pass / Fail / Notes |
|------|--------|------|---------------------|
| Tasks & reminders | | | |
| Drag & order | | | |
| Pre-trip | | | |
| Maps | | | |
| OData fallback | | | |
| Accommodation | | | |
| Cruise / Transport | | | |
| Deletes | | | |
