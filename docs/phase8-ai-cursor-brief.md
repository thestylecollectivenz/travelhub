# Travel Hub — Phase 8 AI Integration: Cursor Implementation Brief

**Version:** 1.0  
**Date:** May 2026  
**Applies to:** SPFx codebase, repo https://github.com/thestylecollectivenz/travelhub.git  
**Current version:** 1.0.9.4  
**Read alongside:** Functional Specification v1.0, Extended Scope v1.0, Extended Scope 2 v1.0, Extended Scope 3 v1.0, Architecture and Deployment Strategy v1.1

---

## 0. Before You Start — Required Reading

Read these files from the repo before touching any code:

- `src/utils/locationInfoEntry.ts` — current JSON shape for Location info card notes; your schema work starts here
- `src/utils/locationInfoCardSync.ts` — when cards are auto-created; triggers matter for generation logic
- `src/components/itinerary/LocationInfoHighlights.tsx` — the UI you will wire up; refresh buttons are currently disabled
- `src/components/itinerary/ItineraryCardEditCategoryLayouts.tsx` — edit layout for Location info cards
- `src/services/ConfigService.ts` — how UserConfig is read/written; follow this pattern exactly for `geminiApiKey`
- `src/styles/global.css` — all colour tokens; you will need category and status tokens for new UI
- `.cursor/rules/travel-planner.mdc` — workspace rules; follow without exception

Do not proceed past reading these files. The answers to most implementation questions are in them.

---

## 1. Scope of This Brief

This brief covers **Phase 8 AI only** — the wiring of Google Gemini API to generate and refresh Location info card content (overview + highlights). Affiliate links (Phase 8b) are **explicitly out of scope** and must not be built here. The `AppConfig` SharePoint list is not required for this phase.

**What this phase delivers:**

1. `geminiApiKey` read from UserConfig and surfaced in Settings
2. A `GeminiService` that calls the Gemini API and returns structured JSON
3. Auto-generation of Location info card content when a card is first created with no AI content
4. Manual per-section refresh buttons (currently disabled) wired up and working
5. A "Research all" / "Regenerate" action at the card level
6. AI-generated content visible in the shared trip view (it is place-level information, not private)
7. Graceful degradation when no API key is set or the API call fails
8. Cache stored on the Location info card notes (existing pattern) — **not** on the Places list for v1 (see Section 4)
9. A Settings UI field for the Gemini API key, following the exact same pattern as `weatherApiKey`

**What this phase does NOT deliver:**

- Affiliate links or AppConfig list (Phase 8b)
- Sightseeing preference profile (post-MVP — do not add to UserConfig yet)
- Cross-trip checklist progress view (deferred)
- Per-day AI suggestions separate from Location info cards (direction has shifted to per-place cards)
- Places list `BestKnownFor` column (deferred — see Section 4 for rationale)

---

## 2. Decisions Already Made — Do Not Re-Litigate

These are confirmed. Do not propose alternatives:

- **Provider:** Google Gemini API. No other provider.
- **Key storage:** `geminiApiKey` on the existing UserConfig SharePoint list. Same pattern as `weatherApiKey`. The column has already been added to the list manually — do not add provisioning code to create it; add provisioning code only to read/write it.
- **Key entry:** User enters their own Gemini API key in the Settings panel. No bundled key in v1.
- **Generation trigger:** Automatic on first card creation if key is set and card has no AI content. Manual refresh available at any time per section and at card level.
- **Cache location:** Location info card notes JSON (existing `locationInfoEntry.ts` shape, extended). Not the Places list. See Section 4.
- **Shared view:** AI-generated place content (overview, sights, food, drink, souvenirs) is visible to shared-view followers. It is generic place information, not private or financial.
- **Graceful degradation:** If no key is set, or the API call fails, the UI shows manual-entry mode with a prompt to add a key in Settings. The app must remain fully functional without AI content.
- **No modals:** All UI follows the existing inline/slide-in pattern. No modal dialogs.
- **No external icon libraries:** Inline SVG only, consistent with existing codebase.
- **All colours from CSS tokens:** No hardcoded hex values except neutral greys with no token equivalent.

---

## 3. Questions for Cursor to Answer From the Codebase

Before implementing anything in Sections 5–9, Cursor must read the relevant files and answer these questions in a short internal comment block at the top of each new file it creates. This ensures implementation matches the actual codebase state, not assumptions.

