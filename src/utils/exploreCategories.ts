import type { NearYouToolId } from './nearYouTools';
import type { DiningVenueFocus } from '../services/GeminiService';
import type { NearestPlaceKind } from './locationInfoEntry';

/** Explore / Saved category ids used by location-info View all screens. */
export type ExploreCategoryId =
  | 'restaurants'
  | 'cafes'
  | 'bakeries'
  | 'nightlife'
  | 'shopping'
  | 'sights'
  | 'parks'
  | 'museums'
  | 'markets'
  | 'viewpoints'
  | 'groceries'
  | 'pharmacy'
  | 'atm'
  | 'restroom'
  | 'transport'
  | 'medical'
  | 'fuel';

export interface ExploreCategoryDef {
  id: ExploreCategoryId;
  label: string;
  /** Accent for pill label text / icon. */
  accent: string;
  /** Soft background for icon chip. */
  bg: string;
  /**
   * Lower = prefer showing earlier when fitting pills.
   * Overflow goes behind "More".
   */
  priority: number;
}

export const EXPLORE_CATEGORIES: ExploreCategoryDef[] = [
  { id: 'restaurants', label: 'Restaurants', accent: '#c4783a', bg: '#f8eee4', priority: 1 },
  { id: 'cafes', label: 'Cafés', accent: '#8a7355', bg: '#f4ebe0', priority: 2 },
  { id: 'shopping', label: 'Shopping', accent: '#c45c3a', bg: '#f8ebe6', priority: 3 },
  { id: 'sights', label: 'Sights', accent: '#2f5eb8', bg: '#e8eef8', priority: 4 },
  { id: 'bakeries', label: 'Bakeries', accent: '#b8894a', bg: '#f7f0e4', priority: 5 },
  { id: 'groceries', label: 'Groceries', accent: '#6b7c3a', bg: '#eef1e4', priority: 6 },
  { id: 'pharmacy', label: 'Pharmacy', accent: '#1AA3B5', bg: '#e6f7f9', priority: 7 },
  { id: 'parks', label: 'Parks', accent: '#3d8f6e', bg: '#e6f4ee', priority: 8 },
  { id: 'museums', label: 'Museums', accent: '#5c6bb8', bg: '#eceff8', priority: 9 },
  { id: 'markets', label: 'Markets', accent: '#c45c3a', bg: '#f8ebe6', priority: 10 },
  { id: 'nightlife', label: 'Nightlife', accent: '#7a4f9a', bg: '#f3ebf8', priority: 11 },
  { id: 'viewpoints', label: 'Viewpoints', accent: '#2f5eb8', bg: '#e8eef8', priority: 12 },
  { id: 'atm', label: 'ATM', accent: '#6b7c3a', bg: '#eef4e8', priority: 13 },
  { id: 'restroom', label: 'Restrooms', accent: '#5c6b7a', bg: '#eef1f4', priority: 14 },
  { id: 'transport', label: 'Transport', accent: '#5c6570', bg: '#eceeef', priority: 15 },
  { id: 'medical', label: 'Medical', accent: '#6b7c3a', bg: '#eef1e4', priority: 16 },
  { id: 'fuel', label: 'Fuel', accent: '#8a7355', bg: '#f4f0e8', priority: 17 }
];

export function exploreCategoriesSorted(): ExploreCategoryDef[] {
  return [...EXPLORE_CATEGORIES].sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
}

export function exploreCategoryById(id: string | undefined): ExploreCategoryDef {
  return EXPLORE_CATEGORIES.find((c) => c.id === id) ?? EXPLORE_CATEGORIES[0];
}

export function exploreCategoryToNearTool(id: ExploreCategoryId): NearYouToolId | undefined {
  switch (id) {
    case 'restaurants':
    case 'nightlife':
      return 'dining';
    case 'cafes':
    case 'bakeries':
      return 'cafes';
    case 'shopping':
    case 'groceries':
    case 'markets':
      return 'grocery';
    case 'pharmacy':
      return 'pharmacy';
    case 'atm':
      return 'atm';
    case 'restroom':
      return 'restroom';
    case 'transport':
      return 'transport';
    case 'medical':
      return 'medical';
    case 'fuel':
      return 'fuel';
    case 'sights':
    case 'parks':
    case 'museums':
    case 'viewpoints':
      return undefined;
    default:
      return undefined;
  }
}

