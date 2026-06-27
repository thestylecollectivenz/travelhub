import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { getCurrentUserEmail } from '../utils/currentUserEmail';

const LIST = 'ShoppingList';

export interface ShoppingItem {
  id: string;
  tripId: string;
  itemName: string;
  category: string;
  traveller: string;
  budgetAmount: number;
  actualAmount: number;
  currency: string;
  purchaseMonth: string;
  websiteUrl: string;
  notes: string;
  isPurchased: boolean;
  ownerEmail?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToItem(item: any): ShoppingItem {
  return {
    id: String(item.ID),
    tripId: item.TripId ?? '',
    itemName: item.ItemName ?? item.Title ?? '',
    category: item.Category ?? '',
    traveller: item.Traveller ?? '',
    budgetAmount: Number(item.BudgetAmount ?? 0),
    actualAmount: Number(item.ActualAmount ?? 0),
    currency: item.Currency ?? 'NZD',
    purchaseMonth: item.PurchaseMonth ?? '',
    websiteUrl: item.WebsiteUrl ?? '',
    notes: item.ItemNotes ?? '',
    isPurchased: item.IsPurchased === true,
    ownerEmail: String(item.OwnerEmail ?? '').trim() || undefined
  };
}

function toSpItem(partial: Partial<ShoppingItem>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (partial.tripId !== undefined) out.TripId = partial.tripId;
  if (partial.itemName !== undefined) {
    out.ItemName = partial.itemName;
    out.Title = partial.itemName;
  }
  if (partial.category !== undefined) out.Category = partial.category;
  if (partial.traveller !== undefined) out.Traveller = partial.traveller;
  if (partial.budgetAmount !== undefined) out.BudgetAmount = partial.budgetAmount;
  if (partial.actualAmount !== undefined) out.ActualAmount = partial.actualAmount;
  if (partial.currency !== undefined) out.Currency = partial.currency;
  if (partial.purchaseMonth !== undefined) out.PurchaseMonth = partial.purchaseMonth;
  if (partial.websiteUrl !== undefined) out.WebsiteUrl = partial.websiteUrl;
  if (partial.notes !== undefined) out.ItemNotes = partial.notes;
  if (partial.isPurchased !== undefined) out.IsPurchased = partial.isPurchased;
  if (partial.ownerEmail !== undefined) out.OwnerEmail = partial.ownerEmail;
  return out;
}

export class ShoppingListService {
  private readonly baseUrl: string;

  constructor(private readonly ctx: WebPartContext) {
    this.baseUrl = `${ctx.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  async getForTrip(tripId: string): Promise<ShoppingItem[]> {
    const safe = tripId.replace(/'/g, "''");
    const url = `${this.baseUrl}?$select=ID,TripId,ItemName,Category,Traveller,BudgetAmount,ActualAmount,Currency,PurchaseMonth,WebsiteUrl,ItemNotes,IsPurchased,OwnerEmail&$filter=TripId eq '${safe}'&$orderby=PurchaseMonth asc,Category asc,ItemName asc&$top=5000`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`ShoppingListService.getForTrip failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map(mapToItem);
  }

  async create(item: Omit<ShoppingItem, 'id'>): Promise<ShoppingItem> {
    const ownerEmail = item.ownerEmail ?? getCurrentUserEmail(this.ctx);
    const resp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
      headers: { 'Content-Type': 'application/json;odata.metadata=minimal', Accept: 'application/json;odata.metadata=minimal' },
      body: JSON.stringify(toSpItem({ ...item, ownerEmail }))
    });
    if (!resp.ok) throw new Error(`ShoppingListService.create failed: ${resp.status}`);
    return mapToItem(await resp.json());
  }

  async update(id: string, partial: Partial<Omit<ShoppingItem, 'id' | 'tripId'>>): Promise<void> {
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${id})`, SPHttpClient.configurations.v1, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal',
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE'
      },
      body: JSON.stringify(toSpItem(partial))
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`ShoppingListService.update failed: ${resp.status}`);
  }

  async delete(id: string): Promise<void> {
    const resp = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${id})`, SPHttpClient.configurations.v1, {
      method: 'DELETE',
      headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`ShoppingListService.delete failed: ${resp.status}`);
  }
}
