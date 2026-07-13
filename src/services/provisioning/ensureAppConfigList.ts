import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

/** Site-wide key/value settings (affiliate links, etc.). Append-only columns. */
export async function ensureAppConfigList(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, 'AppConfig', [
    { internalName: 'ConfigKey', type: 'Text' },
    { internalName: 'ConfigValue', type: 'Note' }
  ]);
}
