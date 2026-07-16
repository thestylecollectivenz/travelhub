import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { getCurrentUserEmail } from '../utils/currentUserEmail';
import { ensureUserConfigColumns } from './provisioning/ensureUserConfigColumns';

const LIST = 'UserConfig';

export interface UserConfig {
  homeCurrency: string;
  temperatureUnit: 'Celsius' | 'Fahrenheit';
  distanceUnit: 'Kilometres' | 'Miles';
  /** Trip day dates in journal: DD/MM/YYYY (DMY) or MM/DD/YYYY (MDY). */
  dateFormat: 'DMY' | 'MDY';
  showTravellerNames: boolean;
  /** Stored display name for new journal entries; empty = use M365 display name at write time. */
  journalAuthorName: string;
  /** Persisted workspace sidebar width (px). */
  sidebarWidth: number;
  /** When true, use `sidebarWidth`; otherwise auto-fit to icon tab strip. */
  sidebarWidthCustomized?: boolean;
  weatherApiKey: string;
  geminiApiKey: string;
  /** Google Maps Platform key (Places photos + accurate place lookup). Optional. */
  googleMapsApiKey: string;
  /** ElevenLabs API key for AI read-out voices (free plan supported). */
  elevenLabsApiKey: string;
  /** Selected ElevenLabs voice_id; empty = default premade voice. */
  elevenLabsVoiceId: string;
  /** Read-out engine: free browser voices by default; ElevenLabs only when chosen. */
  speechEngine: 'browser' | 'elevenlabs';
  /** Browser speechSynthesis voiceURI (or name); empty = auto-pick most natural English voice. */
  browserVoiceURI: string;
  /** When false, day budget breakdown starts collapsed on each day. */
  dayBreakdownVisibleByDefault: boolean;
}

export const DEFAULT_USER_CONFIG: UserConfig = {
  homeCurrency: 'NZD',
  temperatureUnit: 'Celsius',
  distanceUnit: 'Kilometres',
  dateFormat: 'DMY',
  showTravellerNames: true,
  journalAuthorName: '',
  sidebarWidth: 260,
  weatherApiKey: '',
  geminiApiKey: '',
  googleMapsApiKey: '',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '',
  speechEngine: 'browser',
  browserVoiceURI: '',
  dayBreakdownVisibleByDefault: true
};

/** Canonical property names the app uses in payloads / mapping. */
const CANONICAL_FIELDS = [
  'Title',
  'UserId',
  'HomeCurrency',
  'TemperatureUnit',
  'DistanceUnit',
  'DateFormat',
  'ShowTravellerNames',
  'JournalAuthorName',
  'SidebarWidth',
  'SidebarWidthCustomized',
  'WeatherApiKey',
  'GeminiApiKey',
  'GoogleMapsApiKey',
  'ElevenLabsApiKey',
  'ElevenLabsVoiceId',
  'SpeechEngine',
  'BrowserVoiceURI',
  'DayBreakdownVisibleByDefault'
] as const;

type CanonicalField = (typeof CANONICAL_FIELDS)[number];

