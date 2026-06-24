export const PACKING_DRAG_MIME = 'application/x-travelhub-packing-template';

export interface PackingTemplateDragPayload {
  itemName: string;
  category: string;
  quantity: number;
}

export function parsePackingTemplateDrag(data: string): PackingTemplateDragPayload | undefined {
  if (!data.trim()) return undefined;
  try {
    const parsed = JSON.parse(data) as PackingTemplateDragPayload;
    if (!parsed?.itemName?.trim()) return undefined;
    return {
      itemName: parsed.itemName.trim(),
      category: parsed.category || 'Other',
      quantity: Math.max(1, parsed.quantity || 1)
    };
  } catch {
    return undefined;
  }
}