**From `locationInfoEntry.ts`:**
- What is the exact current TypeScript interface shape? List every field.
- Which fields are legacy (e.g. `iconicSights`, `foodDrink` as plain text) vs current (checklist arrays)?
- What is the serialise/parse pattern — does it use a named function or inline JSON.parse?

**From `locationInfoCardSync.ts`:**
- What event or hook triggers card creation — is it called from DayHeader, a service, or elsewhere?
- Does it pass the place name and country to the card on creation, or only the placeId?
- Is there a callback or event after card creation that Phase 8 can hook into for auto-generation?

**From `LocationInfoHighlights.tsx`:**
- What props does the component currently accept?
- How are the four sections (sights, food, drink, souvenirs) currently rendered — are they already in separate state or one combined array?
- Where exactly are the refresh buttons rendered and what is their current disabled state controlled by?

**From `ConfigService.ts`:**
- What is the exact method signature for reading and writing a UserConfig field?
- Does it batch-read all fields on load or read per-field? Follow the same pattern for `geminiApiKey`.

**From the existing Settings panel component:**
- What component renders the `weatherApiKey` field? Replicate that exact pattern for `geminiApiKey`.
- What validation (if any) is applied to the API key field before saving?

---

## 4. Data Model and Cache Strategy

### 4.1 Cache on Location Info Card Notes (v1 approach)

AI-generated content is stored in the Location info card's notes JSON, which is already serialised via `locationInfoEntry.ts`. This is the existing cache location for all Location info content. Extend the interface — do not replace it.

**Rationale for not using Places list `BestKnownFor` in v1:**
The Places list cache was specified in Extended Scope 2 for cross-trip deduplication — generate once per place, reuse across trips. This is the right long-term direction. However, it introduces sync complexity: the Places list record must be kept in sync with potentially multiple Location info cards across trips, and the Places list schema change requires provisioning coordination. For v1, storing on the card is simpler, already working, and sufficient. The migration path to Places list cache is clean — when `BestKnownFor` is added later, `GeminiService` checks the Places record first and falls back to generating fresh. Do not build that path now.

### 4.2 Extended `LocationInfoEntry` Interface

Read the current interface from `locationInfoEntry.ts` first. Then extend it with the following fields. **Do not remove or rename any existing fields** — append only, consistent with the data safety rules in Architecture and Deployment Strategy v1.1 §5.

```typescript
// ADD to existing LocationInfoEntry interface — do not replace existing fields
aiGenerated?: boolean;           // true if current content was AI-generated
aiGeneratedAt?: string;          // ISO timestamp of last generation
aiModel?: string;                // e.g. "gemini-2.0-flash" — for future model tracking
aiError?: string;                // last error message if generation failed, cleared on success
```

The four highlight arrays (`iconicSightsItems`, `foodDrinkItems`, `drinkItems`, `souvenirItems`) and the `overview` field already exist (or their legacy equivalents do). Confirm their exact names from the file before using them. The AI will populate these same arrays — it does not need new fields for the highlight content itself.

### 4.3 JSON Schema for Gemini Response

The Gemini API must return **only** the following JSON — no markdown fences, no preamble, no explanation. Enforce this in the prompt (see Section 6).

```json
{
  "overview": "2–3 sentence factual overview of the place for a traveller",
  "sights": [
    { "label": "Eiffel Tower", "done": false },
    { "label": "Louvre Museum", "done": false }
  ],
  "food": [
    { "label": "Croissants and café au lait", "done": false }
  ],
  "drink": [
    { "label": "Bordeaux wine", "done": false }
  ],
  "souvenirs": [
    { "label": "Miniature Eiffel Tower", "done": false }
  ]
}
```

Rules for this schema:
- `overview`: 2–3 sentences maximum. Factual, traveller-relevant. No marketing language.
- Each array: 3–5 items maximum. Specific and concrete, not generic ("try the local food" is not acceptable).
- `done` is always `false` from the AI — it is a user-controlled checklist state and must never be overwritten by a refresh. See Section 7.3 for merge rules.
- All fields required. If the API returns a partial response, treat it as an error.

---

## 5. GeminiService — Implementation

Create `src/services/GeminiService.ts`. This is the only file permitted to contain Gemini API calls. No component or hook may call the Gemini API directly — all calls go through this service.

### 5.1 Interface

