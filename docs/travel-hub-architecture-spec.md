# Travel Hub — Architecture and Deployment Strategy

**Version:** 1.1  
**Last updated:** May 2026  
**Status:** Approved — supersedes deployment assumptions in previous spec documents  
**Read alongside:** Functional Specification v1.0, Extended Scope v1.0, Extended Scope 2 v1.0

---

## 1. Purpose of This Document

This document records a significant and deliberate change to the Travel Hub deployment and distribution architecture, agreed after evaluating the commercial reality of the Microsoft 365 licensing landscape.

It does not change any functional requirements. All behaviour described in the Functional Specification and Extended Scope documents remains the source of truth. This document changes **how the app is delivered and hosted**, not **what it does**.

Every developer and AI coding assistant working on this project must read this document before making any architectural decisions about authentication, API calls, hosting, or deployment.

---

## 2. The Problem With SPFx-Only Distribution

The original architecture specified an SPFx web part deployed to a SharePoint App Catalog. This works correctly for the owner's own tenant. However, commercial distribution to end customers revealed a fundamental licensing barrier.

Deploying an `.sppkg` file to a SharePoint App Catalog requires **SharePoint Administrator or Global Administrator** access in the target Microsoft 365 tenant. This role is only available on **Microsoft 365 Business plans** (Basic, Standard, Premium) and Enterprise plans.

The following common user types **cannot** self-install an SPFx app:

- Microsoft 365 Personal subscribers (consumer plan, no Admin Center)
- Microsoft 365 Family subscribers (consumer plan, no Admin Center)
- Users who have Microsoft 365 **through their employer** (they have a licence but not admin rights — their IT department holds admin access)

This eliminates the majority of the realistic consumer audience for a personal travel planning application.

---

## 3. The Chosen Architecture — Dual Deployment, Shared Codebase

Travel Hub will support **two deployment targets from one shared codebase**:

### Target 1 — SPFx Web Part (retained, fully maintained)

The existing SPFx implementation continues to be built and maintained. It is valid for:

- The product owner's own personal use with their existing SharePoint data
- Technically sophisticated users who own and admin their own Microsoft 365 Business tenant
- Future enterprise/business deployments where IT departments manage installation

### Target 2 — Web Application (new, added for commercial distribution)

A standard React web application hosted at a domain controlled by the product owner (e.g. `travelhub.app`). It authenticates via Microsoft Identity Platform (MSAL), accesses SharePoint data via Microsoft Graph API, and requires **no admin access from the customer**.

This removes the licensing barrier entirely. Any user with **any Microsoft account** — Personal, Family, work, or school — can sign in, grant the app permission once, and use Travel Hub immediately.

---

## 4. Shared Codebase Architecture

```
┌─────────────────────────────────────────────────────┐
│                  SHARED CORE                        │
│                                                     │
│  src/components/     — all React UI components      │
│  src/hooks/          — all custom React hooks       │
│  src/models/         — all TypeScript interfaces    │
│  src/services/       — ITravelHubDataService + impl │
│  src/utils/          — financial logic, FX, dates   │
│  src/styles/         — all CSS tokens and styles    │
│                                                     │
│  Everything in the functional spec lives here.      │
│  Neither wrapper knows about the other.             │
└────────────────────┬────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
┌─────────▼──────────┐ ┌───────▼─────────────────────┐
│   SPFx WRAPPER     │ │   WEB APP WRAPPER             │
│                    │ │                               │
│  src/webparts/     │ │  src/app/                     │
│  SPFx bootstrap    │ │  MSAL auth provider           │
│  SP REST API impl  │ │  Graph API impl               │
│  .sppkg output     │ │  Azure Static Web Apps host   │
│                    │ │  travelhub.app domain         │
└────────────────────┘ └───────────────────────────────┘
```

### The Data Service Interface

The single most important architectural rule is that **all SharePoint data access must go through the `ITravelHubDataService` interface**. No component, hook, or utility may call a SharePoint or Graph API endpoint directly.

