#requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Provisions Travel Hub SharePoint lists and columns (idempotent).

.DESCRIPTION
    Connects to the Travel Hub site and creates each required custom list and
    column if missing. Safe to re-run: existing lists and columns are skipped.

.PREREQUISITES
    Install PnP.PowerShell (run PowerShell as Administrator only if required):
        Install-Module PnP.PowerShell -Scope CurrentUser

.HOW TO RUN
    1. Open PowerShell 7+ (or Windows PowerShell 5.1 with PnP.PowerShell installed).
    2. From the repository root (or any path), run:
           cd "path\to\Travel Hub for SharePoint\scripts"
           .\provision-lists.ps1
       Or invoke with full path:
           & "C:\...\scripts\provision-lists.ps1"
    3. Complete the interactive Microsoft 365 sign-in when the browser opens.
    4. Review the console output for [List] and [Column] status lines.

.NOTES
    Target site: https://thestylecollectiveconz.sharepoint.com/sites/travelhub
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ClientId
)

$ErrorActionPreference = 'Stop'
$SiteUrl = 'https://thestylecollectiveconz.sharepoint.com/sites/travelhub'

function Test-ListExists {
    param([string] $Title)
    $list = Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
    return ($null -ne $list)
}

function Ensure-CustomList {
    param([string] $Title)
    if (Test-ListExists -Title $Title) {
        Write-Host "[List] '$Title' already exists — skipping create."
        return
    }
    Write-Host "[List] Creating list '$Title'..."
    New-PnPList -Title $Title -Template GenericList | Out-Null
    Write-Host "[List] Created list '$Title'."
}

function Test-ListFieldExists {
    param(
        [string] $ListTitle,
        [string] $InternalName
    )
    $field = Get-PnPField -List $ListTitle -Identity $InternalName -ErrorAction SilentlyContinue
    return ($null -ne $field)
}

function Add-ListFieldIfMissing {
    param(
        [string] $ListTitle,
        [string] $InternalName,
        [ValidateSet('Text', 'Note', 'Number', 'DateTime', 'Boolean', 'Choice')]
        [string] $FieldType,
        [string[]] $Choices = @()
    )
    if (Test-ListFieldExists -ListTitle $ListTitle -InternalName $InternalName) {
        Write-Host "  [Column] $ListTitle.$InternalName already exists — skipping."
        return
    }
    Write-Host "  [Column] Adding $ListTitle.$InternalName ($FieldType)..."
    switch ($FieldType) {
        'Text' {
            Add-PnPField -List $ListTitle -DisplayName $InternalName -InternalName $InternalName -Type Text | Out-Null
        }
        'Note' {
            Add-PnPField -List $ListTitle -DisplayName $InternalName -InternalName $InternalName -Type Note | Out-Null
        }
        'Number' {
            Add-PnPField -List $ListTitle -DisplayName $InternalName -InternalName $InternalName -Type Number | Out-Null
        }
        'DateTime' {
            Add-PnPField -List $ListTitle -DisplayName $InternalName -InternalName $InternalName -Type DateTime | Out-Null
        }
        'Boolean' {
            Add-PnPField -List $ListTitle -DisplayName $InternalName -InternalName $InternalName -Type Boolean | Out-Null
        }
        'Choice' {
            if ($Choices.Count -eq 0) {
                throw "Choice field $InternalName on list $ListTitle requires -Choices."
            }
            Add-PnPField -List $ListTitle -DisplayName $InternalName -InternalName $InternalName -Type Choice -Choices $Choices | Out-Null
        }
    }
    Write-Host "  [Column] Added $ListTitle.$InternalName."
}

Write-Host "Connecting to $SiteUrl (interactive sign-in)..."
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId

# --- Trips (Title built-in) ---
Ensure-CustomList -Title 'Trips'
Add-ListFieldIfMissing -ListTitle 'Trips' -InternalName 'DateStart' -FieldType 'DateTime'
Add-ListFieldIfMissing -ListTitle 'Trips' -InternalName 'DateEnd' -FieldType 'DateTime'
Add-ListFieldIfMissing -ListTitle 'Trips' -InternalName 'Status' -FieldType 'Choice' -Choices @(
    'Planning', 'Upcoming', 'In Progress', 'Completed', 'Archived'
)
Add-ListFieldIfMissing -ListTitle 'Trips' -InternalName 'HeroImageUrl' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'Trips' -InternalName 'SharedViewEnabled' -FieldType 'Boolean'

# --- TripDays ---
Ensure-CustomList -Title 'TripDays'
Add-ListFieldIfMissing -ListTitle 'TripDays' -InternalName 'TripId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'TripDays' -InternalName 'DayNumber' -FieldType 'Number'
Add-ListFieldIfMissing -ListTitle 'TripDays' -InternalName 'CalendarDate' -FieldType 'DateTime'
Add-ListFieldIfMissing -ListTitle 'TripDays' -InternalName 'DisplayTitle' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'TripDays' -InternalName 'DayType' -FieldType 'Choice' -Choices @(
    'PlacePort', 'Sea', 'TravelTransit'
)
# If upgrading an existing site, add the 'PreTrip' value to the TripDays.DayType choice column in list settings.