export function exploreCategoryDiningFocus(id: ExploreCategoryId): DiningVenueFocus | undefined {
  if (id === 'restaurants' || id === 'nightlife') return 'restaurants';
  if (id === 'cafes' || id === 'bakeries') return 'cafes';
  if (id === 'sights' || id === 'parks' || id === 'museums' || id === 'viewpoints') return 'attractions';
  return undefined;
}

export function exploreCategoryNearestKind(id: ExploreCategoryId): NearestPlaceKind | undefined {
  if (id === 'shopping' || id === 'groceries' || id === 'markets') return 'grocery';
  if (id === 'pharmacy') return 'pharmacy';
  if (id === 'atm') return 'atm';
  if (id === 'restroom') return 'restroom';
  if (id === 'transport') return 'transport';
  if (id === 'medical') return 'medical';
  if (id === 'fuel') return 'fuel';
  return undefined;
}

/** Map free-form category string from onOpenExplore into a known id. */
export function normalizeExploreCategory(raw?: string): ExploreCategoryId {
  const k = (raw || '').trim().toLowerCase();
  if (k === 'dining' || k === 'restaurant' || k === 'restaurants') return 'restaurants';
  if (k === 'cafe' || k === 'cafes' || k === 'cafés') return 'cafes';
  if (k === 'bakery' || k === 'bakeries') return 'bakeries';
  if (k === 'nightlife' || k === 'bars' || k === 'night') return 'nightlife';
  if (k === 'shop' || k === 'shopping') return 'shopping';
  if (k === 'sight' || k === 'sights' || k === 'attractions') return 'sights';
  if (k === 'park' || k === 'parks') return 'parks';
  if (k === 'museum' || k === 'museums') return 'museums';
  if (k === 'market' || k === 'markets') return 'markets';
  if (k === 'viewpoint' || k === 'viewpoints' || k === 'views') return 'viewpoints';
  if (k === 'grocery' || k === 'groceries') return 'groceries';
  if (k === 'pharmacy') return 'pharmacy';
  if (k === 'atm') return 'atm';
  if (k === 'restroom' || k === 'restrooms') return 'restroom';
  if (k === 'transport') return 'transport';
  if (k === 'medical') return 'medical';
  if (k === 'fuel') return 'fuel';
  return 'restaurants';
}

/** Map a saved dining/nearest row onto an Explore category for shared filters. */
export function savedRowToExploreCategory(input: {
  source: 'dining' | 'nearest';
  nearestKind?: NearestPlaceKind;
  categoryLabel?: string;
}): ExploreCategoryId {
  if (input.source === 'nearest' && input.nearestKind) {
    switch (input.nearestKind) {
      case 'grocery':
        return 'groceries';
      case 'pharmacy':
        return 'pharmacy';
      case 'atm':
        return 'atm';
      case 'restroom':
        return 'restroom';
      case 'transport':
        return 'transport';
      case 'medical':
        return 'medical';
      case 'fuel':
        return 'fuel';
      default:
        break;
    }
  }
  const label = (input.categoryLabel || '').toLowerCase();
  if (/cafe|coffee|bakery/.test(label)) return label.includes('bakery') ? 'bakeries' : 'cafes';
  if (/bar|night|cocktail|pub/.test(label)) return 'nightlife';
  if (/museum/.test(label)) return 'museums';
  if (/park|garden/.test(label)) return 'parks';
  if (/market/.test(label)) return 'markets';
  if (/view|lookout/.test(label)) return 'viewpoints';
  if (/sight|attraction|landmark/.test(label)) return 'sights';
  if (/shop|retail/.test(label)) return 'shopping';
  return normalizeExploreCategory(label);
}

export type SavedPlacesCategoryId = 'all' | ExploreCategoryId;
