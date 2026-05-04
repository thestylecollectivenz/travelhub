# Travel Hub — Extended Scope 3

**Version:** 1.0  
**Last updated:** May 2026  
**Status:** Approved — to be treated as source of truth alongside Functional Spec v1.0, Extended Scope v1.0, and Extended Scope 2 v1.0  
**Read alongside:** Architecture and Deployment Strategy v1.1, Extended Scope v1.0, Extended Scope 2 v1.0, Functional Specification v1.0

---

## 1. Purpose of This Document

This document records scope decisions agreed during Phase 7 development. It supplements all prior spec documents and must be read alongside them before starting any new phase or feature work. Where conflicts exist, the document hierarchy in Architecture and Deployment Strategy v1.1 §11 applies, with this document treated as equal priority to Extended Scope 2 v1.0 for the items it covers.

---

## 2. Bug Fixes — Outstanding (Pre-Phase 8)

These bugs are not P7-7-specific. They must be resolved before Phase 8 begins.

### Bug F1 — Current Time Indicator in Place Info Not Working

The current local time display for the destination place (shown in the Place Info / day header area) is not showing or not updating correctly.

- **Likely location:** `DayHeader.tsx` — live clock or timezone offset logic is broken or not rendering
- **Expected behaviour:** Shows the current local time at the destination place, updating live (every minute is sufficient)
- **Fix scope:** Isolated to DayHeader — do not refactor weather or place data logic as part of this fix

### Bug F2 — Pre-Trip Day Shows Day 1 Accommodation Entry

The pre-trip day incorrectly shows the Day 1 accommodation entry. The fix in `src/utils/itineraryDayEntries.ts` (FIX-B) did not fully resolve this.

- **Rule:** The pre-trip day must only show entries whose `dayId` exactly matches the pre-trip day ID
- **Rule:** No calendar-span or carryover logic should attach any entry to the pre-trip day
- **Fix scope:** `itineraryDayEntries.ts` filtering logic only — do not change the carryover display logic for normal days

### Bug F3 — Print Produces Blank Pages

The print option (Day Planner view) produces blank pages in print preview and when printed.

- **Known causes to check:**
  - `@dnd-kit` DragOverlay portal renders as `position: fixed` blank layer over print output
  - `.dayHead` / `.timeAxis` must be `position: static` in print
  - `.previewBackdrop` must be hidden in print (`display: none`)
  - `DayPanel .root` must be `display: block` for print
- **Previous fix:** `className={styles.dragOverlayPrintRoot}` and global CSS selectors `[data-dnd-overlay]`, `[data-dnd-kit-drag-overlay]` — resolved Timeline print but not Day Planner print
- **Expected behaviour:** Print output matches the Day Planner view currently showing on screen

### Bug F4 — Day Planner Edit Panel Too Narrow

When editing an itinerary entry from within the Day Planner column view, the edit panel attempts to open within the column width, which is too narrow to be usable.

- **Expected behaviour:** The edit panel opens at its standard full width, overlaid on top of the columns (not constrained by them), in the same position and size as it appears in the Timeline view
- **Implementation note:** This is a z-index / positioning fix — the panel should use the same `slide-in panel` pattern as Timeline editing, not be constrained to the column's bounding box. No modal dialogs — the existing slide-in panel approach is correct, it just must not be trapped inside the column layout

---

## 3. Spec Tension Resolution — Modal Preview in Day Planner

**Decision:** The read-only preview in the Day Planner (currently implemented as `previewBackdrop` / `previewDialog`) is **permitted as an exception** to the no-modal-dialogs rule, for the Day Planner view only.

**Rationale:** The Day Planner grid layout makes inline expand impractical without disrupting the grid structure. The preview is read-only (not a form), and the visual treatment is consistent with a "peek" behaviour rather than a blocking workflow dialog.

**Constraints:**
- The preview must remain dismissible by clicking outside it (backdrop click)
- The preview must be hidden completely in print output
- The preview must not be used for editing — editing always opens the standard slide-in panel
- This exception does not extend to any other part of the application

**Document update:** Extended Scope v1.0 §6 constraint "No modal dialogs — inline expand or slide-in panels only" is amended to read: "No modal dialogs — inline expand or slide-in panels only. Exception: the Day Planner read-only entry preview is permitted as a non-blocking overlay."

