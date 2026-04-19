# Travel Hub for SharePoint  
## Functional Specification

**Version:** 1.0  
**Last updated:** 19/4/2026  
**Platform:** SharePoint-hosted application  
**Preferred implementation approach:** SPFx + React + TypeScript, single-page app experience within SharePoint  
**Core principle:** UI and content live in SharePoint, with an app-like single-page experience rather than classic SharePoint list forms

---

# 1. Product Overview

The system is a SharePoint-based travel planning and travel journal application with two primary modes:

## 1.1 Private Trip Workspace
- Full planning and management interface for a trip
- Includes itinerary planning, financial tracking, budgeting, attachments, journals, maps, reminders, and exports

## 1.2 Restricted Shared Trip View
- A simplified, restricted-access view for people following the trip
- Includes itinerary summary, journal content, and photos
- Excludes financial and private planning/admin information

The application must support:
- Multiple trips
- A trip-level single-page workspace
- A broader multi-trip layer above individual trips
- Rich document and photo handling within SharePoint
- Responsive full experience on desktop and tablet
- Reduced but practical mobile experience for travel-time usage

---

# 2. Product Goals

The system must allow a user to:
- Plan a trip day by day
- Capture itinerary entries with financial and booking detail
- Track what is paid vs unpaid
- Roll up costs by day, category, and trip
- Handle multiple currencies and convert them to NZD using live daily FX rates
- Capture and display travel journal entries with photos
- Share a simplified trip-following experience with selected others
- Store and search supporting documents and links in SharePoint
- Export operational trip data to Excel
- Export journal content to a polished PDF "book"
- Use the system as both a planning tool before travel and an active journaling/reference tool during travel

---

# 3. User Roles and Permissions

## 3.1 Authorised Editors

Authorised editors can:
- Create and edit trips
- Edit all itinerary content
- Edit all financial data
- Edit day titles and trip structure
- Add and edit journal entries
- Upload and manage photos
- Manage documents and links
- Use exports
- Access reminder/task views
- Access all private trip content

## 3.2 Shared-View Followers

Shared-view followers can:
- Access the restricted shared trip view
- View the simplified itinerary
- View journal entries and photos
- Like journal entries
- Comment on journal entries
- Use the "copy shareable link" action

Shared-view followers cannot:
- Edit itinerary content
- Edit journal entries
- View financial information
- View private planning/admin information
- View operational attachments such as confirmations/tickets unless intentionally surfaced through journal/story content

## 3.3 General Permission Rule

The system must support role-based access so that:
- Private trip planning and financial content is restricted to authorised editors
- Shared-view followers only see the restricted itinerary/journal version with permitted lightweight interactions

---

# 4. High-Level Information Architecture

The system has two levels:

## 4.1 Multi-Trip Layer

A higher-level view above individual trips that allows users to:
- Browse multiple trips
- Filter/sort trips
- Access a broader multi-trip map showing place pins only

## 4.2 Individual Trip Layer

A single trip workspace containing:
- Header/hero
- Trip metadata
- Budget summary cards
- Route strip
- Sidebar itinerary/day navigation
- Sidebar whole-trip budget-by-category summary
- Day-level breakdown tile
- Itinerary detail cards
- Journal feed
- Documents view
- Links view
- Reminder/task view
- Photo album
- Trip-specific maps

---

# 5. Trip Entity and Core Trip Fields

Each trip must support the following core data:
- Trip title
- Date range
- Hero/cover image
- Lifecycle status
- Compact metadata line content
- Trip days generated from the date range
- Optional imported itinerary content
- Manually added content
- Shared-view access configuration

## 5.1 Trip Lifecycle Status

Each trip must support lifecycle status values such as:
- Planning
- Upcoming
- In Progress
- Completed
- Archived

This status can be used for filtering, sorting, and broader views.

## 5.2 Compact Metadata Line

The compact metadata line in the trip header must include at minimum:
- Trip date range
- Trip duration, e.g. "10 days"

It may also accommodate other lightweight trip metadata later.

---

# 6. Trip Creation and Setup

Users must be able to create a new trip by entering:
- Trip title
- Date range
- Hero image
- Lifecycle status

The system must then generate the day structure for the trip.

The system must support:
- Fully manual trip creation
- Import-assisted trip creation
- Trips containing both imported and manually added content in the same trip

---

# 7. Cruise Itinerary Import

The system must support optional import of a cruise itinerary from:
- URL
- PDF