```typescript
// src/services/ITravelHubDataService.ts
// This interface is the contract between the shared core and both wrappers.
// Add every data operation here. Never call APIs directly from components.

interface ITravelHubDataService {
  // Trips
  getTrips(): Promise<Trip[]>;
  getTripById(id: string): Promise<Trip>;
  createTrip(trip: CreateTripRequest): Promise<Trip>;
  updateTrip(id: string, updates: Partial<Trip>): Promise<Trip>;
  deleteTrip(id: string): Promise<void>;

  // Days
  getDaysForTrip(tripId: string): Promise<TripDay[]>;
  updateDay(id: string, updates: Partial<TripDay>): Promise<TripDay>;

  // Itinerary entries
  getEntriesForDay(dayId: string): Promise<ItineraryEntry[]>;
  createEntry(entry: CreateEntryRequest): Promise<ItineraryEntry>;
  updateEntry(id: string, updates: Partial<ItineraryEntry>): Promise<ItineraryEntry>;
  deleteEntry(id: string): Promise<void>;
  moveEntry(id: string, targetDayId: string): Promise<ItineraryEntry>;

  // Journal
  getJournalEntriesForDay(dayId: string): Promise<JournalEntry[]>;
  createJournalEntry(entry: CreateJournalEntryRequest): Promise<JournalEntry>;
  updateJournalEntry(id: string, updates: Partial<JournalEntry>): Promise<JournalEntry>;
  deleteJournalEntry(id: string): Promise<void>;

  // Photos
  uploadPhoto(file: File, context: PhotoUploadContext): Promise<Photo>;
  getPhotosForTrip(tripId: string): Promise<Photo[]>;

  // Documents and links
  getDocumentsForTrip(tripId: string): Promise<TripDocument[]>;
  getLinksForTrip(tripId: string): Promise<TripLink[]>;
  createLink(link: CreateLinkRequest): Promise<TripLink>;

  // Provisioning (web app wrapper only — no-op in SPFx wrapper)
  ensureListsExist(siteUrl: string): Promise<ProvisioningResult>;
}
```

The SPFx wrapper provides `SharePointRestDataService` implementing this interface using the SP REST API and `spHttpClient`.

The web app wrapper provides `GraphApiDataService` implementing the same interface using Microsoft Graph API calls with an MSAL-obtained access token.

React components call `useDataService()` — a hook that returns whichever implementation is active. Components never know which wrapper they are running inside.

---

## 5. Data Safety — Non-Negotiable Rules

Data safety is the highest priority constraint in this architecture. Both wrappers must follow these rules without exception.

### Rule 1 — Never delete or restructure existing lists

No code path in either wrapper may delete a SharePoint list or remove/rename a column in an existing list. Provisioning code only **creates** — it never modifies or removes.

### Rule 2 — First-run provisioning must check before creating

When the web app wrapper runs for a new user, it must:

1. Check whether the Travel Hub lists already exist in the user's SharePoint site
2. If lists exist — connect to them, do not touch them, do not recreate them
3. If lists do not exist — create them with the correct schema
4. If lists partially exist — create only the missing ones, leave existing ones untouched