---

## 4. New Scope Items

### Item ES3-1 — Zero-Value Item View

**What:** A way to view all itinerary items that have $0 entered (or no amount entered) across the trip.

**Where it fits:** Add as a filter option within the existing Reminder/Task view (Phase 7 deliverable). No new tab needed.

**What to build:**
- Add a filter chip or toggle in the Reminder/Task view: "Missing amounts" or "No cost entered"
- When active, the view shows all itinerary items where the primary amount is zero, null, or not entered
- Display includes: day, category, item title, current amount (shown as $0 or blank)
- Each item links back to its day/card for editing
- This is a read-only filtered list — editing happens by navigating to the item, not inline in this view

**SharePoint impact:** None — derived from existing `Amount` field on `ItineraryEntries` list.

**Phase:** Add to Phase 7 as task P7-8.

---

### Item ES3-2 — Options: Enhanced Fields

**What:** Options (sub-items beneath an itinerary card) need additional fields and capabilities.

**Current state:** Options support status and cost details (per Functional Spec §20).

**New fields and capabilities per option:**
- **Booking required** — Yes/No toggle (default: No)
- **Link(s)** — one or more URLs attached to the option (same pattern as item-level links)
- **File(s)** — one or more file attachments attached to the option (same pattern as item-level attachments)
- **Add to tasks** — action button that promotes the option to the Reminder/Task view as an outstanding item

**Display:**
- Booking required flag shown on the option row
- Link and file counts shown as icon badges on the option row, clickable to open
- "Add to tasks" shown as a small action button or icon on the option row

**SharePoint impact:**
- `ItinerarySubItems` list (or equivalent): add `BookingRequired` (Yes/No), `Links` (multi-line text, JSON array of URLs), `AttachmentLinks` (multi-line text, JSON array of file references)
- Task promotion: creates a record in the tasks/reminders list referencing the sub-item

**Phase:** Phase 8 prerequisite — implement before Phase 8 AI work begins. Add as task P7-9.

---

### Item ES3-3 — Accommodation Tile: Free Drag Positioning

**What:** Accommodation entries currently cannot be moved to some positions in the tile order within a day. This restriction must be removed.

**Rule:** Accommodation entries must be moveable to any position in the day's tile order, including first, last, and between any other entry types.

**Implementation note:** The drag-and-drop and explicit move logic must not apply category-based positioning restrictions. If a category-based sort or constraint is causing this, it must be removed for user-initiated reordering. The user's chosen order is always respected.

**Affected files:** Drag-and-drop logic in the itinerary day view, any sort/order enforcement in the data service write path.

**Phase:** Current fix pass — treat as Bug F5.

---

### Item ES3-4 — Transport: Return Journey Support

**What:** Transport itinerary entries need to support return journeys with separate dates and times.

**New fields on transport entries:**
- **Journey type** — One way / Return (toggle or dropdown, default: One way)
- **Outbound date** — date of outbound leg (already exists as entry date — relabel if needed)
- **Outbound time** — departure time of outbound leg (already exists as entry time)
- **Return date** — date of return leg (shown only when Journey type = Return)
- **Return time** — departure time of return leg (shown only when Journey type = Return)

**Display behaviour:**
- When Journey type = Return, the transport tile appears **twice** in the day view — once on the outbound date at the outbound time, and once on the return date at the return time
- The return instance is visually marked as "Return" (e.g. label or icon)
- Both instances link to the same underlying itinerary entry for editing
- Financial roll-up counts the entry once only (on the outbound day), regardless of return status

**Day Planner:** Return leg appears as a block on the return date column at the return time, same visual treatment as the outbound block but with "Return" label.

**SharePoint impact:**
- `ItineraryEntries` list: add `JourneyType` (text: "oneway" | "return"), `ReturnDate` (date), `ReturnTime` (text, HH:MM format)

**Phase:** Phase 8. Add as task P8-prereq-1 (before AI work).

---

### Item ES3-5 — Currency Picklist Order

**What:** The currency selection dropdown must order currencies with the most-used ones at the top, followed by all remaining currencies in alphabetical order.