```typescript
export interface LocationInfoAIResult {
  overview: string;
  sights: Array<{ label: string; done: boolean }>;
  food: Array<{ label: string; done: boolean }>;
  drink: Array<{ label: string; done: boolean }>;
  souvenirs: Array<{ label: string; done: boolean }>;
}

export interface GeminiServiceOptions {
  apiKey: string;
  model?: string; // default: "gemini-2.0-flash"
}
```

### 5.2 Method

```typescript
generateLocationInfo(
  placeName: string,
  country: string,
  options: GeminiServiceOptions
): Promise<LocationInfoAIResult>
```

### 5.3 Implementation Rules

- Use `fetch` directly — no SDK dependency. The Gemini REST API does not require a client library.
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
- Pass `placeName` and `country` to the prompt (Section 6). Do not pass any user data, financial data, or itinerary content to the API.
- Set `temperature: 0.4` and `maxOutputTokens: 800` in the generation config. These are intentionally conservative — the output is structured and should not be creative.
- Parse the response text as JSON. If JSON.parse fails, throw a typed error: `{ code: 'PARSE_ERROR', message: string }`.
- If the API returns a non-200 status, throw: `{ code: 'API_ERROR', status: number, message: string }`.
- If the API key is missing or empty, throw immediately: `{ code: 'NO_KEY' }` — do not make the network call.
- The service must not cache, store, or log any data. It is a pure request/response function.
- Wrap the entire function in try/catch. Never let an unhandled rejection propagate to a component.

### 5.4 Model Selection

Use `gemini-2.0-flash` as the default. This is the current free-tier model with sufficient capability for structured JSON generation. Store the model name as a constant at the top of the file so it can be updated in one place when Gemini releases newer models.

---

## 6. Prompt Design

The prompt is a constant in `GeminiService.ts`. It must be deterministic — same place, same structure, similar output. Do not make it conversational.

```
You are a travel reference assistant. Generate factual, concise travel highlights for a specific place.

Place: {placeName}
Country: {country}

Respond with ONLY a JSON object. No markdown, no code fences, no explanation. Exactly this structure:
{
  "overview": "2-3 sentences about this place relevant to a visitor",
  "sights": [{"label": "specific sight or attraction", "done": false}],
  "food": [{"label": "specific local food dish or cuisine", "done": false}],
  "drink": [{"label": "specific local drink or beverage", "done": false}],
  "souvenirs": [{"label": "specific souvenir or locally made product", "done": false}]
}

Rules:
- overview: 2-3 sentences maximum, factual, no marketing language
- Each array: 3-5 items, specific and concrete (not generic like "try local food")
- done is always false
- All five fields required
- No additional fields
```

Substitute `{placeName}` and `{country}` from the place record. Both are already on the Place object from `PlaceService` — confirm the exact field names from the codebase before using them.

---

## 7. Generation Triggers and Refresh Logic

### 7.1 Auto-Generation on Card Creation

When a Location info card is created by `locationInfoCardSync.ts`:

1. Check if `geminiApiKey` is set in UserConfig (read from ConfigService — do not make a separate SP call)
2. Check if the card's `locationInfoEntry` already has `aiGenerated: true` — if so, skip
3. If key is set and no prior AI content exists, call `GeminiService.generateLocationInfo` with the place name and country
4. On success: merge the result into the card's notes JSON (see Section 7.3) and save via the data service
5. On any error: set `aiError` on the entry, save, and continue — do not block card creation or throw to the user

This must be fire-and-forget from the card creation perspective. Card creation must complete and render immediately. AI generation runs after and updates the card when complete. The UI must handle the loading state gracefully (Section 8.3).

### 7.2 Manual Refresh — Per Section

The four refresh buttons in `LocationInfoHighlights.tsx` (currently disabled) must be wired to regenerate a single section only. This means:

- On click: call `GeminiService.generateLocationInfo` for the full place (the API does not support per-section calls)
- On success: merge only the relevant section from the result into the existing entry, preserving all other sections and all `done` states (Section 7.3)
- Show a spinner on the specific section button during the call
- On error: show an inline error message under that section — do not clear existing content

### 7.3 Merge Rules — Critical

**Never overwrite `done: true` values.** When merging AI-generated content into an existing entry:

