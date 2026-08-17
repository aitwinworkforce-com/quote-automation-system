import { describe, expect, it } from "vitest";
import { fetchLiveRates } from "./exchangeRate";

describe("fetchLiveRates", () => {
  it("returns AUD/EUR, AUD/USD, and AUD/NZD rates with a source label", async () => {
    const rates = await fetchLiveRates();
    expect(rates.source).toBeTruthy();
    expect(rates.audEur).toBeGreaterThan(0.2);
    expect(rates.audEur).toBeLessThan(1.5);
    expect(rates.audUsd).toBeGreaterThan(0.3);
    expect(rates.audUsd).toBeLessThan(1.5);
    expect(rates.audNzd).toBeGreaterThan(0.8);
    expect(rates.audNzd).toBeLessThan(1.5);
    expect(rates.audGbp).toBeGreaterThan(0.3);
    expect(rates.audGbp).toBeLessThan(1.0);
    expect(new Date(rates.fetchedAt).getTime()).toBeGreaterThan(0);
    expect(rates.base).toBe("AUD");
  }, 30000);
});
