import { describe, expect, it } from "vitest";
import { fetchLiveRates } from "./exchangeRate";

describe("fetchLiveRates", () => {
  it("returns AUD/EUR and AUD/USD rates with a source label", async () => {
    const rates = await fetchLiveRates();
    expect(rates.source).toBeTruthy();
    expect(rates.audEur).toBeGreaterThan(0.2);
    expect(rates.audEur).toBeLessThan(1.5);
    expect(rates.audUsd).toBeGreaterThan(0.3);
    expect(rates.audUsd).toBeLessThan(1.5);
    expect(new Date(rates.fetchedAt).getTime()).toBeGreaterThan(0);
    expect(rates.base).toBe("AUD");
  }, 30000);
});