## 7.1 Imported Cruise Data

Where available, cruise import must extract:
- Cruise name
- Sailing dates
- Ordered ports/places
- Dates per port/day
- Sea days
- Arrival/departure times

## 7.2 Import Result

Imported cruise itinerary data must:
- Prepopulate the trip
- Prepopulate the day structure
- Prepopulate ordered places/route structure
- Populate route/map-relevant information
- Create day entries for ports and sea days

After import, the user must still be able to manually refine:
- Itinerary items
- Journal content
- Financial details
- Attachments
- Links

---

# 8. Trip Day Model

Each trip is composed of ordered trip days.

Each day must have:
- Fixed system day identity, e.g. Day 4
- Fixed calendar date
- User-editable display title
- Day type
- Day-linked itinerary entries
- Day-linked journal entries

## 8.1 User-Editable Day Title

Each trip day must have a separate user-editable display title for use in:
- Left sidebar itinerary
- Day header

Examples:
- Arrival in Tokyo
- Tokyo Exploration
- Day Trip Mt. Fuji

## 8.2 Day Types

Trip days must support distinct types including:
- Place/port day
- Sea day
- Travel/transit day

Different trip day types must be visually distinguishable in the UI.

## 8.3 Date Integrity

The system must support:
- Changing trip dates
- Moving itinerary items between days

When this happens, the system must automatically keep day/date relationships accurate.

---

# 9. Places Model

Places are important, but they are not managed as a heavy separate master workflow.

## 9.1 Primary Overnight Place

Each trip day must support one primary overnight Place:
- Derived from where the traveller spends that night
- Used for trip structure and route logic

## 9.2 Additional Visited Places

A trip day may also have additional visited Places, such as:
- Day trips
- Side trips
- Other visited locations during the day

## 9.3 Rules

Each day must support:
- One primary overnight Place
- Additional visited Places
- An independent editable day title that does not have to match either exactly

---

# 10. Header and Summary Cards

The private trip page must have a header area containing:
- Hero image
- Trip title
- Compact metadata line
- Budget summary cards

## 10.1 Budget Summary Cards

The trip header summary must show:
- Total Budget
- Spent So Far
- Remaining
- Average Per Day

Per-person summary is not required at trip-header level.

## 10.2 Financial Interpretation

- **Total Budget** = total of all item values across the trip
- **Spent So Far** = all amounts already paid, converted to NZD
- **Remaining** = all amounts not yet paid, converted to NZD
- **Average Per Day** = total trip amount divided by trip days

All cards must display in NZD.

---

# 11. Currency and FX Logic

The underlying financial model must support:
- Multiple currencies at item level
- Conversion to NZD
- Live daily FX rates

## 11.1 FX Rules

- FX conversion must use live daily rates
- Financial display cards must show NZD values regardless of original currency
- Paid and unpaid item totals must both be convertible and roll up correctly

---

# 12. Left Sidebar Structure

The private trip page left sidebar must contain:
1. Itinerary Days navigation
2. Budget by Category summary

## 12.1 Itinerary Days Navigation

The sidebar must list each day in order and include:
- Day title
- Day total/spend amount in private view
- Highlight of selected day
- Scroll support for longer trips

Clicking a day:
- Determines which day's itinerary cards are shown in the main panel
- Determines which day's journal entries are surfaced

## 12.2 Budget by Category Summary

The sidebar must contain whole-trip category totals for:
- Flights
- Accommodation
- Food & Dining
- Activities
- Transport
- Other

This is a whole-trip summary, not a day-only summary.

## 12.3 Shared View Sidebar

The shared trip view must include the same day-based itinerary structure but:
- Must not show financial values
- Must not show day totals
- Must remain simplified

---

# 13. Route Strip and Maps

## 13.1 Route Strip

The private trip page must include a horizontal route strip showing:
- Ordered places in the trip
- Transport between them
- Duration/travel time per leg
- Day ranges associated with places/stops

The ordered sequence of places must drive the route strip.

## 13.2 Route Map

The trip-specific route map must show:
- Places travelled to
- Journey order/path

## 13.3 Places Map

The trip-specific places map must show:
- Pins for places visited

## 13.4 Multi-Trip Map

The broader multi-trip map above individual trips must show:
- Place pins only

---

# 14. Main Selected-Day Structure

When a user selects a day in the left sidebar, the main panel must show only that day's content.

The day content structure is:
1. Day header
2. Detailed Budget Breakdown tile
3. Itinerary cards/tiles
4. Journal content

