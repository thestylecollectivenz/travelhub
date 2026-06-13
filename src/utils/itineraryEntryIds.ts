export function isPendingItineraryEntryId(id: string): boolean {
  return id.startsWith('new-') || id.startsWith('temp-');
}

export function isPendingSubItemId(id: string): boolean {
  return id.startsWith('temp-');
}
