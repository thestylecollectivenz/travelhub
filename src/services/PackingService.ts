import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

const LIST = 'PackingList';
const TEMPLATES_LIST = 'PackingTemplates';

export interface PackingItem {
  id: string;
  tripId: string;
  category: string;
  itemName: string;
  quantity: number;
  isPacked: boolean;
  isTemplate: boolean;
  templateId?: string;
}

export interface PackingTemplate {
  id: string;
  templateName: string;
  description: string;
}

function mapToItem(item: any): PackingItem {
  return {
    id: String(item.ID),
    tripId: item.TripId ?? '',
    category: item.Category ?? 'Other',
    itemName: item.ItemName ?? '',
    quantity: Number(item.Quantity ?? 1),
    isPacked: item.IsPacked === true,
    isTemplate: item.IsTemplate === true,
    templateId: item.TemplateId ?? ''
  };
}

function mapToTemplate(item: any): PackingTemplate {
  return {
    id: String(item.ID),
    templateName: item.TemplateName ?? '',
    description: item.Description ?? ''
  };
}

function toSpItem(partial: Partial<PackingItem>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (partial.tripId !== undefined) out.TripId = partial.tripId;
  if (partial.category !== undefined) out.Category = partial.category;
  if (partial.itemName !== undefined) out.ItemName = partial.itemName;
  if (partial.quantity !== undefined) out.Quantity = partial.quantity;
  if (partial.isPacked !== undefined) out.IsPacked = partial.isPacked;
  if (partial.isTemplate !== undefined) out.IsTemplate = partial.isTemplate;
  if (partial.templateId !== undefined) out.TemplateId = partial.templateId || '';
  if (partial.itemName !== undefined) out.Title = partial.itemName;
  return out;
}

export class PackingService {
  private readonly baseUrl: string;
  private readonly templatesUrl: string;
  constructor(private readonly ctx: WebPartContext) {
    this.baseUrl = `${ctx.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
    this.templatesUrl = `${ctx.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${TEMPLATES_LIST}')/items`;
  }

  async getForTrip(tripId: string): Promise<PackingItem[]> {
    const safe = tripId.replace(/'/g, "''");
    const url = `${this.baseUrl}?$select=ID,TripId,Category,ItemName,Quantity,IsPacked,IsTemplate,TemplateId&$filter=TripId eq '${safe}' and (IsTemplate eq null or IsTemplate eq 0)&$orderby=Category asc,ItemName asc&$top=5000`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`PackingService.getForTrip failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map(mapToItem);
  }

  async getTemplates(): Promise<Array<PackingTemplate & { items: PackingItem[] }>> {
    const [templatesResp, templateItemsResp] = await Promise.all([
      this.ctx.spHttpClient.get(`${this.templatesUrl}?$select=ID,TemplateName,Description&$orderby=TemplateName asc&$top=5000`, SPHttpClient.configurations.v1),
      this.ctx.spHttpClient.get(`${this.baseUrl}?$select=ID,TripId,Category,ItemName,Quantity,IsPacked,IsTemplate,TemplateId&$filter=IsTemplate eq 1&$top=5000`, SPHttpClient.configurations.v1)
    ]);
    if (!templatesResp.ok) throw new Error(`PackingService.getTemplates failed: ${templatesResp.status}`);
    if (!templateItemsResp.ok) throw new Error(`PackingService.getTemplateItems failed: ${templateItemsResp.status}`);
    const templatesData = await templatesResp.json();
    const itemsData = await templateItemsResp.json();
    const templates: PackingTemplate[] = (templatesData.value ?? []).map(mapToTemplate);
    const items: PackingItem[] = (itemsData.value ?? []).map(mapToItem);
    return templates.map((t) => ({ ...t, items: items.filter((x) => (x.templateId || '') === t.id) }));
  }

  async create(item: Omit<PackingItem, 'id'>): Promise<PackingItem> {
    const resp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
      headers: { 'Content-Type': 'application/json;odata.metadata=minimal', Accept: 'application/json;odata.metadata=minimal' },
      body: JSON.stringify(toSpItem(item))
    });
    if (!resp.ok) throw new Error(`PackingService.create failed: ${resp.status}`);
    return mapToItem(await resp.json());
  }

  async update(id: string, partial: Partial<Omit<PackingItem, 'id' | 'tripId'>>): Promise<void> {
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
    if (!resp.ok && resp.status !== 204) throw new Error(`PackingService.update failed: ${resp.status}`);
  }

  async delete(id: string): Promise<void> {
    const resp = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${id})`, SPHttpClient.configurations.v1, {
      method: 'DELETE',
      headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`PackingService.delete failed: ${resp.status}`);
  }

  async createTemplate(templateName: string, description: string): Promise<PackingTemplate> {
    const resp = await this.ctx.spHttpClient.post(this.templatesUrl, SPHttpClient.configurations.v1, {
      headers: { 'Content-Type': 'application/json;odata.metadata=minimal', Accept: 'application/json;odata.metadata=minimal' },
      body: JSON.stringify({ Title: templateName, TemplateName: templateName, Description: description || '' })
    });
    if (!resp.ok) throw new Error(`PackingService.createTemplate failed: ${resp.status}`);
    return mapToTemplate(await resp.json());
  }

  async bulkCreate(items: Array<Omit<PackingItem, 'id'>>): Promise<void> {
    await Promise.all(items.map((item) => this.create(item).then(() => undefined)));
  }
}