# --- Places ---
Ensure-CustomList -Title 'Places'
Add-ListFieldIfMissing -ListTitle 'Places' -InternalName 'Latitude' -FieldType 'Number'
Add-ListFieldIfMissing -ListTitle 'Places' -InternalName 'Longitude' -FieldType 'Number'
Add-ListFieldIfMissing -ListTitle 'Places' -InternalName 'Country' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'Places' -InternalName 'PlaceType' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'Places' -InternalName 'BestKnownFor' -FieldType 'Note'

# --- UserConfig (per-user settings; create list if missing) ---
Ensure-CustomList -Title 'UserConfig'
Add-ListFieldIfMissing -ListTitle 'UserConfig' -InternalName 'UserId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'UserConfig' -InternalName 'HomeCurrency' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'UserConfig' -InternalName 'TemperatureUnit' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'UserConfig' -InternalName 'DistanceUnit' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'UserConfig' -InternalName 'ShowTravellerNames' -FieldType 'Boolean'
Add-ListFieldIfMissing -ListTitle 'UserConfig' -InternalName 'JournalAuthorName' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'UserConfig' -InternalName 'SidebarWidth' -FieldType 'Number'
Add-ListFieldIfMissing -ListTitle 'UserConfig' -InternalName 'WeatherApiKey' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'UserConfig' -InternalName 'GeminiApiKey' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'UserConfig' -InternalName 'SightseeingPreferences' -FieldType 'Note'

# --- AppConfig (central key/value; not shown in user Settings UI) ---
Ensure-CustomList -Title 'AppConfig'
Add-ListFieldIfMissing -ListTitle 'AppConfig' -InternalName 'ConfigKey' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'AppConfig' -InternalName 'ConfigValue' -FieldType 'Note'
Add-ListFieldIfMissing -ListTitle 'AppConfig' -InternalName 'ConfigDescription' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'AppConfig' -InternalName 'LastUpdated' -FieldType 'DateTime'

function Ensure-AppConfigSeedRow {
    param(
        [string] $Key,
        [string] $Value,
        [string] $Description
    )
    $items = @(Get-PnPListItem -List 'AppConfig' -PageSize 5000 -ErrorAction SilentlyContinue)
    $found = $false
    foreach ($it in $items) {
        $fv = $it.FieldValues
        if ($null -ne $fv -and [string]$fv['ConfigKey'] -eq $Key) {
            $found = $true
            break
        }
    }
    if ($found) {
        Write-Host "  [AppConfig] seed '$Key' already present — skipping."
        return
    }
    Write-Host "  [AppConfig] seeding row '$Key'..."
    Add-PnPListItem -List 'AppConfig' -Values @{
        Title              = $Key
        ConfigKey          = $Key
        ConfigValue        = $Value
        ConfigDescription  = $Description
        LastUpdated        = (Get-Date)
    } | Out-Null
}

Ensure-AppConfigSeedRow -Key 'affiliate_tripadvisor' -Value 'https://www.tripadvisor.com/Search?q={place}' -Description 'TripAdvisor search link'
Ensure-AppConfigSeedRow -Key 'affiliate_viator' -Value 'https://www.viator.com/searchResults/all?text={place}' -Description 'Viator search link'
Ensure-AppConfigSeedRow -Key 'affiliate_getyourguide' -Value 'https://www.getyourguide.com/s/?q={place}' -Description 'GetYourGuide search link'
Ensure-AppConfigSeedRow -Key 'affiliate_expedia' -Value 'https://www.expedia.com/things-to-do/search?location={place}' -Description 'Expedia search link'
Ensure-AppConfigSeedRow -Key 'affiliate_booking' -Value 'https://www.booking.com/searchresults.html?ss={place}' -Description 'Booking.com search link'
Ensure-AppConfigSeedRow -Key 'affiliate_airbnb' -Value 'https://www.airbnb.com/s/{place}/homes' -Description 'Airbnb search link'
Ensure-AppConfigSeedRow -Key 'affiliate_voicemap' -Value 'https://voicemap.me/search?query={place}' -Description 'VoiceMap search link'
Ensure-AppConfigSeedRow -Key 'remote_config_url' -Value 'https://www.tripleopard.com/travelhub/config/latest.json' -Description 'Remote config pull URL'
Ensure-AppConfigSeedRow -Key 'gemini_model' -Value 'gemini-1.5-flash' -Description 'Gemini model to use for AI features'
Ensure-AppConfigSeedRow -Key 'weather_api_key' -Value '' -Description 'Managed centrally — not user-visible'
Ensure-AppConfigSeedRow -Key 'licence_validation_url' -Value 'https://www.tripleopard.com/travelhub/licence/validate' -Description 'Licence check endpoint'

# --- DayPlaces ---
Ensure-CustomList -Title 'DayPlaces'
Add-ListFieldIfMissing -ListTitle 'DayPlaces' -InternalName 'DayId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'DayPlaces' -InternalName 'PlaceId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'DayPlaces' -InternalName 'PlaceRole' -FieldType 'Choice' -Choices @(
    'Primary', 'Additional'
)

