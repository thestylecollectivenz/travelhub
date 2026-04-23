# Travel Hub — Extended Scope and Product Direction

**Version:** 1.0  
**Last updated:** April 2026  
**Status:** Approved — to be treated as source of truth alongside the functional spec

---

## 1. Purpose of This Document

This document records scope decisions, product direction, and architectural principles agreed during Phase 3 development. It supplements the functional spec and must be read alongside it before starting any new phase.

---

## 2. Architectural Principle — Build for Phase 9 from Day One

Travel Hub is being built with a long-term commercial distribution goal. Every development decision must bear this end goal in mind so that nothing needs to be rebuilt later.

**The end goal:** Travel Hub is distributed as a commercial SaaS product to Microsoft 365 users. Customers sign up via a website, click a button, and the app is automatically installed into their own Microsoft 365 tenant. Their data lives in their own SharePoint — the vendor never hosts or touches customer data.

**What this means in practice:**

- All SharePoint list and column names must remain stable — they are part of the provisioning contract
- No hardcoded tenant URLs, site URLs, or user identities anywhere in the codebase
- All configuration (home currency, units, preferences) must be stored per-user or per-trip in SharePoint, not hardcoded
- The app must work correctly when installed into any Microsoft 365 tenant, not just the development tenant
- Licence key validation must work against an external endpoint, not local logic (already implemented)
- No external dependencies that require separate installation or API keys from the customer
- FX rates and any other external API calls must fail gracefully — the app must remain functional without them

---

## 3. Commercial Distribution Model

**Platform:** Microsoft 365 / SharePoint Online  
**Target users:** Microsoft 365 Personal, Family, or Business subscribers  
**Distribution:** Web-based installer — customer visits website, pays, clicks Install, signs in with Microsoft, app provisions automatically into their tenant  
**Data residency:** Customer data lives entirely in the customer's own SharePoint tenant. The vendor has zero access to customer data.  
**Licence model:** Licence key issued at purchase, validated against vendor endpoint on app load

### Phase 9 — Web Installer (post-launch)

The web installer is a separate project to be built after the app reaches a stable v1.0. It consists of:

**Customer-facing website:**
- Marketing and pricing pages
- Sign-up and payment processing
- "Install to Microsoft 365" button triggering OAuth flow

**Provisioning backend (thin layer only):**
- Microsoft OAuth integration — customer signs in with their Microsoft account
- Microsoft Graph API calls to provision the app into their tenant:
  - Create SharePoint site
  - Enable App Catalog
  - Upload and deploy `travel-hub.sppkg`
  - Provision all SharePoint lists with correct columns
  - Create Travel Hub page and add web part
- Licence key generation and assignment
- Installation tracking (which tenants have the app installed)

**The backend does NOT:**
- Store any customer travel data
- Have ongoing access to the customer's tenant after installation
- Require customer data to pass through vendor infrastructure

**Estimated build effort:** 2–3 weeks after app reaches v1.0

---

## 4. Additional Feature Scope

The following features were reviewed and scoped into the phased build plan. They are not in the original functional spec but are now part of the agreed product scope.

### 4.1 Cleanup Sprint (between Phase 3 and Phase 4)

| Feature | Description |
|---|---|
| Countdown timer | Days until trip start, displayed in the trip hero area |
| Config panel | User-level settings: home currency, temperature units (°C/°F), distance units (km/miles), show/hide traveller names on trips |
| Hero image upload | Upload an image file directly to SharePoint from the trip creation panel and trip edit panel |
| Edit trip details | Inline editing of trip title, destination, dates, status, description, and hero image after creation |
| Day title inline editing | Click a day title in the sidebar or day header to edit it in place |
| Day type editing | Change a day's type (Place/Port, Sea, Travel/Transit, Pre-trip) via the day header or sidebar |
| Delete trip | Delete a trip and all associated days, entries, journal entries, and photos with a confirmation step |

**Config panel note:** Home currency is the most critical config item. It affects all financial display across the app. NZD is currently hardcoded — this must be generalised so any home currency can be selected. All financial rollups and display must convert to the selected home currency, not always NZD. This is a prerequisite for international users.

### 4.2 Phase 4 — Journal and Photos (unchanged from original spec)

No additional scope added. Proceed as originally planned.

### 4.3 Phase 5 — Documents, Links, Search (unchanged from original spec)

No additional scope added. Proceed as originally planned.

### 4.4 Phase 6 — Maps, Places, and Travel Intelligence

The following features are added to Phase 6 alongside the existing maps and places scope:

| Feature | Description |
|---|---|
| Primary location per day | Each day has one primary overnight location. This drives route maps, the country/city tracker, route strip, and place-based features below |
| Additional visited places per day | Day trips, side trips, and other visited locations during the day |
| Weather per place | Current weather and sunrise/sunset times for each place using free APIs (OpenWeatherMap, sunrise-sunset.org) |
| Predicted/seasonal weather | Seasonal averages for each place based on travel dates — temperature ranges, daylight hours, typical conditions. Based on historical averages, not live forecast |
| Currency per place | Primary currency and common alternatives for each place. Static reference data per country |
| Tipping protocols per place | Tipping norms and expectations for each place. Static reference data per country |
| Cruise itinerary import | Already in original spec — import from URL or PDF. Also track total cruise days by cruise type (ocean, river, expedition, etc.) and cruise line |
| Distances travelled | Day-to-day distances and cumulative distances by transport type (flights, trains, buses, ships, etc.). Derived from the route/places model |
| Country and city tracker | Running count of countries visited and cities visited across all trips |

### 4.5 Phase 7 — Tasks, Export, and Utilities

The following features are added to Phase 7 alongside the existing tasks and export scope:

| Feature | Description |
|---|---|
| Packing list | A trip-linked packing list with categories, item status (packed/not packed), and the ability to create reusable packing list templates |
| Tip budget calculator | A simple calculator widget for estimating tipping costs based on meal/service amounts and the tipping norms for the destination |
| Terms and Conditions page | A static T&Cs page linked in the app footer. Content to be provided by the product owner |
| Footer with T&Cs link | App footer visible across the workspace with T&Cs link and version number |

### 4.6 Phase 8 — AI Suggestions and Affiliate Integration (new phase)

This is a significant new phase added to the roadmap. It requires its own detailed brief before implementation begins.

| Feature | Description |
|---|---|
| Sightseeing preferences | User-level config for sightseeing preferences (e.g. museums, food, adventure, history, nature, nightlife) used to personalise AI suggestions |
| AI suggestions per day | AI-generated activity suggestions for each day based on the day's location and the user's sightseeing preferences |
| Affiliate links to activity platforms | Suggestions include affiliate links to TripAdvisor, Viator, GetYourGuide, VoiceMap, and similar platforms. Links go to the platform search/landing page for the destination, not to specific pre-selected activities |
| Affiliate links to booking platforms | Links to Expedia, Booking.com, Airbnb, and similar platforms for flights, accommodation, and rental cars relevant to the trip |

**Important constraints for Phase 8:**
- Links must be to platforms, not to specific curated activities — the app helps users discover options, not prescribe them
- Affiliate link management must be configurable so links can be updated without a code deployment
- AI suggestions must be clearly labelled as AI-generated
- Users must be able to dismiss or hide suggestions per day
- This phase requires affiliate programme applications and approval before launch — start the application process well before Phase 8 build begins

### 4.7 Phase 9 — Web Installer and Commercial Launch

See Section 3 above for full detail.

---

## 5. Revised Phase Summary

| Phase | Name | Status |
|---|---|---|
| Phase 1 | Core Structure | ✅ Complete |
| Phase 2 | Itinerary Core | ✅ Complete |
| Phase 3 | Financial Logic and Real Data | ✅ Complete |
| Cleanup Sprint | Config, Edit, Delete, Countdown | 🔜 Next |
| Phase 4 | Journal and Photos | Planned |
| Phase 5 | Documents, Links, Search | Planned |
| Phase 6 | Maps, Places, Travel Intelligence | Planned |
| Phase 7 | Tasks, Export, Packing, Utilities | Planned |
| Phase 8 | AI Suggestions and Affiliate Integration | Planned |
| Phase 9 | Web Installer and Commercial Launch | Planned |

---

## 6. Key Technical Constraints (carry forward to all phases)

These constraints apply to every phase and must be followed by Cursor without exception:

- All colours from `src/styles/global.css` tokens — zero hardcoded hex values (exception: neutral greys with no token equivalent may use hex)
- Category colours via `th-cat-{slug}` CSS class selectors — NOT inline style props
- No external icon libraries — inline SVG only
- No modal dialogs — inline expand or slide-in panels only
- No classic SharePoint form UX — single-page app feel throughout
- `npm run build` must pass clean after every task
- Always `git add` and `git commit` and `git push` after each task
- Git remote must always be `https://thestylecollectivenz@github.com/thestylecollectivenz/travelhub.git`
- All SharePoint writes use `odata.metadata=minimal` headers
- Times are stored as `HH:MM` internally, serialised to `1970-01-01T{HH}:{MM}:00.000Z` in SharePoint
- FX conversion must degrade gracefully — app must function if FX rates are unavailable
- No assumptions about NZD as home currency after the config panel is built — all financial display must use the configured home currency

---

## 7. Deferred / Out of Scope

The following were considered and explicitly deferred or excluded:

| Item | Decision |
|---|---|
| Rebuilding away from SharePoint | Deferred — SharePoint remains the data layer for v1.0 and the foreseeable future |
| Public/anonymous access to shared trip view | Out of scope for v1.0 — requires Microsoft account |
| Complex threaded comments | Out of scope — simple flat comments only |
| Full budget-vs-actual variance analytics | Out of scope — the working amount model is sufficient |
| Custom domain for SharePoint site | Customer decision — out of app scope |
| Mobile app (iOS/Android) | Out of scope — mobile web experience only |
| Offline mode | Out of scope — requires connectivity |
