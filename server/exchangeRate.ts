/**
 * Live exchange rate service — AUD base.
 * Fetches AUD/EUR and AUD/USD from a free, reliable public API.
 * Rates are NEVER applied silently: the caller must present them to the
 * user for explicit confirmation before they are used in costing.
 */

export interface LiveRates {
  base: "AUD";
  audEur: number;
  audUsd: number;
  audNzd: number;
  source: string;
  fetchedAt: string;
}

export async function fetchLiveRates(): Promise<LiveRates> {
  // Primary source: frankfurter.dev (ECB reference rates, no API key required)
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=AUD&symbols=EUR,USD,NZD");
    if (res.ok) {
      const data = (await res.json()) as { rates: { EUR: number; USD: number; NZD: number }; date: string };
      return {
        base: "AUD",
        audEur: data.rates.EUR,
        audUsd: data.rates.USD,
        audNzd: data.rates.NZD,
        source: `European Central Bank via Frankfurter (${data.date})`,
        fetchedAt: new Date().toISOString(),
      };
    }
  } catch {
    // fall through to secondary source
  }
  // Secondary source: open.er-api.com (no API key required)
  const res2 = await fetch("https://open.er-api.com/v6/latest/AUD");
  if (!res2.ok) throw new Error("Unable to fetch live exchange rates from any source");
  const data2 = (await res2.json()) as { rates: { EUR: number; USD: number; NZD: number } };
  return {
    base: "AUD",
    audEur: data2.rates.EUR,
    audUsd: data2.rates.USD,
    audNzd: data2.rates.NZD,
    source: "Open Exchange Rate API (open.er-api.com)",
    fetchedAt: new Date().toISOString(),
  };
}