async function logFailedResponse(label: string, resp: SPHttpClientResponse): Promise<string> {
  let body = '';
  try {
    body = await resp.text();
  } catch {
    body = '(could not read body)';
  }
  // eslint-disable-next-line no-console
  console.error(`ConfigService ${label} failed`, { status: resp.status, statusText: resp.statusText, body });
  return body;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true' || value === 'True' || value === 'Yes') return true;
  if (value === 0 || value === '0' || value === 'false' || value === 'False' || value === 'No') return false;
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/** Stable cross-device identity for UserConfig rows. */
export function resolveUserConfigKey(ctx: WebPartContext, preferred?: string): string {
  const email = (preferred || getCurrentUserEmail(ctx) || '').trim().toLowerCase();
  if (email && email.includes('@')) return email;
  const login = (ctx.pageContext.user.loginName || '').trim().toLowerCase();
  return login || email || 'unknown-user';
}

function normalizeIdentity(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return '';
  const emailMatch = v.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return emailMatch ? emailMatch[0].toLowerCase() : v;
}

function identitiesMatch(a: string, b: string): boolean {
  const na = normalizeIdentity(a);
  const nb = normalizeIdentity(b);
  if (!na || !nb) return false;
  return na === nb || a.trim().toLowerCase() === b.trim().toLowerCase();
}

interface SpFieldMeta {
  InternalName: string;
  EntityPropertyName?: string;
  StaticName?: string;
  Title?: string;
}

/**
 * Maps canonical app field names → actual SharePoint EntityPropertyName on this list.
 * Handles manually created columns whose internal names differ (spaces, casing, Field_n).
 */
class UserConfigFieldMap {
  /** canonical lower → REST property name on items */
  private toRest = new Map<string, string>();
  /** normalized alias → canonical */
  private aliasToCanonical = new Map<string, string>();

  constructor(fields: SpFieldMeta[]) {
    for (const canonical of CANONICAL_FIELDS) {
      this.aliasToCanonical.set(normalizeKey(canonical), canonical);
    }

    for (const f of fields) {
      const restName = (f.EntityPropertyName || f.InternalName || '').trim();
      if (!restName) continue;
      const aliases = [f.InternalName, f.StaticName, f.Title, f.EntityPropertyName, restName]
        .filter(Boolean)
        .map((x) => normalizeKey(String(x)));
      for (const alias of aliases) {
        const canonical = this.aliasToCanonical.get(alias);
        if (canonical) {
          this.toRest.set(canonical.toLowerCase(), restName);
        }
      }
    }

    // Always allow reading by exact canonical name if present on the item.
    for (const canonical of CANONICAL_FIELDS) {
      if (!this.toRest.has(canonical.toLowerCase())) {
        this.toRest.set(canonical.toLowerCase(), canonical);
      }
    }
  }

  restName(canonical: CanonicalField | string): string {
    return this.toRest.get(canonical.toLowerCase()) || canonical;
  }

  read(item: Record<string, unknown>, canonical: CanonicalField | string): unknown {
    const preferred = this.restName(canonical);
    if (Object.prototype.hasOwnProperty.call(item, preferred) && item[preferred] != null) {
      return item[preferred];
    }
    const want = normalizeKey(canonical);
    for (const [k, v] of Object.entries(item)) {
      if (v == null) continue;
      if (normalizeKey(k) === want) return v;
      // Match Journal_x0020_Author_x0020_Name ↔ JournalAuthorName
      if (normalizeKey(k.replace(/_x0020_/gi, ' ')) === want) return v;
    }
    return undefined;
  }

  /** Remap a canonical payload to the list's actual REST property names. */
  toWritePayload(canonicalPayload: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(canonicalPayload)) {
      out[this.restName(key)] = value;
    }
    return out;
  }
}

export class ConfigService {
  private ctx: WebPartContext;
  private baseUrl: string;
  private listApi: string;
  private fieldMap?: UserConfigFieldMap;

  constructor(context: WebPartContext) {
    this.ctx = context;
    const web = context.pageContext.web.absoluteUrl.replace(/\/$/, '');
    this.listApi = `${web}/_api/web/lists/getbytitle('${LIST}')`;
    this.baseUrl = `${this.listApi}/items`;
  }

