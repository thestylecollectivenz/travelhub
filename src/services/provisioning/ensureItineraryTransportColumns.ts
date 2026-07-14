import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

/** Append-only: transport + payment-due columns required for Transport save/load. */
const ITINERARY_FIELDS = [
  { internalName: 'TransportFrom', type: 'Text' as const },
  { internalName: 'TransportTo', type: 'Text' as const },
  { internalName: 'TransportMode', type: 'Text' as const },
  { internalName: 'TransportTransfers', type: 'Number' as const },
  { internalName: 'JourneyType', type: 'Text' as const },
  { internalName: 'ReturnDate', type: 'DateTime' as const },
  { internalName: 'ReturnTime', type: 'DateTime' as const },
  { internalName: 'ReturnArrivalTime', type: 'DateTime' as const },
  { internalName: 'BookingDueDate', type: 'DateTime' as const },
  { internalName: 'PaymentDueDate', type: 'DateTime' as const },
  { internalName: 'PaymentDueType', type: 'Text' as const }
];

export async function ensureItineraryTransportColumns(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, 'ItineraryEntries', ITINERARY_FIELDS);
}