## 14.1 Day Header

The day section must show:
- Day title
- Date
- Day total
- Add action

---

# 15. Detailed Budget Breakdown Tile

Each selected day must display a Detailed Budget Breakdown tile above the itinerary detail cards.

## 15.1 Purpose

The tile summarises the selected day by category and is driven by item-level financial data.

## 15.2 Content

For each selected day and each category, it must show:
- Category name
- Item count
- Total amount
- Payment progress/status

## 15.3 Roll-Up Source

Every financially relevant itinerary item must feed into category rollups.

## 15.4 Day vs Trip Category Summaries

The system must support:
- Whole-trip category totals in the sidebar
- Selected-day category totals in the main day view

---

# 16. Itinerary Entries and Cards

Each day must contain itinerary entries displayed as chronological cards/tiles.

## 16.1 Visibility Rule

Only entries for the selected day appear in the main panel.

## 16.2 Default Order

Within a selected day, entries are ordered by date/time created.

## 16.3 Timeline UI

The selected day view must use a visual timeline treatment to show the sequence of itinerary cards within the day.

## 16.4 Card Content

Each itinerary card must support:
- Time
- Duration
- Category
- Decision/planning status
- Booking requirement
- Booking status
- Payment status
- Title
- Supplier/provider
- Route or location detail
- Notes
- Tags/metadata
- Primary total amount
- Optional secondary unit amount
- Linked attachments/documents
- Related sub-items beneath the card

## 16.5 Card Actions

Each itinerary card must support:
- Edit
- Duplicate
- Delete

Editing must be inline.

---

# 17. Inline Editing Behaviour

Normal trip management must happen within a single-page workspace.

## 17.1 No Separate Forms

Editing must not require jumping out to separate classic SharePoint forms or separate management pages.

## 17.2 Inline Card Editing

Clicking an itinerary card must:
- Expand/focus it inline
- Make it editable in place
- Surface the journal entries for that day

## 17.3 Edit Scope

Inline editing of a card must allow editing of:
- Core content
- Time/scheduling
- Category
- Status fields
- Financial fields
- Location fields
- Linked content fields

---

# 18. Entry Creation

Users must be able to add new entries directly within a trip day.

A new entry may begin as:
- General entry
- Category-specific entry

Categorisation must remain flexible so entries can be structured later if needed.

---

# 19. Entry Movement and Reordering

Users must be able to:
- Move itinerary entries within a day
- Move itinerary entries between days

Movement must support:
- Drag and drop
- Explicit move action

---

# 20. Related Sub-Items and Groupings

## 20.1 Related Sub-Items

The system must support grouped related sub-items beneath a main itinerary item, such as:
- Nearby activities
- After-dinner activities
- Follow-on activities

These related items:
- Appear under the parent
- Support their own status and cost details
- Are expandable/collapsible

## 20.2 Named Groupings

The day view must support contextual grouping labels with item counts, e.g.:
- Activities nearby (2)
- Activities after dinner (1)

---

# 21. Itinerary Item Status Model

Each itinerary item must support separate status dimensions.

## 21.1 Decision Status

This must distinguish between:
- Idea
- Planned/intended
- Confirmed

## 21.2 Booking Requirement

Must support:
- Booking required
- No advance booking required

Items requiring booking but not yet booked must be highlighted.

## 21.3 Booking Status

Must support:
- Not booked
- Booked

Future expansion such as cancelled/waitlisted can be added later.

## 21.4 Payment Status

Must support:
- Not paid
- Part paid / deposit paid
- Fully paid

---

# 22. Financial Model

## 22.1 Core Model

The system does not use a strict budget-vs-actual variance model.

Instead, each itinerary item has:
- One working amount
- One currency
- Payment status

The working amount:
- May begin as an estimate
- May later be updated to the final booked value

## 22.2 Roll-Up Logic

Trip, day, and category totals must treat:
- Paid items as contributing to Spent So Far
- Unpaid items as contributing to Remaining

## 22.3 Secondary Unit-Based Amounts

Each itinerary item must store:
- A primary total amount for roll-up
- Optional secondary unit type + unit amount where relevant

Examples:
- Per person for flights and activities
- Per night for accommodation
- Per day for other applicable items

## 22.4 Trip-Level Summary Focus

Trip-level summaries must focus on:
- Total
- Spent So Far
- Remaining
- Average Per Day

They must not depend on a top-level per-person summary.

---