- For each highlight array (sights, food, drink, souvenirs):
  - Build a map of `label → done` from the existing items
  - For each new AI item: if the same label exists in the existing map, preserve the existing `done` value; if it is a new label, add it with `done: false`
  - Items that exist in the current array but not in the new AI response: **keep them** — the user may have added them manually or checked them off
- For `overview`: replace entirely — it is not a checklist and has no user state to preserve
- Always update `aiGeneratedAt` to the current ISO timestamp
- Always update `aiModel` to the model string used

This merge logic must live in a pure utility function in `src/utils/locationInfoEntry.ts` alongside the existing parse/serialise functions. Call it `mergeAIResult(existing: LocationInfoEntry, result: LocationInfoAIResult, section?: 'sights' | 'food' | 'drink' | 'souvenirs'): LocationInfoEntry`. When `section` is specified, only that array is updated. When `section` is omitted, all arrays and the overview are merged.

### 7.4 "Research All" / Regenerate Card Action

Add a "Research with AI" button at the card header level (currently shown as disabled placeholder). This triggers a full generation: all four sections and overview are regenerated and merged. Merge rules from Section 7.3 apply. The button must:

- Show loading state during the call
- Be disabled while any per-section refresh is in progress
- On success: update `aiGeneratedAt` and display a brief success indicator (not a toast — inline, auto-dismissing)
- On error: show an inline error in the card header area with a retry option

---

## 8. UI Changes

### 8.1 Settings Panel — Gemini API Key Field

Find the component that renders the `weatherApiKey` settings field. Add `geminiApiKey` immediately below it, using the **exact same component pattern and layout**. Do not deviate from that pattern.

Label: `Gemini API key`  
Helper text: `Required for AI-generated place highlights. Get a free key at aistudio.google.com`  
Input type: `password` (masked by default, toggle to show)  
Validation: trim whitespace before saving; do not validate the key format (the API call will fail if invalid)  
Save: same write pattern as `weatherApiKey` via ConfigService

Do not add any other AI-related settings in this phase. Sightseeing preferences are post-MVP.

### 8.2 Location Info Card — No Key State

When `geminiApiKey` is not set and the card has no AI content:

- The four highlight sections render in manual-entry mode (already works)
- Show a subtle inline prompt: "Add a Gemini API key in Settings to auto-generate highlights"
- This prompt links to the Settings panel (use the existing Settings navigation pattern)
- Do not show this prompt if the card already has content (AI-generated or manually entered)

### 8.3 Loading State During Generation

While auto-generation or a refresh is in progress:

- Show a small inline spinner in the relevant section header (or card header for full regeneration)
- The rest of the card must remain interactive — do not lock the card
- The spinner must use the existing spinner/loading pattern from the codebase — find it and reuse it; do not create a new one

### 8.4 Error State

When generation fails:

- Show an inline error message in the affected section: "Couldn't generate highlights. Check your API key in Settings or try again."
- Include a "Retry" link that re-triggers the same generation call
- Do not clear existing content on error
- Store the error message in `aiError` on the entry so it persists across sessions (the user can see why it failed on next load)
- Clear `aiError` on the next successful generation

### 8.5 Shared View

AI-generated highlights (overview, sights, food, drink, souvenirs) are visible in the shared trip view. They are place-level generic information, not private or financial.

Confirm that `SharedTripView` and `SharedDayPanel` render Location info cards. If they do not currently render them, add them — they should appear in the shared view in read-only mode (no edit, no refresh buttons, no "Research with AI" button). The `done` checkboxes must also be read-only in the shared view.

---

## 9. ConfigService Extension

Read `ConfigService.ts` before making any changes. Follow the exact existing pattern.

Add `geminiApiKey` to:
1. The UserConfig TypeScript interface (wherever it is defined — likely `src/models/UserConfig.ts` or inline in ConfigService)
2. The read method — include `geminiApiKey` in the fields fetched from SharePoint
3. The write/update method — include `geminiApiKey` in the update payload
4. The default value — empty string `''`

Do not add provisioning code to create the column — it already exists on the list. If you see a provisioning section that creates UserConfig columns, add `geminiApiKey` to that list for future fresh installs only. Do not run any destructive provisioning against the existing list.

---

## 10. File and Component Summary

Files to **create**:
- `src/services/GeminiService.ts` — Gemini API client, typed errors, no caching

