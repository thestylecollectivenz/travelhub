# SharePoint Travel Planner & Journal

A SharePoint-hosted travel planning and travel journal application with a modern app-
like UI.

## Goal

Build a single-page travel workspace inside SharePoint that supports:

- private trip planning and management
- a restricted shared trip-following view
- itinerary planning by day
- budgeting and payment tracking
- multi-currency support with live FX conversion to NZD
- SharePoint-hosted documents, links, photos, and journal content
- Excel export for line-by-line trip/financial detail
- polished PDF export for journal book output

## Core Product Modes

### 1. Private Trip Workspace
Full trip management interface including:

- trip header and hero image
- editable trip days
- itinerary cards with inline editing
- budget summary cards
- day-level budget breakdown
- whole-trip category totals
- bookings and payment status
- documents and links
- journal entries and photos
- maps
- reminders/tasks
- exports

### 2. Restricted Shared Trip View
Simplified shared view showing:

- day title/date
- simplified itinerary summary
- journal entries
- journal photos

This view must exclude:

- all financial information
- private planning/admin detail
- detailed booking/admin metadata

## Required UX Principles

- single-page workspace experience
- no classic SharePoint list-form feel
- inline/in-place editing
- desktop and tablet must have full UI/experience
- mobile can be reduced but must work well for:
  - journaling
  - photo uploads
  - photo viewing
  - checking accommodation / transport / excursion details

## Main Functional Areas

- Multi-trip browsing layer
- Individual trip workspace
- Trip days and itinerary entries
- Financial rollups
- Journal and photo album
- Documents and links
- Search and filters
- Route map and places map
- Reminder/task view
- Excel export
- PDF journal book export

## Key Business Rules

- Trip summary cards show:
  - Total Budget
  - Spent So Far
  - Remaining
  - Average Per Day

- All summary values display in NZD
- Underlying itinerary items may use multiple currencies
- FX conversion must use live daily rates
- Paid items contribute to Spent So Far
- Unpaid items contribute to Remaining
- The system uses a working amount model, not strict budget-vs-actual variance 
tracking
- Multi-day costs must be allocated evenly across covered days/nights for day-level 
rollups
- Trip-level totals count each item once in full

## Day Model

Each trip day must support:

- fixed system day/date identity
- editable display title
- day type:
  - place/port day
  - sea day
  - travel/transit day
- itinerary entries
- journal entries
- primary overnight place
- additional visited places

## Itinerary Entry Model

Each itinerary entry must support:

- category
- decision status
- booking requirement
- booking status
- payment status
- notes
- time/duration
- total amount
- currency
- optional secondary unit amount
- related sub-items
- linked documents and links

## Journal and Photos

- journal entries belong to a single day
- a day can have multiple journal entries
- journal entries support likes, simple comments, and copy-shareable-link
- photos can be uploaded:
  - through journal entries
  - directly to the trip album
- multiple photos per journal entry
- optional caption per photo
- trip photo album must support day and location filtering

## Exports

- Excel export for selected day, line by line
- PDF journal book export for:
  - full trip
  - single day
  - selected date range

PDF options must support inclusion/exclusion of:

- cover page
- trip summary
- comments
- likes
- journal content globally
- individual journal entries

## Technical Direction

Preferred stack:

- SPFx
- React
- TypeScript
- SharePoint-backed storage
- SharePoint document/photo storage
- modern app-style UI inside SharePoint

## Source of Truth

The functional specification in this repository is the source of truth for product 
behaviour and implementation decisions.

If implementation questions arise:

1. follow the functional spec
2. preserve the required UX and business rules
3. do not replace requirements with simpler alternatives without explicitly flagging it

## Expected Workflow

1. Read the functional spec fully before proposing changes
2. Propose architecture before major implementation
3. Implement in phases
4. Keep changes scoped and reviewable
5. Preserve separation from other projects, especially LIME

## Project Scope Boundary

This repository is only for the SharePoint Travel Planner & Journal project.

Do not mix assumptions, architecture, naming, workflows, components, or business 
rules from LIME or any other project into this repository.