  private async getFieldMap(): Promise<UserConfigFieldMap> {
    if (this.fieldMap) return this.fieldMap;
    const url = `${this.listApi}/fields?$select=InternalName,EntityPropertyName,StaticName,Title&$top=200`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) {
      await logFailedResponse('getFieldMap', resp);
      this.fieldMap = new UserConfigFieldMap([]);
      return this.fieldMap;
    }
    const data = (await resp.json()) as { value?: SpFieldMeta[] };
    this.fieldMap = new UserConfigFieldMap(data.value ?? []);
    // eslint-disable-next-line no-console
    console.info(
      'ConfigService field map',
      CANONICAL_FIELDS.map((c) => `${c}→${this.fieldMap!.restName(c)}`).join(', ')
    );
    return this.fieldMap;
  }

  private mapFromSpItem(item: Record<string, unknown>, fmap: UserConfigFieldMap): UserConfig {
    const temperatureUnit = asString(fmap.read(item, 'TemperatureUnit'));
    const distanceUnit = asString(fmap.read(item, 'DistanceUnit'));
    const dateFormat = asString(fmap.read(item, 'DateFormat'));
    const speechEngine = asString(fmap.read(item, 'SpeechEngine'));
    return {
      homeCurrency: asString(fmap.read(item, 'HomeCurrency')) || DEFAULT_USER_CONFIG.homeCurrency,
      temperatureUnit: temperatureUnit === 'Fahrenheit' ? 'Fahrenheit' : 'Celsius',
      distanceUnit: distanceUnit === 'Miles' ? 'Miles' : 'Kilometres',
      dateFormat: dateFormat === 'MDY' ? 'MDY' : 'DMY',
      showTravellerNames: asBoolean(
        fmap.read(item, 'ShowTravellerNames'),
        DEFAULT_USER_CONFIG.showTravellerNames
      ),
      journalAuthorName: asString(fmap.read(item, 'JournalAuthorName')),
      sidebarWidth: asNumber(fmap.read(item, 'SidebarWidth'), DEFAULT_USER_CONFIG.sidebarWidth),
      sidebarWidthCustomized: asBoolean(fmap.read(item, 'SidebarWidthCustomized'), false),
      weatherApiKey: asString(fmap.read(item, 'WeatherApiKey')),
      geminiApiKey: asString(fmap.read(item, 'GeminiApiKey')),
      googleMapsApiKey: asString(fmap.read(item, 'GoogleMapsApiKey')),
      elevenLabsApiKey: asString(fmap.read(item, 'ElevenLabsApiKey')),
      elevenLabsVoiceId: asString(fmap.read(item, 'ElevenLabsVoiceId')),
      speechEngine: speechEngine === 'elevenlabs' ? 'elevenlabs' : 'browser',
      browserVoiceURI: asString(fmap.read(item, 'BrowserVoiceURI')),
      dayBreakdownVisibleByDefault: asBoolean(
        fmap.read(item, 'DayBreakdownVisibleByDefault'),
        DEFAULT_USER_CONFIG.dayBreakdownVisibleByDefault
      )
    };
  }

  private mapToSpItem(userKey: string, config: UserConfig): Record<string, unknown> {
    return {
      Title: userKey,
      UserId: userKey,
      HomeCurrency: config.homeCurrency,
      TemperatureUnit: config.temperatureUnit,
      DistanceUnit: config.distanceUnit,
      DateFormat: config.dateFormat,
      ShowTravellerNames: config.showTravellerNames,
      JournalAuthorName: config.journalAuthorName ?? '',
      SidebarWidth: typeof config.sidebarWidth === 'number' ? config.sidebarWidth : DEFAULT_USER_CONFIG.sidebarWidth,
      SidebarWidthCustomized: config.sidebarWidthCustomized === true,
      WeatherApiKey: config.weatherApiKey ?? '',
      GeminiApiKey: config.geminiApiKey ?? '',
      GoogleMapsApiKey: config.googleMapsApiKey ?? '',
      ElevenLabsApiKey: config.elevenLabsApiKey ?? '',
      ElevenLabsVoiceId: config.elevenLabsVoiceId ?? '',
      SpeechEngine: config.speechEngine === 'elevenlabs' ? 'elevenlabs' : 'browser',
      BrowserVoiceURI: config.browserVoiceURI ?? '',
      DayBreakdownVisibleByDefault: config.dayBreakdownVisibleByDefault
    };
  }

  private async queryItems(url: string): Promise<Record<string, unknown>[]> {
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) {
      await logFailedResponse('queryItems', resp);
      return [];
    }
    const data = (await resp.json()) as { value?: Record<string, unknown>[] };
    return data.value ?? [];
  }

  /** Load items with the simplest possible queries — no $select / $orderby (those 400 silently). */
  private async loadAllConfigItems(): Promise<Record<string, unknown>[]> {
    const urls = [
      `${this.baseUrl}?$top=200`,
      `${this.baseUrl}?$top=200&$orderby=Id desc`,
      `${this.listApi}/items?$top=200`
    ];
    for (const url of urls) {
      // eslint-disable-next-line no-await-in-loop
      const rows = await this.queryItems(url);
      if (rows.length) return rows;
    }
    return [];
  }

  private scoreItem(
    item: Record<string, unknown>,
    fmap: UserConfigFieldMap,
    preferredKey: string,
    candidates: string[]
  ): number {
    const title = asString(fmap.read(item, 'Title'));
    const userId = asString(fmap.read(item, 'UserId'));
    let score = 0;
    if (identitiesMatch(userId, preferredKey) || identitiesMatch(title, preferredKey)) score += 100;
    for (const c of candidates) {
      if (identitiesMatch(userId, c) || identitiesMatch(title, c)) score += 10;
    }
    if (asString(fmap.read(item, 'HomeCurrency'))) score += 2;
    if (asString(fmap.read(item, 'WeatherApiKey')) || asString(fmap.read(item, 'GeminiApiKey'))) score += 3;
    if (asString(fmap.read(item, 'JournalAuthorName'))) score += 5;
    return score;
  }

  private async findConfigItem(
    userKey: string
  ): Promise<{ id?: number; config: UserConfig; raw?: Record<string, unknown> }> {
    const fmap = await this.getFieldMap();
    const candidates = new Set<string>();
    candidates.add(userKey);
    const login = (this.ctx.pageContext.user.loginName || '').trim().toLowerCase();
    if (login) candidates.add(login);
    const email = getCurrentUserEmail(this.ctx);
    if (email) candidates.add(email);
    const emailOnly = normalizeIdentity(email || userKey);
    if (emailOnly) candidates.add(emailOnly);

    const all = await this.loadAllConfigItems();
    const candidateList = Array.from(candidates);
    const matched = all.filter((item) => {
      const title = asString(fmap.read(item, 'Title'));
      const uid = asString(fmap.read(item, 'UserId'));
      return candidateList.some((c) => identitiesMatch(title, c) || identitiesMatch(uid, c));
    });

    // eslint-disable-next-line no-console
    console.info('ConfigService.findConfigItem', {
      userKey,
      candidates: candidateList,
      totalRows: all.length,
      matched: matched.length,
      sampleTitles: all.slice(0, 5).map((r) => ({
        id: r.ID ?? r.Id,
        Title: fmap.read(r, 'Title'),
        UserId: fmap.read(r, 'UserId'),
        JournalAuthorName: fmap.read(r, 'JournalAuthorName'),
        WeatherApiKeyLen: asString(fmap.read(r, 'WeatherApiKey')).length
      }))
    });

    if (!matched.length) {
      return { config: { ...DEFAULT_USER_CONFIG } };
    }

    matched.sort(
      (a, b) => this.scoreItem(b, fmap, userKey, candidateList) - this.scoreItem(a, fmap, userKey, candidateList)
    );
    const best = matched[0];
    const id = Number(best.ID ?? best.Id);
    const config = this.mapFromSpItem(best, fmap);
    // eslint-disable-next-line no-console
    console.info('ConfigService.loaded', {
      id,
      journalAuthorName: config.journalAuthorName,
      hasWeatherKey: Boolean(config.weatherApiKey),
      hasGeminiKey: Boolean(config.geminiApiKey),
      homeCurrency: config.homeCurrency
    });
    return { id: Number.isFinite(id) ? id : undefined, config, raw: best };
  }

  async getConfig(userKey?: string): Promise<UserConfig> {
    const key = resolveUserConfigKey(this.ctx, userKey);
    const row = await this.findConfigItem(key);
    return row.config;
  }

  private parseMissingProperty(errorBody: string): string | undefined {
    const match = errorBody.match(/The property '([^']+)' does not exist/i);
    return match?.[1];
  }

  private configsLookPersisted(
    saved: UserConfig,
    loaded: UserConfig,
    writtenKeys: Set<string>
  ): boolean {
    const check = (spName: string, ok: boolean): boolean => !writtenKeys.has(spName) || ok;
    return (
      check('HomeCurrency', loaded.homeCurrency === saved.homeCurrency) &&
      check('TemperatureUnit', loaded.temperatureUnit === saved.temperatureUnit) &&
      check('DistanceUnit', loaded.distanceUnit === saved.distanceUnit) &&
      check('DateFormat', loaded.dateFormat === saved.dateFormat) &&
      check('ShowTravellerNames', loaded.showTravellerNames === saved.showTravellerNames) &&
      check(
        'DayBreakdownVisibleByDefault',
        loaded.dayBreakdownVisibleByDefault === saved.dayBreakdownVisibleByDefault
      ) &&
      check('JournalAuthorName', (loaded.journalAuthorName || '') === (saved.journalAuthorName || '')) &&
      check('SpeechEngine', (loaded.speechEngine || 'browser') === (saved.speechEngine || 'browser')) &&
      check('WeatherApiKey', (loaded.weatherApiKey || '') === (saved.weatherApiKey || '')) &&
      check('GeminiApiKey', (loaded.geminiApiKey || '') === (saved.geminiApiKey || ''))
    );
  }

  private async writePayload(
    existingId: number | undefined,
    payload: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; body: string }> {
    if (existingId) {
      const updateResp = await this.ctx.spHttpClient.fetch(
        `${this.baseUrl}(${existingId})`,
        SPHttpClient.configurations.v1,
        {
          method: 'PATCH',
          headers: {
            Accept: 'application/json;odata.metadata=minimal',
            'Content-Type': 'application/json;odata.metadata=minimal',
            'IF-MATCH': '*'
          },
          body: JSON.stringify(payload)
        }
      );
      if (updateResp.ok || updateResp.status === 204) {
        return { ok: true, status: updateResp.status, body: '' };
      }
      const body = await logFailedResponse('saveConfig PATCH', updateResp);
      return { ok: false, status: updateResp.status, body };
    }

    const createResp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
      headers: {
        Accept: 'application/json;odata.metadata=minimal',
        'Content-Type': 'application/json;odata.metadata=minimal'
      },
      body: JSON.stringify(payload)
    });
    if (createResp.ok || createResp.status === 201) {
      return { ok: true, status: createResp.status, body: '' };
    }
    const body = await logFailedResponse('saveConfig POST', createResp);
    return { ok: false, status: createResp.status, body };
  }

  /**
   * Saves to SharePoint only. Ensures UserConfig columns when possible, then retries
   * while stripping fields SharePoint reports as missing (append-only schema lag).
   */
  async saveConfig(userKey: string | undefined, config: UserConfig): Promise<void> {
    const key = resolveUserConfigKey(this.ctx, userKey);

    try {
      await ensureUserConfigColumns(this.ctx);
      this.fieldMap = undefined; // refresh after provisioning
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('ConfigService: ensureUserConfigColumns failed (will retry save with available columns).', err);
    }

    const fmap = await this.getFieldMap();
    const existing = await this.findConfigItem(key);
    let canonical = this.mapToSpItem(key, config);
    let payload = fmap.toWritePayload(canonical);
    const stripped: string[] = [];
    let lastStatus = 0;
    let lastBody = '';

    for (let attempt = 0; attempt < 24; attempt++) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.writePayload(existing.id, payload);
      if (result.ok) {
        if (existing.id && existing.raw) {
          const prevUserId = asString(fmap.read(existing.raw, 'UserId')).trim().toLowerCase();
          const prevTitle = asString(fmap.read(existing.raw, 'Title')).trim().toLowerCase();
          if (prevUserId !== key || prevTitle !== key) {
            const idPayload = fmap.toWritePayload({ Title: key, UserId: key });
            await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${existing.id})`, SPHttpClient.configurations.v1, {
              method: 'PATCH',
              headers: {
                Accept: 'application/json;odata.metadata=minimal',
                'Content-Type': 'application/json;odata.metadata=minimal',
                'IF-MATCH': '*'
              },
              body: JSON.stringify(idPayload)
            });
          }
        }
        if (stripped.length) {
          // eslint-disable-next-line no-console
          console.warn(
            'ConfigService: saved without columns not yet on UserConfig list:',
            stripped.join(', ')
          );
        }

        const verified = await this.getConfig(key);
        const writtenKeys = new Set(Object.keys(canonical));
        for (const s of stripped) writtenKeys.delete(s);
        if (!this.configsLookPersisted(config, verified, writtenKeys)) {
          // eslint-disable-next-line no-console
          console.error('ConfigService: save wrote but reload mismatch', {
            key,
            existingId: existing.id,
            saved: { journalAuthorName: config.journalAuthorName, homeCurrency: config.homeCurrency },
            loaded: { journalAuthorName: verified.journalAuthorName, homeCurrency: verified.homeCurrency },
            stripped
          });
          throw new Error(
            'Settings save did not stick in SharePoint. Check UserConfig column internal names (List settings → column → name in URL Field=).'
          );
        }
        return;
      }

      lastStatus = result.status;
      lastBody = result.body;
      if (result.status !== 400) break;

      const missing = this.parseMissingProperty(result.body);
      if (!missing) break;

      // Strip by REST name or canonical name.
      const canonHit = Object.keys(canonical).find(
        (k) => k === missing || fmap.restName(k) === missing || normalizeKey(k) === normalizeKey(missing)
      );
      if (!canonHit || canonHit === 'Title' || canonHit === 'UserId') break;
      delete canonical[canonHit];
      stripped.push(canonHit);
      payload = fmap.toWritePayload(canonical);
    }

    throw new Error(
      `Could not save settings to SharePoint (${lastStatus}). ${lastBody.slice(0, 220)}`
    );
  }
}