# 23. Multi-Day Cost Allocation

The system must support allocation of multi-day costs across relevant days.

## 23.1 Allocation Rule

Multi-day costs must be allocated evenly across the days or nights they cover.

Examples:
- Hotel cost divided across nights
- Cruise cost divided across days/nights
- Multi-day transport divided across covered days

## 23.2 Roll-Up Rule

- Trip-level totals count the full value of each item once
- Day-level totals use the allocated per-day/per-night portion

---

# 24. Documents and Links

The system must support item-linked supporting content stored in SharePoint.

## 24.1 Supported Supporting Content

Examples include:
- Tickets
- Booking confirmations
- Confirmation emails
- Images
- PDFs
- URLs
- Supplier links

## 24.2 Storage and Access

Supporting content must:
- Be accessible from the relevant itinerary item
- Be available in broader trip-level Documents and Links views
- Be searchable

## 24.3 Content Source

The system must support adding supporting content via:
- Manual upload
- Manual linking
- References to emails and booking URLs

## 24.4 Documents View

Each trip must provide a separate Documents view/tab.

The Documents view must be:
- Searchable
- List/grid based
- Filterable by:
  - Day
  - Category
  - Linked itinerary item
  - Document type

## 24.5 Links View

Each trip must provide a separate Links view/tab.

The Links view must be:
- Searchable
- List/grid based
- Filterable by:
  - Day
  - Category
  - Linked itinerary item
  - Link type/source

---

# 25. Search and Filtering

The system must support trip-level search and filtering across:
- Itinerary items
- Journal entries
- Documents
- Links

Search results must support mixed results with filters to narrow by content type.

---

# 26. Journal System

## 26.1 Journal Feed

The system must support a day-based Travel Journal feed containing entries with:
- Author
- Timestamp
- Location
- Journal text
- Image attachments

Users must be able to add journal entries within the trip view.

## 26.2 Day Relationship

Each journal entry belongs to a single trip day.

A day may have multiple journal entries.

Selecting an itinerary item should surface the journal entries for that item's day.

## 26.3 Journal Interactions

Journal entries must support:
- Likes
- Simple comments
- Share action

## 26.4 Share Action

The share action must be:
- Copy shareable link only

## 26.5 Shared View

The journal must also be available in the restricted shared trip view.

---

# 27. Shared Trip View

The restricted-access shared trip view is a simplified trip-following/story view.

## 27.1 Shared View Includes

For the selected day, the shared view must show:
- Day title/date
- Simplified itinerary summary
- Top-level category information where relevant
- Journal entries
- Journal photos

## 27.2 Shared View Excludes

The shared view must exclude:
- Financial values
- Budgeting detail
- Payment detail
- Detailed booking/admin detail
- Detailed supplier/provider/admin metadata
- Private planning content

## 27.3 Shared View Permissions

The shared view must be read-only for itinerary content.

All shared-view followers may:
- Like
- Comment
- Use copy-shareable-link

Only authorised users may create/edit journal entries.

---

# 28. Photo System and Album

## 28.1 Upload Sources

The system must support photo uploads:
- Through journal entries
- Directly to the trip photo album

## 28.2 Journal Entry Photo Rules

A single journal entry may contain multiple photos.

Each photo may have its own optional caption.

## 28.3 Album Upload Rules

Photos uploaded directly to the trip album may also have optional captions.

Captions are always optional.

## 28.4 Album View

Photos must be viewable:
- Within the relevant journal entries
- In an aggregated photo album view for the trip

## 28.5 Album Organisation

The trip photo album must support organisation or filtering by:
- Day
- Location

---

# 29. Reminder and Task System

The system must support reminders or notifications for key trip tasks.

## 29.1 Key Reminder Use Case

Especially important:
- Items that require booking but have not yet been booked

## 29.2 Reminder Surfaces

Outstanding items must appear:
- Highlighted within the trip UI
- In a dedicated reminder/task-style view
- In broader notifications later

## 29.3 Reminder/Task View

Each trip must provide a reminder/task view that aggregates outstanding actions such as:
- Booking-required items not yet booked
- Unpaid items
- Part-paid items
- Other important trip actions later

---

# 30. Export Requirements

## 30.1 Excel Export

The system must support exporting the selected day's underlying line-by-line itinerary and financial detail to Excel.

This must not be limited to category rollup only.

## 30.2 Journal PDF Book Export

The system must support exporting journal content to a polished, book-style PDF suitable for:
- Sharing
- Saving
- Printing

