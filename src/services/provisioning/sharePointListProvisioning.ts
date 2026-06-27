import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

const JSON_ODATA_VERBOSE = 'application/json;odata=verbose';
const JSON_ODATA_MINIMAL = 'application/json;odata.metadata=minimal';

export type ProvisionFieldType = 'Text' | 'Note' | 'Number' | 'DateTime' | 'Boolean';

export interface ProvisionFieldSpec {
  internalName: string;
  type: ProvisionFieldType;
}

const FIELD_TYPE_KIND: Record<ProvisionFieldType, number> = {
  Text: 2,
  Note: 3,
  Number: 9,
  DateTime: 4,
  Boolean: 8
};

function webApiBase(ctx: WebPartContext): string {
  return `${ctx.pageContext.web.absoluteUrl}/_api/web`;
}

async function listExists(ctx: WebPartContext, listTitle: string): Promise<boolean> {
  const url = `${webApiBase(ctx)}/lists/getbytitle('${listTitle.replace(/'/g, "''")}')`;
  const resp = await ctx.spHttpClient.get(url, SPHttpClient.configurations.v1, {
    headers: { Accept: JSON_ODATA_MINIMAL }
  });
  return resp.ok;
}

async function fieldExists(ctx: WebPartContext, listTitle: string, internalName: string): Promise<boolean> {
  const safeList = listTitle.replace(/'/g, "''");
  const safeField = internalName.replace(/'/g, "''");
  const url = `${webApiBase(ctx)}/lists/getbytitle('${safeList}')/fields/getbyinternalnameortitle('${safeField}')`;
  const resp = await ctx.spHttpClient.get(url, SPHttpClient.configurations.v1, {
    headers: { Accept: JSON_ODATA_MINIMAL }
  });
  return resp.ok;
}

async function createList(ctx: WebPartContext, listTitle: string): Promise<void> {
  const url = `${webApiBase(ctx)}/lists`;
  const resp: SPHttpClientResponse = await ctx.spHttpClient.post(url, SPHttpClient.configurations.v1, {
    headers: {
      Accept: JSON_ODATA_VERBOSE,
      'Content-Type': JSON_ODATA_VERBOSE
    },
    body: JSON.stringify({
      __metadata: { type: 'SP.List' },
      AllowContentTypes: true,
      BaseTemplate: 100,
      ContentTypesEnabled: true,
      Title: listTitle
    })
  });
  if (!resp.ok) {
    throw new Error(`Failed to create list '${listTitle}': ${resp.status}`);
  }
}

async function createField(ctx: WebPartContext, listTitle: string, spec: ProvisionFieldSpec): Promise<void> {
  const safeList = listTitle.replace(/'/g, "''");
  const url = `${webApiBase(ctx)}/lists/getbytitle('${safeList}')/fields`;
  const resp: SPHttpClientResponse = await ctx.spHttpClient.post(url, SPHttpClient.configurations.v1, {
    headers: {
      Accept: JSON_ODATA_VERBOSE,
      'Content-Type': JSON_ODATA_VERBOSE
    },
    body: JSON.stringify({
      __metadata: { type: 'SP.Field' },
      FieldTypeKind: FIELD_TYPE_KIND[spec.type],
      Title: spec.internalName,
      StaticName: spec.internalName
    })
  });
  if (!resp.ok) {
    throw new Error(`Failed to create column '${listTitle}.${spec.internalName}': ${resp.status}`);
  }
}

/**
 * Append-only list provisioning: create list and columns only when missing.
 * Never deletes or renames existing SharePoint schema.
 */
export async function ensureSharePointList(
  ctx: WebPartContext,
  listTitle: string,
  fields: ProvisionFieldSpec[]
): Promise<void> {
  if (!(await listExists(ctx, listTitle))) {
    await createList(ctx, listTitle);
  }
  for (const field of fields) {
    if (await fieldExists(ctx, listTitle, field.internalName)) continue;
    // eslint-disable-next-line no-await-in-loop
    await createField(ctx, listTitle, field);
  }
}
