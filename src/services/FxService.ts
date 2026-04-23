import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

const FX_API = 'https://open.er-api.com/v6/latest/NZD';
const LIST = 'FXRates';

export class FxService {
  private ctx: WebPartContext;
  private baseUrl: string;
  // In-memory cache for this session: quoteCurrency -> rate
  private sessionCache: Map<string, number> = new Map();

  constructor(context: WebPartContext) {
    this.ctx = context;
    this.baseUrl = `${context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  /**
   * Convert amount from source currency into configured home currency.
   * Rates are stored as: 1 NZD = quoteCurrency rate.
   */
  convertToHomeCurrency(amount: number, currency: string, homeCurrency: string): number {
    const source = (currency || 'NZD').toUpperCase();
    const target = (homeCurrency || 'NZD').toUpperCase();

    if (source === target) return amount;
    if (source === 'NZD') {
      const targetRate = this.sessionCache.get(target);
      return targetRate && targetRate !== 0 ? amount * targetRate : amount;
    }
    const sourceRate = this.sessionCache.get(source);
    if (!sourceRate || sourceRate === 0) return amount;

    const nzdAmount = amount / sourceRate;
    if (target === 'NZD') return nzdAmount;

    const targetRate = this.sessionCache.get(target);
    if (!targetRate || targetRate === 0) return amount;
    return nzdAmount * targetRate;
  }

  /** Expose the populated session cache for external consumers. */
  getRates(): Map<string, number> {
    return new Map(this.sessionCache);
  }

  /**
   * Initialise the service by loading today's rates.
   * Checks SP cache first; fetches fresh from API if stale or missing.
   * Call this once on workspace load before rendering financial totals.
   */
  async initialise(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    try {
      // Try SP cache first
      const cached = await this.loadFromSP(today);
      if (cached.size > 0) {
        this.sessionCache = cached;
        return;
      }
      // Fetch fresh from API
      const fresh = await this.fetchFromApi();
      if (fresh.size > 0) {
        this.sessionCache = fresh;
        await this.saveToSP(fresh, today);
      }
    } catch (err) {
      console.error('FxService.initialise failed — falling back to SP cache', err);
      // Try any cached rate regardless of date
      try {
        const stale = await this.loadFromSP();
        if (stale.size > 0) {
          this.sessionCache = stale;
        }
      } catch (err2) {
        console.error('FxService: stale cache load also failed', err2);
      }
    }
  }

  /** Load rates from SP FXRates list. If today is provided, filters to today's rates only. */
  private async loadFromSP(today?: string): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    try {
      let url = `${this.baseUrl}?$select=ID,QuoteCurrency,Rate,FetchDate&$orderby=FetchDate desc&$top=500`;
      if (today) {
        url += `&$filter=BaseCurrency eq 'NZD'`;
      }
      const resp: SPHttpClientResponse = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
      if (!resp.ok) return result;
      const data = await resp.json();
      const items: { QuoteCurrency: string; Rate: number; FetchDate: string }[] = data.value ?? [];
      for (const item of items) {
        if (!today) {
          // Stale fallback — take first (most recent) rate per currency
          if (!result.has(item.QuoteCurrency)) {
            result.set(item.QuoteCurrency, item.Rate);
          }
        } else {
          // Today only
          const fetchDay = item.FetchDate ? item.FetchDate.split('T')[0] : '';
          if (fetchDay === today) {
            result.set(item.QuoteCurrency, item.Rate);
          }
        }
      }
    } catch (err) {
      console.error('FxService.loadFromSP', err);
    }
    return result;
  }

  /** Fetch live rates from open.er-api.com with base NZD. */
  private async fetchFromApi(): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    try {
      const resp = await fetch(FX_API);
      if (!resp.ok) throw new Error(`FX API responded ${resp.status}`);
      const data = await resp.json();
      if (data.result !== 'success' || !data.rates) throw new Error('FX API returned unexpected shape');
      const rates: Record<string, number> = data.rates;
      for (const currency in rates) {
        if (!Object.prototype.hasOwnProperty.call(rates, currency)) continue;
        const rate = rates[currency];
        if (currency !== 'NZD' && typeof rate === 'number') {
          result.set(currency, rate);
        }
      }
    } catch (err) {
      console.error('FxService.fetchFromApi', err);
    }
    return result;
  }

  /** Save fetched rates to SP FXRates list. One row per currency pair. */
  private async saveToSP(rates: Map<string, number>, today: string): Promise<void> {
    const fetchDate = new Date().toISOString();
    const promises: Promise<void>[] = [];

    rates.forEach((rate, quoteCurrency) => {
      const body = JSON.stringify({
        Title: `NZD-${quoteCurrency}`,
        BaseCurrency: 'NZD',
        QuoteCurrency: quoteCurrency,
        Rate: rate,
        FetchDate: fetchDate
      });
      const p = this.ctx.spHttpClient
        .post(this.baseUrl, SPHttpClient.configurations.v1, {
          headers: {
            'Content-Type': 'application/json;odata.metadata=minimal',
            Accept: 'application/json;odata.metadata=minimal'
          },
          body
        })
        .then((resp) => {
          if (!resp.ok && resp.status !== 201) {
            console.error(`FxService.saveToSP: failed for ${quoteCurrency} — ${resp.status}`);
          }
        })
        .catch((err) => {
          console.error(`FxService.saveToSP: error for ${quoteCurrency}`, err);
        });
      promises.push(p);
    });

    // Save in batches of 10 to avoid overwhelming SP
    const batchSize = 10;
    for (let i = 0; i < promises.length; i += batchSize) {
      await Promise.all(promises.slice(i, i + batchSize));
    }
    console.log(`FxService: saved ${rates.size} rates for ${today}`);
  }
}