Files to **modify**:
- `src/utils/locationInfoEntry.ts` — extend interface with AI fields; add `mergeAIResult` utility
- `src/utils/locationInfoCardSync.ts` — hook auto-generation after card creation
- `src/components/itinerary/LocationInfoHighlights.tsx` — wire refresh buttons, loading/error states, no-key prompt
- `src/components/itinerary/ItineraryCardEditCategoryLayouts.tsx` — wire "Research with AI" card-level action
- `src/services/ConfigService.ts` — add `geminiApiKey` read/write
- Settings panel component (identify from codebase) — add Gemini API key field
- `SharedTripView` / `SharedDayPanel` (confirm from codebase) — ensure Location info cards render in shared view

Files **not to touch**:
- Any financial service or model
- Any SharePoint list provisioning beyond UserConfig field inclusion
- Any file outside `src/` unless it is a version bump in `src/appVersion.ts` and `config/package-solution.json`

---

## 11. Technical Constraints (Non-Negotiable)

These apply without exception. They are carried forward from Extended Scope v1.0 §6 and Architecture and Deployment Strategy v1.1:

- All colours from `src/styles/global.css` tokens — zero hardcoded hex values (neutral greys without tokens may use hex)
- No external icon libraries — inline SVG only
- No modal dialogs — inline expand or slide-in panels only
- All SharePoint writes through `ITravelHubDataService` — no inline REST calls in components
- `npm run build` must pass clean after every task
- `git add`, `git commit`, and `git push` after every task
- Git remote: `https://thestylecollectivenz@github.com/thestylecollectivenz/travelhub.git`
- All SharePoint column additions are append-only — never delete or rename existing columns
- FX and AI calls must degrade gracefully — the app must remain fully functional when either is unavailable
- No assumptions about NZD — all financial display uses configured home currency (this phase does not touch financials, but do not introduce any financial logic that breaks this)
- No SharePoint URLs in components — all data access through `ITravelHubDataService`

---

## 12. Build Order

Implement in this order. Each step must pass `npm run build` before proceeding.

| # | Task | Files | Risk |
|---|------|-------|------|
| 1 | Read codebase files listed in Section 3; answer all questions in a comment | — | Low — read only |
| 2 | Extend `LocationInfoEntry` interface and add `mergeAIResult` utility | `locationInfoEntry.ts` | Low — additive only |
| 3 | Add `geminiApiKey` to ConfigService and UserConfig model | `ConfigService.ts`, model file | Low — additive |
| 4 | Add Gemini API key field to Settings panel | Settings component | Low — UI only |
| 5 | Create `GeminiService.ts` with `generateLocationInfo` | New file | Medium — external API |
| 6 | Wire auto-generation in `locationInfoCardSync.ts` | `locationInfoCardSync.ts` | Medium — async timing |
| 7 | Wire per-section refresh buttons in `LocationInfoHighlights.tsx` | `LocationInfoHighlights.tsx` | Medium — state management |
| 8 | Wire "Research with AI" card-level action | `ItineraryCardEditCategoryLayouts.tsx` | Medium — depends on steps 5–7 |
| 9 | Add no-key prompt and error/loading states | `LocationInfoHighlights.tsx` | Low — UI only |
| 10 | Confirm shared view renders Location info cards correctly | `SharedTripView`, `SharedDayPanel` | Low — read-only render |
| 11 | Full build, test, version bump, commit, push | `appVersion.ts`, `package-solution.json` | Low |

---

## 13. Version Bump

When all tasks are complete and `npm run build` passes clean:

- Bump version from `1.0.9.4` to `1.0.10.0` in `src/appVersion.ts` and `config/package-solution.json`
- Commit message: `Phase 8 AI: Gemini integration for Location info cards`
- Push to remote

Do not bump the version mid-task. One version bump at the end of the phase.

---

## 14. What Comes Next (Do Not Build Now)

For context only — do not implement any of this in this phase:

- **Phase 8b — Affiliate links:** `AppConfig` SharePoint list, affiliate URL buttons on itinerary cards, remote config refresh from `travelhub.app`. Separate brief will be provided.
- **Places list `BestKnownFor` cache:** Cross-trip deduplication of AI content. Requires Places list schema change and sync logic. Deferred.
- **Sightseeing preferences:** User profile for personalising AI suggestions. Post-MVP. Do not add to UserConfig yet.
- **Phase 9 — Web installer and MSAL wrapper:** Separate project, separate brief.