# --- ItineraryEntries ---
Ensure-CustomList -Title 'ItineraryEntries'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'TripId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'DayId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'Category' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'TimeStart' -FieldType 'DateTime'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'Duration' -FieldType 'Number'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'Supplier' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'Notes' -FieldType 'Note'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'DecisionStatus' -FieldType 'Choice' -Choices @(
    'Idea', 'Planned', 'Confirmed'
)
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'BookingRequired' -FieldType 'Boolean'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'BookingStatus' -FieldType 'Choice' -Choices @(
    'Not booked', 'Booked'
)
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'PaymentStatus' -FieldType 'Choice' -Choices @(
    'Not paid', 'Part paid', 'Fully paid'
)
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'Amount' -FieldType 'Number'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'Currency' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'UnitType' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'UnitAmount' -FieldType 'Number'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'SortOrder' -FieldType 'Number'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'ParentEntryId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'DateStart' -FieldType 'DateTime'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'DateEnd' -FieldType 'DateTime'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'BookingReference' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'RoomType' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'AccCheckInTime' -FieldType 'DateTime'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'AccCheckOutTime' -FieldType 'DateTime'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'StreetAddress' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'FlightNumbers' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'CheckInClosesTime' -FieldType 'DateTime'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'CabinClass' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'JourneyType' -FieldType 'Choice' -Choices @('oneway', 'return')
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'ReturnDate' -FieldType 'DateTime'
Add-ListFieldIfMissing -ListTitle 'ItineraryEntries' -InternalName 'ReturnTime' -FieldType 'DateTime'

# --- EntryDocuments ---
Ensure-CustomList -Title 'EntryDocuments'
Add-ListFieldIfMissing -ListTitle 'EntryDocuments' -InternalName 'EntryId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'EntryDocuments' -InternalName 'TripId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'EntryDocuments' -InternalName 'FileUrl' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'EntryDocuments' -InternalName 'DocumentType' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'EntryDocuments' -InternalName 'DayId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'EntryDocuments' -InternalName 'Category' -FieldType 'Text'

# --- EntryLinks ---
Ensure-CustomList -Title 'EntryLinks'
Add-ListFieldIfMissing -ListTitle 'EntryLinks' -InternalName 'EntryId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'EntryLinks' -InternalName 'TripId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'EntryLinks' -InternalName 'Url' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'EntryLinks' -InternalName 'LinkType' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'EntryLinks' -InternalName 'DayId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'EntryLinks' -InternalName 'Category' -FieldType 'Text'

# --- JournalEntries ---
Ensure-CustomList -Title 'JournalEntries'
Add-ListFieldIfMissing -ListTitle 'JournalEntries' -InternalName 'TripId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'JournalEntries' -InternalName 'DayId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'JournalEntries' -InternalName 'AuthorName' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'JournalEntries' -InternalName 'EntryText' -FieldType 'Note'
Add-ListFieldIfMissing -ListTitle 'JournalEntries' -InternalName 'Location' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'JournalEntries' -InternalName 'EntryTimestamp' -FieldType 'DateTime'

# --- JournalPhotos ---
Ensure-CustomList -Title 'JournalPhotos'
Add-ListFieldIfMissing -ListTitle 'JournalPhotos' -InternalName 'JournalEntryId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'JournalPhotos' -InternalName 'TripId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'JournalPhotos' -InternalName 'DayId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'JournalPhotos' -InternalName 'FileUrl' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'JournalPhotos' -InternalName 'Caption' -FieldType 'Text'

# --- JournalLikes ---
Ensure-CustomList -Title 'JournalLikes'
Add-ListFieldIfMissing -ListTitle 'JournalLikes' -InternalName 'JournalEntryId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'JournalLikes' -InternalName 'UserId' -FieldType 'Text'

# --- JournalComments ---
Ensure-CustomList -Title 'JournalComments'
Add-ListFieldIfMissing -ListTitle 'JournalComments' -InternalName 'JournalEntryId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'JournalComments' -InternalName 'AuthorName' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'JournalComments' -InternalName 'CommentText' -FieldType 'Note'
Add-ListFieldIfMissing -ListTitle 'JournalComments' -InternalName 'CommentTimestamp' -FieldType 'DateTime'

# --- TripFollowers ---
Ensure-CustomList -Title 'TripFollowers'
Add-ListFieldIfMissing -ListTitle 'TripFollowers' -InternalName 'TripId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'TripFollowers' -InternalName 'UserId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'TripFollowers' -InternalName 'AccessLevel' -FieldType 'Text'

# --- AlbumPhotos ---
Ensure-CustomList -Title 'AlbumPhotos'
Add-ListFieldIfMissing -ListTitle 'AlbumPhotos' -InternalName 'TripId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'AlbumPhotos' -InternalName 'DayId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'AlbumPhotos' -InternalName 'PlaceId' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'AlbumPhotos' -InternalName 'FileUrl' -FieldType 'Text'
Add-ListFieldIfMissing -ListTitle 'AlbumPhotos' -InternalName 'Caption' -FieldType 'Text'

Write-Host "Provisioning finished successfully."
Disconnect-PnPOnline