**Top currencies (pinned to top, in this order):**
1. NZD — New Zealand Dollar
2. AUD — Australian Dollar
3. USD — United States Dollar
4. EUR — Euro
5. GBP — British Pound
6. JPY — Japanese Yen
7. SGD — Singapore Dollar
8. THB — Thai Baht
9. CAD — Canadian Dollar
10. HKD — Hong Kong Dollar

**Remaining currencies:** All other ISO 4217 currencies in alphabetical order by currency code.

**Visual separator:** A visual divider or group label separates the pinned top currencies from the alphabetical list.

**Affected locations:** All currency dropdowns in the app — itinerary card edit, config panel home currency selector, any other currency picker.

**Phase:** Current fix pass — treat as Bug F6.

---

### Item ES3-6 — Preview Mode: Options Display

**What:** In the read-only preview of an itinerary card (both Timeline expand-in-place and Day Planner preview overlay), related options/sub-items must be displayed more clearly.

**New display rules:**
- Each option appears on its own line
- Each option line includes: title, time (if specified), duration (if specified), status badge, cost (if entered)
- Booking required flag shown if set
- Link and file count badges shown if present
- Options are not collapsed by default in preview — they are shown expanded

**Phase:** Current fix pass. Add as task F7.

---

### Item ES3-7 — Accommodation: Additional Fields

**What:** Accommodation itinerary entries need dedicated fields beyond the current generic fields.

**New fields:**
- **Booking reference** — single line text
- **Room type** — single line text (e.g. "Deluxe King", "Standard Twin")
- **Check-in time** — time field (HH:MM)
- **Check-out time** — time field (HH:MM)
- **Address** — single line text (street address of the property)
- **Google Maps link** — derived automatically from the address using the same deep-link pattern as Item ES3-9: `https://www.google.com/maps/dir/?api=1&destination={encodedAddress}` — shown as "Open in Google Maps" link on the card

**Display on tile/card:** Show booking reference, room type, check-in/check-out times, and Google Maps link in the card detail view. Do not show all fields in the collapsed card summary — show only the most operationally relevant (check-in time, booking reference).

**SharePoint impact:**
- `ItineraryEntries` list: add `BookingReference` (text), `RoomType` (text), `CheckInTime` (text HH:MM), `CheckOutTime` (text HH:MM) — `Address` field already added per Extended Scope 2 Item 3

**Phase:** Phase 8 prerequisite. Add as task P7-10.

---

### Item ES3-8 — Flights: Additional Fields

**What:** Flight itinerary entries need dedicated fields.

**New fields:**
- **Booking reference** — single line text (PNR / booking code)
- **Flight number(s)** — single line text (e.g. "NZ1 / NZ402" for connections)
- **Check-in closes** — time field (HH:MM) — the time by which check-in must be completed
- **Class** — dropdown: Business / Premium Economy / Economy (default: Economy)

**Display on tile/card:** Show flight number(s), booking reference, check-in closes time, and class in the card detail view. Collapsed summary shows flight number and class.

**SharePoint impact:**
- `ItineraryEntries` list: add `FlightNumbers` (text), `CheckInClosesTime` (text HH:MM), `CabinClass` (text: "business" | "premium_economy" | "economy") — `BookingReference` field added per ES3-7 above (shared column)

**Note:** `BookingReference` is a shared column applicable to Accommodation, Flights, and Activities. It is added once to `ItineraryEntries` and shown/hidden per category in the edit UI.

**Phase:** Phase 8 prerequisite. Add as task P7-11.

---

### Item ES3-9 — Activities: Additional Fields

**What:** Activity itinerary entries need dedicated fields.

**New fields:**
- **Booking reference** — single line text (shared column per ES3-7 note above)
- **Address** — single line text (already added per Extended Scope 2 Item 3 — confirm it is surfaced in the Activities edit UI)
- **Google Maps link** — derived from address, same pattern as ES3-7: `https://www.google.com/maps/dir/?api=1&destination={encodedAddress}` — shown as "Open in Google Maps" on the card

**Display on tile/card:** Show booking reference and Google Maps link. Address shown in full in expanded/detail view.

**Phase:** Phase 8 prerequisite. Add as task P7-12.