## 30.3 PDF Export Scopes

The PDF export must support:
- Full trip
- Single day
- Selected date range

## 30.4 PDF Book Options

The PDF export must support:
- Cover page on/off
- Trip summary on/off
- Day-based sections/chapters
- Photo-heavy vs text-heavy emphasis
- Include/exclude comments
- Include/exclude likes
- Include/exclude journal content as a whole
- Include/exclude individual journal entries

---

# 31. Mobile, Tablet, and Desktop Behaviour

## 31.1 Desktop

Must support the full experience and full UI.

## 31.2 Tablet

Must also support the full experience and full UI.

## 31.3 Mobile

Mobile may use a reduced layout, but must work well for:
- Journaling
- Photo uploading
- Photo album viewing
- Checking accommodation details
- Checking transport details
- Checking excursion/activity booking details

Mobile is a reduced but still useful travel-time interface, not an afterthought.

---

# 32. Visual and UX Behaviour Summary

The UX should behave like an app-style single-page workspace.

## 32.1 Required UX Characteristics

- Inline editing
- Single-page management
- No classic SharePoint form feel
- Expand-in-place itinerary cards
- Visually clear selected day state
- Timeline treatment for day entries
- Distinct private vs shared presentation
- Manual control of day titles/sidebar narrative
- Drag/drop support where specified

---

# 33. Required Data Relationships Summary

The implementation must support at least the following conceptual relationships:

## 33.1 Trip

Contains:
- Days
- Budget summary
- Category summary
- Documents
- Links
- Journal entries via days
- Photos via journal/album
- Reminder/task items

## 33.2 Day

Has:
- Day number/date
- Editable display title
- Day type
- Primary overnight place
- Additional visited places
- Itinerary entries
- Journal entries

## 33.3 Itinerary Entry

Has:
- Day
- Category
- Status fields
- Financial fields
- Optional unit fields
- Linked documents/links
- Optional related sub-items

## 33.4 Journal Entry

Has:
- Day
- Text
- Photos
- Comments
- Likes
- Shareable link

---

# 34. Out-of-Scope / Not Required in First Version

The following are not required as primary first-version capabilities unless later added:
- Complex threaded comments
- Public/anonymous access
- Full workflow-heavy place master management
- Full budget-vs-actual variance analytics
- Complex social sharing beyond copy-link
- Separate form-based admin management pages as the default editing experience

---

# 35. Recommended Implementation Shape for Cursor

This is not a UI design note only; it is the intended delivery shape:
- SharePoint-hosted SPFx React application
- Single-page trip workspace
- SharePoint-backed storage for trip content and files
- Documents/photos/attachments living in SharePoint
- Inline editing patterns
- Separate private and shared rendering modes
- Full desktop/tablet UI, reduced mobile mode
- Export services for Excel and PDF

---

# 36. Cursor Build Priorities

Cursor should implement in this order:

## Phase 1: Core Structure
- Trip creation
- Day generation
- Private trip page shell
- Shared trip page shell
- Header, hero, metadata line
- Sidebar itinerary
- Day selection model

## Phase 2: Itinerary Core
- Day header
- Detailed Budget Breakdown tile
- Itinerary cards
- Inline editing
- Status model
- Drag/drop and move actions
- Related sub-items/groupings

## Phase 3: Financial Logic
- Multi-currency support
- Live FX conversion to NZD
- Paid vs remaining model
- Whole-trip and selected-day rollups
- Multi-day cost allocation

## Phase 4: Journal and Photos
- Journal feed
- Likes/comments/share
- Photo uploads from journal and album
- Trip photo album
- Shared-view journal presentation

## Phase 5: Documents, Links, Search
- Item-linked attachments
- Documents view
- Links view
- Mixed trip-level search

## Phase 6: Maps and Places
- Route strip
- Route map
- Places map
- Multi-trip map

## Phase 7: Tasks and Export
- Reminder/task view
- Excel export
- PDF book export with options

---

# 37. Final Product Definition

This product is a SharePoint-based travel planning and travel journaling workspace that combines:
- Structured trip planning
- Booking/task tracking
- Financial rollups
- Document organisation
- Journal storytelling
- Photo management
- Controlled sharing

It must support both:
- Pre-trip planning and budgeting
- In-trip usage for journaling, uploads, and quick reference

And it must do this in a way that feels like a modern app inside SharePoint, not like a collection of classic SharePoint forms.
