# Scripts

## `provision-lists.ps1`

Creates the SharePoint custom lists and columns used by the Travel Hub app on the **travelhub** site. It is **idempotent**: lists and columns that already exist are left unchanged.

### What it does

- Connects to `https://thestylecollectiveconz.sharepoint.com/sites/travelhub` using **PnP PowerShell** and **interactive** Microsoft 365 sign-in.
- For each required list (Trips, TripDays, Places, DayPlaces, ItineraryEntries, EntryDocuments, EntryLinks, JournalEntries, JournalPhotos, JournalLikes, JournalComments, TripFollowers, AlbumPhotos):
  - Creates the list as a **generic custom list** if it does not exist.
  - Adds each specified column (internal name and type match the functional model) if that column is not already on the list.
- Prints `[List]` and `[Column]` lines so you can see what was skipped vs created.

Built-in **Title** column is not added (SharePoint provides it on every list).

### Prerequisites

- [PowerShell 7+](https://github.com/PowerShell/PowerShell/releases) recommended (Windows PowerShell 5.1 also works if the module loads).
- [PnP.PowerShell](https://pnp.github.io/powershell/articles/installation.html) installed for your user:

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser
```

- Permission to create lists and manage columns on the target site (e.g. Site Owner or equivalent).

### How to run

From a PowerShell session:

```powershell
cd "path\to\Travel Hub for SharePoint\scripts"
.\provision-lists.ps1
```

Or with a full path:

```powershell
& "C:\Users\...\Travel Hub for SharePoint\scripts\provision-lists.ps1"
```

Complete the browser-based sign-in when prompted. When the script ends with `Provisioning finished successfully.`, lists are ready for SPFx or other clients to target by list title and internal column names.

### Notes

- Re-run safely after partial failures; it only creates missing pieces.
- If a column fails to add (for example a name conflict with a site column), fix the site or rename in the script after checking SharePoint field behaviour, then run again.