---

### Item ES3-10 — Files and URLs Directly from New/Edit Screen

**What:** Users must be able to attach files and URLs to an itinerary entry directly from the entry's new/edit screen, without needing to go to the Documents or Links views.

**Current state:** Files and URLs are managed in the Documents and Links views (Phase 5). Entries can be linked to existing documents/links, but adding new ones requires navigating away.

**What to build:**
- In the itinerary card edit panel, add an "Attachments" section
- Within this section, allow the user to:
  - Upload a new file (goes to SharePoint document library, linked to this entry)
  - Add a new URL (title + URL, linked to this entry)
  - See and remove existing attachments/links for this entry
- File upload uses the existing SharePoint document library pattern — no new storage approach
- This does not replace the Documents and Links views — it is additive

**Display:** Attachments section at the bottom of the edit panel, showing existing items and add buttons. Collapsed by default if no attachments; expanded if attachments exist.

**Phase:** Phase 8 prerequisite. Add as task P7-13.

---

### Item ES3-11 — Relevant Details Shown on Tiles

**What:** Category-specific fields added in ES3-7, ES3-8, and ES3-9 must be surfaced appropriately on the collapsed and expanded card views.

**Rules:**
- **Collapsed card:** Show the most operationally critical field(s) for each category — max 2 additional fields beyond the existing summary
- **Expanded/detail view:** Show all category-specific fields
- **Day Planner block:** Show title and time only (unchanged) — category-specific fields appear in the preview overlay

**Per-category collapsed additions:**
- Accommodation: Check-in time, Booking reference
- Flights: Flight number(s), Cabin class
- Activities: Booking reference (if set)
- Transport: Journey type indicator (Return badge if return journey)

**Phase:** Implement alongside ES3-7, ES3-8, ES3-9 (tasks P7-10 through P7-12).

---

### Item ES3-12 — Journal Entry Button on Journal and Photos Tabs

**What:** A "New journal entry" button must appear on both the Journal tab and the Photos tab, not only within the day journal feed area.

**Placement:**
- Journal tab: Button at the top of the tab content area (above the feed)
- Photos tab: Button at the top of the tab content area (above the album grid)

**Behaviour:** Opens the new journal entry form in the same way as the existing add-entry flow. On the Photos tab, the new journal entry form opens pre-focused on the photo upload field.

**Phase:** Current fix pass. Add as task F8.

---

### Item ES3-13 — Mobile Experience Priorities

**What:** The mobile phone experience must work well for a defined set of core workflows. iPad functionality is already specified as identical to desktop and is unchanged.

**Priority mobile workflows (must work well on phone):**

1. **Day Planner — today/tomorrow navigation** — single day at a time view, swipe or tap to move between days; full scroll within the day
2. **Create / edit journal entry** — full journal entry creation and editing, including text and photo upload
3. **Upload photo(s)** — direct photo upload from the phone camera roll or camera, from both journal entry and album views
4. **Trip day tile detail view and editing** — view full card details and edit them on a phone-sized screen; category-specific fields (ES3-7, ES3-8, ES3-9) must be readable and editable
5. **Open files and URLs** — tap to open attached files and URLs from card detail view
6. **Open Google Maps links** — tap to open Google Maps deep links (ES3-7, ES3-9) from card detail view; must open in the Google Maps app on the device where installed
7. **Task management** — view, filter, and mark tasks/reminders from the Task view
8. **Packing list management** — view, check off, and add items to the packing list

**Implementation principles:**
- These workflows must be usable with one hand where possible
- Touch targets must be at minimum 44px in the touch dimension
- Edit panels must not overflow or clip on a 390px viewport (iPhone standard width)
- The Day Planner single-day pager (already implemented) is the correct mobile pattern — confirm it meets the workflow requirements above
- No new separate mobile app — this is the responsive web experience within SharePoint (SPFx) and later the web app wrapper

**Phase:** Mobile audit and fixes to be done as part of Phase 8 prerequisite sprint (alongside P7-10 through P7-13). Add as task P7-14.

---

## 5. Revised Phase 7 Task List

