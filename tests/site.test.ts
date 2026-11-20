import { describe, expect, it } from "vitest";
import { services } from "../src/site";

// The agreed price sheet (copied from the old site, 2026-11-20). Change prices in
// src/site.ts and here together.
describe("price sheet", () => {
  it("matches the agreed prices", () => {
    expect(Object.fromEntries(services.map((s) => [s.id, s.price]))).toEqual({
      entry: 295,
      professional: 395,
      management: 495,
      linkedin: 325,
      "cover-letter": 55,
      coaching: 150,
    });
  });
});