This ensures existing data (including the product owner's own trip data) is never at risk during any update or reinstallation.

### Rule 3 — Column additions are append-only

If a new feature requires a new SharePoint list column, the provisioning code adds it if missing. It never removes or renames existing columns even if they are no longer used.

### Rule 4 — All list and column names are stable

SharePoint list names and column internal names are part of the provisioning contract. Once shipped, they must not change. If a rename is ever needed, a new column is added alongside the old one and data is migrated — the old column is never deleted.

### Rule 5 — Writes are always explicit and user-initiated

No background sync, no automatic data migration, no silent writes to SharePoint. Every write to SharePoint is a direct result of a user action. The app never modifies data the user has not touched.

---

## 6. Authentication Model

### SPFx Wrapper

Authentication is handled automatically by the SPFx context. No changes needed. The existing implementation continues unchanged.

### Web App Wrapper

Authentication uses **Microsoft Authentication Library (MSAL) for React** (`@azure/msal-react`).

Required OAuth scopes:
- `User.Read` — display name and profile photo
- `Sites.ReadWrite.All` — read and write SharePoint lists in the user's tenant
- `Files.ReadWrite.All` — upload and manage photos and documents in SharePoint

The app is registered once in Microsoft Entra ID (Azure AD) by the product owner. All customers use this single app registration. The `client_id` is a public configuration value — it is not a secret.

The OAuth flow is standard delegated (user) permissions — the app acts on behalf of the signed-in user, using only the permissions the user themselves has. The app never requests application-level permissions.

### Follower Access (Shared Trip View)

Followers of a shared trip are invited as SharePoint guests by the trip owner. They authenticate with their own Microsoft account (personal, work, or school). They access the shared trip view at `travelhub.app/shared/[tripId]`. No admin access is required from followers.

---

## 7. Hosting

### SPFx Wrapper

Deployed as `.sppkg` to the SharePoint App Catalog. Hosted within SharePoint. No change from current approach.

### Web App Wrapper

Hosted on **Azure Static Web Apps** (free tier is sufficient for static assets and the application scale).

- Build output: standard React static files (HTML, JS, CSS)
- Deployment: from GitHub via Azure Static Web Apps CI/CD
- Domain: custom domain (e.g. `travelhub.app`) configured in Azure Static Web Apps
- No server-side code required — the app is entirely client-side

The app accesses SharePoint data via Microsoft Graph API from the user's browser. No data passes through the product owner's hosting infrastructure — data flows directly between the user's browser and their own Microsoft 365 tenant.

---

## 8. Build and Project Structure

The repository maintains a single codebase with the following top-level structure:

```
/
├── src/
│   ├── components/         ← shared UI components (both wrappers)
│   ├── hooks/              ← shared custom hooks (both wrappers)
│   ├── models/             ← shared TypeScript interfaces (both wrappers)
│   ├── services/           ← ITravelHubDataService interface + both implementations
│   │   ├── ITravelHubDataService.ts
│   │   ├── SharePointRestDataService.ts   ← SPFx wrapper implementation
│   │   └── GraphApiDataService.ts         ← web app wrapper implementation
│   ├── utils/              ← shared utilities (financial, FX, dates, etc.)
│   └── styles/             ← shared CSS tokens and global styles
├── spfx/                   ← SPFx wrapper entry point and web part definition
├── webapp/                 ← web app wrapper entry point, MSAL config, routing
├── docs/                   ← spec documents
└── scripts/                ← build and provisioning scripts
```

---

## 9. Build Sequencing — When The Web App Wrapper Gets Built

The SPFx implementation continues to be the primary build target through all current and planned phases (Phases 4 through 7, plus the Cleanup Sprint).

The web app wrapper is added as a **dedicated task at the end of Phase 7**, before Phase 8 begins. This means:

- All functional features are complete in the SPFx version first
- The data service abstraction layer is retrofitted during Phase 7 completion
- The web app wrapper is then built against the complete, tested shared core
- Phase 8 (AI and affiliate features) is built once in the shared core and works in both wrappers from day one

### Abstraction Layer Retrofit (Phase 7 completion task)

Before the web app wrapper is built, a refactor task extracts all SharePoint REST API calls from wherever they currently live and places them behind the `ITravelHubDataService` interface. This is not a rewrite — it is a reorganisation of existing code into the correct structure.

This task must be completed and verified before any web app wrapper work begins.

---

## 10. Cursor Development Rules — Applies Immediately

The following rules apply to all Cursor development from this point forward, before the web app wrapper exists.

### Rule 1 — All data access through service files

All calls to SharePoint REST API endpoints must live in dedicated service files under `src/services/`. No component, hook, page, or utility file may contain a direct `spHttpClient` call, `fetch` call to a SharePoint URL, or any other direct data access.

If a component needs data from SharePoint, it calls a method on the data service. That is the only permitted pattern.

### Rule 2 — No SharePoint URLs in components

No SharePoint URL pattern (`/_api/`, `/_vti_bin/`, etc.) may appear in any file outside `src/services/`. If Cursor is tempted to put a SharePoint URL in a component, it must instead add a method to `ITravelHubDataService` and implement it in `SharePointRestDataService`.

### Rule 3 — No authentication logic in components

No `spHttpClient`, `msalInstance`, `accessToken`, or authentication-related call may appear in a component. Authentication is handled by the wrapper layer and injected via the data service.

### Rule 4 — TypeScript interfaces for all data shapes

Every SharePoint list item that the app reads or writes must have a corresponding TypeScript interface in `src/models/`. Components work with typed model objects, not raw SharePoint API response shapes.

### Rule 5 — Service files are the only place list names appear

SharePoint list names and column internal names must only appear in `src/services/SharePointRestDataService.ts` and `src/services/GraphApiDataService.ts`. Nowhere else. This makes the provisioning contract explicit and auditable.

### Rule 6 — npm run build must pass after every task

Unchanged from existing rules. Both wrapper build targets must pass clean.

---

## 11. What Has Not Changed

To be completely explicit — the following have not changed and must not be treated as changed:

- All functional requirements in the Functional Specification v1.0
- All scope additions in Extended Scope v1.0 and Extended Scope 2 v1.0
- All SharePoint list names, column names, and data model
- The visual design and UX behaviour
- The role model (Authorised Editors and Shared-View Followers)
- All existing technical constraints from Extended Scope v1.0 Section 6
- The phase build order (Phases 4 through 8 proceed as planned)
- The SPFx implementation — it is retained and fully maintained

---

## 12. Document Hierarchy

When any conflict exists between documents, the following precedence applies:

1. This document (Architecture and Deployment Strategy v1.1) — deployment and API layer
2. Extended Scope 2 v1.0 — most recent functional additions
3. Extended Scope v1.0 — earlier functional additions and architectural principles
4. Functional Specification v1.0 — base functional requirements

On questions of data safety, this document's rules are absolute and override all others.
