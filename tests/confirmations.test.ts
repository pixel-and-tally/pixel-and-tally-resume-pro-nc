import { describe, expect, it } from "vitest";
import { callIcsUrl, validCallLink } from "../src/lib/call-link";
import { contactReceived, reviewReceived } from "../src/lib/client-mail";

describe("phone calendar link", () => {
  it("is signed, and a changed time is refused", () => {
    const url = new URL(callIcsUrl("https://resume-pro-nc.example.workers.dev", "abc", "2026-11-24", "10:00", "secret"));
    expect(url.pathname).toBe("/api/call.ics");
    const s = url.searchParams.get("s")!;
    expect(validCallLink("abc", "2026-11-24", "10:00", s, "secret")).toBe(true);
    expect(validCallLink("abc", "2026-11-24", "11:00", s, "secret")).toBe(false);
    expect(validCallLink("abc", "2026-11-24", "10:00", s, "other")).toBe(false);
  });
  it("is left out without a secret", () => expect(callIcsUrl("https://x", "abc", "2026-11-24", "10:00", "")).toBe(""));
});

describe("visitor confirmations", () => {
  it("says a call isn't confirmed yet, and replies go to Nancy", () => {
    const e = contactReceived("Sam Lee", "Tuesday, November 24 at 10 AM Eastern", "nancy@example.com");
    expect(e.replyTo).toBe("nancy@example.com");
    expect(e.text).toContain("Hi Sam,");
    expect(e.text).toContain("not confirmed yet");
  });
  it("confirms a plain message and a free review", () => {
    expect(contactReceived("Sam", "", "n@x.com").subject).toBe("I received your message");
    expect(reviewReceived("Sam", "n@x.com").text).toContain("free review");
  });
});
