import type { NearYouToolId } from './nearYouTools';
import type { DiningVenueFocus } from '../services/GeminiService';
import type { NearestPlaceKind } from './locationInfoEntry';

/** Explore / Saved category ids used by location-info View all screens. */
export type ExploreCategoryId =
  | 'restaurants'
  | 'cafes'
  | 'shopping'
  | 'sights'
  | 'groceries'
  | 'pharmacy'
  | 'atm'
  | 'restroom'
  | 'transport'
  | 'medical'
  | 'fuel';

export type SavedPlacesCategoryId = 'all' | 'dining' | 'sights' | 'shopping' | 'essentials';

export interface ExploreCategoryDef {
  id: ExploreCategoryId;
  label: string;
  /** Accent for pill label text / icon. */
  accent: string;
  /** Soft background for icon chip. */
  bg: string;
  /** Primary pills shown before "More". */
  primary?: boolean;
  underMore?: boolean;
}

export const EXPLORE_CATEGORIES: ExploreCategoryDef[] = [
  { id: 'restaurants', label: 'Restaurants', accent: '#c4783a', bg: '#f8eee4', primary: true },
  { id: 'cafes', label: 'Cafés', accent: '#8a7355', bg: '#f4ebe0', primary: true },
  { id: 'shopping', label: 'Shopping', accent: '#c45c3a', bg: '#f8ebe6', primary: true },
  { id: 'sights', label: 'Sights', accent: '#2f5eb8', bg: '#e8eef8', primary: true },
  { id: 'groceries', label: 'Groceries', accent: '#6b7c3a', bg: '#eef1e4', primary: true },
  { id: 'pharmacy', label: 'Pharmacy', accent: '#1AA3B5', bg: '#e6f7f9', primary: true },
  { id: 'atm', label: 'ATM', accent: '#6b7c3a', bg: '#eef4e8', underMore: true },
  { id: 'restroom', label: 'Restrooms', accent: '#5c6b7a', bg: '#eef1f4', underMore: true },
  { id: 'transport', label: 'Transport', accent: '#5c6570', bg: '#eceeef', underMore: true },
  { id: 'medical', label: 'Medical', accent: '#6b7c3a', bg: '#eef1e4', underMore: true },
  { id: 'fuel', label: 'Fuel', accent: '#8a7355', bg: '#f4f0e8', underMore: true }
];

export function exploreCategoryById(id: string | undefined): ExploreCategoryDef {
  return EXPLORE_CATEGORIES.find((c) => c.id === id) ?? EXPLORE_CATEGORIES[0];
}

export function exploreCategoryToNearTool(id: ExploreCategoryId): NearYouToolId | undefined {
  switch (id) {
    case 'restaurants':
      return 'dining';
    case 'cafes':
      return 'cafes';
    case 'shopping':
    case 'groceries':
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
      return undefined;
    default:
      return undefined;
  }
}

export function exploreCategoryDiningFocus(id: ExploreCategoryId): DiningVenueFocus | undefined {
  if (id === 'restaurants') return 'restaurants';
  if (id === 'cafes') return 'cafes';
  if (id === 'sights') return 'attractions';
  return undefined;
}

export function exploreCategoryNearestKind(id: ExploreCategoryId): NearestPlaceKind | undefined {
  if (id === 'shopping' || id === 'groceries') return 'grocery';
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
  if (k === 'shop' || k === 'shopping') return 'shopping';
  if (k === 'sight' || k === 'sights' || k === 'attractions') return 'sights';
  if (k === 'grocery' || k === 'groceries') return 'groceries';
  if (k === 'pharmacy') return 'pharmacy';
  if (k === 'atm') return 'atm';
  if (k === 'restroom' || k === 'restrooms') return 'restroom';
  if (k === 'transport') return 'transport';
  if (k === 'medical') return 'medical';
  if (k === 'fuel') return 'fuel';
  return 'restaurants';
}