| Task | Description | Status |
|------|-------------|--------|
| P7-1 through P7-6 | Original Phase 7 tasks | ✅ Complete (assumed) |
| P7-7 | Day Planner calendar grid | ✅ Substantially complete — bugs outstanding |
| P7-8 | Zero-value item view (ES3-1) | 🔜 |
| P7-9 | Options enhanced fields (ES3-2) | 🔜 |
| P7-10 | Accommodation additional fields (ES3-7) | 🔜 |
| P7-11 | Flights additional fields (ES3-8) | 🔜 |
| P7-12 | Activities additional fields (ES3-9) | 🔜 |
| P7-13 | Files/URLs from edit screen (ES3-10) | 🔜 |
| P7-14 | Mobile audit and priority workflow fixes (ES3-13) | 🔜 |
| F1 | Current time indicator fix | 🔜 |
| F2 | Pre-trip day accommodation fix | 🔜 |
| F3 | Print blank pages fix | 🔜 |
| F4 | Day Planner edit panel too narrow | 🔜 |
| F5 | Accommodation drag to any position | 🔜 |
| F6 | Currency picklist order | 🔜 |
| F7 | Preview mode options display | 🔜 |
| F8 | Journal entry button on Journal and Photos tabs | 🔜 |

---

## 6. SharePoint List Changes Summary

All changes are append-only per the data safety rules in Architecture and Deployment Strategy v1.1 §5.

| List | New Column | Type | Added For |
|------|-----------|------|-----------|
| ItineraryEntries | BookingReference | Single line text | ES3-7, ES3-8, ES3-9 |
| ItineraryEntries | RoomType | Single line text | ES3-7 |
| ItineraryEntries | CheckInTime | Single line text (HH:MM) | ES3-7 |
| ItineraryEntries | CheckOutTime | Single line text (HH:MM) | ES3-7 |
| ItineraryEntries | FlightNumbers | Single line text | ES3-8 |
| ItineraryEntries | CheckInClosesTime | Single line text (HH:MM) | ES3-8 |
| ItineraryEntries | CabinClass | Single line text | ES3-8 |
| ItineraryEntries | JourneyType | Single line text | ES3-4 |
| ItineraryEntries | ReturnDate | Date | ES3-4 |
| ItineraryEntries | ReturnTime | Single line text (HH:MM) | ES3-4 |
| ItinerarySubItems | BookingRequired | Yes/No | ES3-2 |
| ItinerarySubItems | Links | Multi-line text (JSON) | ES3-2 |
| ItinerarySubItems | AttachmentLinks | Multi-line text (JSON) | ES3-2 |

**Note:** `Address` on `ItineraryEntries` was already added in Extended Scope 2 Item 3. Confirm it is provisioned before implementing ES3-7 and ES3-9 edit UI.

---

## 7. Cursor Build Order

Implement in this order to manage risk and dependencies:

1. **F5, F6** — drag fix and currency order (no schema changes, low risk)
2. **F1, F2, F3, F4** — bug fixes (isolated, no schema changes)
3. **F7, F8** — UI additions (no schema changes)
4. **P7-8** — zero-value view (no schema changes)
5. **P7-10, P7-11, P7-12** — category-specific fields (schema changes — run provisioning check first)
6. **ES3-11** — tile display updates (depends on P7-10–12)
7. **P7-9** — options enhanced fields (schema changes to ItinerarySubItems)
8. **ES3-4** — transport return journey (schema changes to ItineraryEntries)
9. **P7-13** — files/URLs from edit screen (depends on Documents/Links service methods)
10. **P7-14** — mobile audit (depends on all above being stable)

After P7-14 is complete and passing, Phase 7 is closed. Proceed to web app wrapper (Phase 9 prerequisite) then Phase 8.

---

## 8. Technical Constraints (carry forward unchanged)

All constraints from Extended Scope v1.0 §6 and Architecture and Deployment Strategy v1.1 apply without exception. Key reminders:

- All colours from CSS tokens — no hardcoded hex
- No external icon libraries — inline SVG only
- No modal dialogs except the permitted Day Planner preview exception (§3 above)
- All SharePoint writes through `ITravelHubDataService` — no inline REST calls in components
- `npm run build` must pass clean after every task
- Git commit and push after every task
- All new SharePoint columns added with append-only provisioning — check before create, never delete
