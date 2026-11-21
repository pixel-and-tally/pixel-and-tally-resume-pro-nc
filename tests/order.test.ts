import { describe, expect, it } from "vitest";
import { paypalLink, priceOrder } from "../src/lib/order";
import { services } from "../src/site";

describe("priceOrder", () => {
  it("adds a resume and add-ons", () => {
    const p = priceOrder({ resume: "professional", addons: ["linkedin", "cover-letter"] }, services);
    expect(p.total).toBe(395 + 325 + 55);
    expect(p.problems).toEqual([]);
  });

  it("allows add-ons on their own, except a cover letter", () => {
    expect(priceOrder({ resume: "", addons: ["coaching"] }, services)).toMatchObject({ total: 150, problems: [] });
    expect(priceOrder({ resume: "", addons: ["cover-letter"] }, services).problems).toContain("cover-letter-needs-resume");
  });

  it("flags an empty order and ignores unknown or duplicate ids", () => {
    expect(priceOrder({ resume: "", addons: [] }, services).problems).toContain("empty");
    expect(priceOrder({ resume: "nope", addons: ["linkedin", "linkedin", "x"] }, services).total).toBe(325);
  });
});

describe("paypalLink", () => {
  it("is empty without an account", () => {
    expect(paypalLink("", 300, "x")).toBe("");
  });
  it("carries the exact total", () => {
    const url = new URL(paypalLink("pay@example.com", 450, "Resume"));
    expect(url.searchParams.get("amount")).toBe("450.00");
    expect(url.searchParams.get("business")).toBe("pay@example.com");
  });
});
