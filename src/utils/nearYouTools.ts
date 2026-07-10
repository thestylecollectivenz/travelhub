import type { NearestPlaceKind } from './locationInfoEntry';

export type NearYouToolId = 'dining' | NearestPlaceKind;

export interface NearYouToolDef {
  id: NearYouToolId;
  kind?: NearestPlaceKind;
  label: string;
  shortLabel: string;
  description: string;
  /** Lower = higher priority on the home strip. */
  homePriority: number;
}

/** Canonical Near you tools — used by mobile home, See all, and desktop location panel. */
export const NEAR_YOU_TOOLS: NearYouToolDef[] = [
  {
    id: 'dining',
    label: 'Restaurants',
    shortLabel: 'Restaurants',
    description: 'Cafés, restaurants, and local food near you',
    homePriority: 1
  },
  {
    id: 'restroom',
    kind: 'restroom',
    label: 'Restrooms',
    shortLabel: 'Restrooms',
    description: 'Public toilets and restrooms nearby',
    homePriority: 2
  },
  {
    id: 'atm',
    kind: 'atm',
    label: 'ATM',
    shortLabel: 'ATM',
    description: 'Cash machines near your location',
    homePriority: 3
  },
  {
    id: 'medical',
    kind: 'medical',
    label: 'Medical',
    shortLabel: 'Medical',
    description: 'Clinics, urgent care, and hospitals',
    homePriority: 4
  },
  {
    id: 'transport',
    kind: 'transport',
    label: 'Transport',
    shortLabel: 'Transport',
    description: 'Bus, train, metro, and taxi stands',
    homePriority: 5
  },
  {
    id: 'pharmacy',
    kind: 'pharmacy',
    label: 'Pharmacy',
    shortLabel: 'Pharmacy',
    description: 'Pharmacies and chemists',
    homePriority: 6
  },
  {
    id: 'fuel',
    kind: 'fuel',
    label: 'Fuel',
    shortLabel: 'Fuel',
    description: 'Petrol and fuel stations',
    homePriority: 7
  },
  {
    id: 'grocery',
    kind: 'grocery',
    label: 'Grocery',
    shortLabel: 'Grocery',
    description: 'Supermarkets and grocery stores',
    homePriority: 8
  }
];

export function homeNearYouTools(limit = 5): NearYouToolDef[] {
  return NEAR_YOU_TOOLS.slice()
    .sort((a, b) => a.homePriority - b.homePriority)
    .slice(0, limit);
}

export function desktopNearestTools(): Array<{ kind: NearestPlaceKind; label: string }> {
  return NEAR_YOU_TOOLS.filter((t): t is NearYouToolDef & { kind: NearestPlaceKind } => Boolean(t.kind)).map(
    (t) => ({ kind: t.kind, label: `Nearest ${t.shortLabel.toLowerCase()}` })
  );
}
