export interface AdditionalPlaceRef {
  placeId: string;
  returnToPrimary: boolean;
}

export function parseAdditionalPlaceRef(token: string): AdditionalPlaceRef | undefined {
  const raw = (token || '').trim();
  if (!raw) return undefined;
  const [placeIdRaw, returnRaw] = raw.split(':');
  const placeId = (placeIdRaw || '').trim();
  if (!placeId) return undefined;
  return {
    placeId,
    returnToPrimary: returnRaw !== '0'
  };
}

export function serializeAdditionalPlaceRef(ref: AdditionalPlaceRef): string {
  return `${ref.placeId}:${ref.returnToPrimary ? '1' : '0'}`;
}

export function parseAdditionalPlaceRefs(values: string[] | undefined): AdditionalPlaceRef[] {
  return (values ?? []).map(parseAdditionalPlaceRef).filter(Boolean) as AdditionalPlaceRef[];
}
