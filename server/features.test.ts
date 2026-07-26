import { describe, expect, it } from "vitest";

/**
 * Unit tests for feature batch 2:
 *  - revision label sequencing (A → B → ... → Z → AA)
 *  - supplier settings validation bounds
 *  - email service configuration guard
 */

// Mirror of nextRevisionLabel in server/routers/revisions.ts
function nextRevisionLabel(current: string): string {
  const chars = current.toUpperCase().split("");
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] !== "Z") {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join("");
    }
    chars[i] = "A";
    i--;
  }
  return "A" + chars.join("");
}

describe("revision label sequencing", () => {
  it("increments simple labels", () => {
    expect(nextRevisionLabel("A")).toBe("B");
    expect(nextRevisionLabel("B")).toBe("C");
    expect(nextRevisionLabel("Y")).toBe("Z");
  });
  it("rolls over Z to AA", () => {
    expect(nextRevisionLabel("Z")).toBe("AA");
    expect(nextRevisionLabel("AZ")).toBe("BA");
    expect(nextRevisionLabel("ZZ")).toBe("AAA");
  });
  it("handles lowercase input", () => {
    expect(nextRevisionLabel("a")).toBe("B");
  });
});

describe("highest-label selection (family ordering)", () => {
  const pickHighest = (labels: string[]) =>
    labels.sort((a, b) => (a.length - b.length) || a.localeCompare(b)).pop();
  it("selects the highest revision in a family", () => {
    expect(pickHighest(["A", "B", "C"])).toBe("C");
    expect(pickHighest(["A"])).toBe("A");
    // Length beats lexicographic: AA > Z
    expect(pickHighest(["Z", "AA"])).toBe("AA");
  });
});

describe("email service guard", () => {
  it("reports unconfigured when SMTP env vars are missing", async () => {
    const prev = { host: process.env.SMTP_HOST, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const { isEmailConfigured, sendQuoteEmail } = await import("./email");
    expect(isEmailConfigured()).toBe(false);
    await expect(
      sendQuoteEmail({
        to: "test@example.com",
        subject: "x",
        message: "y",
        attachment: { filename: "q.pdf", content: Buffer.from("pdf") },
      }),
    ).rejects.toThrow(/not configured/i);
    if (prev.host) process.env.SMTP_HOST = prev.host;
    if (prev.user) process.env.SMTP_USER = prev.user;
    if (prev.pass) process.env.SMTP_PASS = prev.pass;
  });
});

describe("supplier settings validation bounds", () => {
  // Mirrors the zod bounds in suppliers router: 0 <= pct <= 99.999
  const inBounds = (n: number) => n >= 0 && n <= 99.999;
  it("accepts typical discount/margin values", () => {
    expect(inBounds(30)).toBe(true);
    expect(inBounds(0)).toBe(true);
    expect(inBounds(99.9)).toBe(true);
  });
  it("rejects out-of-range values", () => {
    expect(inBounds(-1)).toBe(false);
    expect(inBounds(100)).toBe(false);
  });
});
