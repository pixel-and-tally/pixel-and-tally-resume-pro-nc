import { describe, expect, it } from "vitest";
import { createSession, passwordMatches, validSession } from "../src/lib/auth";
import { draftEmail, finalEmail, greeting, inquiryEmail, inquiryText, paidEmail } from "../src/lib/client-mail";
import { parseOrder } from "../src/lib/forms";
import { addBusinessDays, addDays, inView, listOrders, markPaid, orderFromForm, orderKey, saveFile, setStatus, views, type OrderRecord } from "../src/lib/records";
import { memoryStore } from "../src/lib/store";
import { services } from "../src/site";

const now = new Date("2026-11-20T15:00:00Z"); // a Friday

function order(extra: Record<string, string> = {}): OrderRecord {
  const f = new FormData();
  Object.entries({ name: "Sam Lee", email: "sam@example.com", street: "12 Main St", city: "Belmont", state: "NC", zip: "28012", objective: "Ops manager", resumeLevel: "professional", ...extra }).forEach(([k, v]) => f.set(k, v));
  const r = parseOrder(f, services);
  if (!r.ok) throw new Error("expected a valid order");
  return orderFromForm(r.value, "2026-11-20-abc123", now, null);
}

describe("login", () => {
  it("only accepts the right password, and never an empty one", () => {
    expect(passwordMatches("open sesame", "open sesame")).toBe(true);
    expect(passwordMatches("open sesam", "open sesame")).toBe(false);
    expect(passwordMatches("", "")).toBe(false);
  });

  it("signs a session that expires and can't be forged", () => {
    const t = createSession("secret", now.getTime());
    expect(validSession(t, "secret", now.getTime())).toBe(true);
    expect(validSession(t, "other", now.getTime())).toBe(false);
    expect(validSession(t, "secret", now.getTime() + 15 * 86_400_000)).toBe(false);
    expect(validSession(t.replace(/^\d+/, "9999999999999"), "secret", now.getTime())).toBe(false);
    expect(validSession(undefined, "secret")).toBe(false);
  });
});

describe("orders", () => {
  it("keeps job posting links from the questionnaire", () => {
    const o = order({ postings: "https://jobs.example.com/1\n\n  https://jobs.example.com/2  " });
    expect(o.postings).toEqual(["https://jobs.example.com/1", "https://jobs.example.com/2"]);
    expect(o.status).toBe("awaiting-payment");
  });

  it("counts business days for the draft due date", () => {
    expect(addBusinessDays("2026-11-20", 1)).toBe("2026-11-23"); // Fri -> Mon
    expect(addBusinessDays("2026-11-20", 7)).toBe("2026-12-01");
  });

  it("puts a paid order on the schedule with a due date", () => {
    expect(addDays("2026-11-20", 12)).toBe("2026-12-02");
    const o = markPaid(order(), now, 7);
    expect(o.status).toBe("queued");
    expect(o.dueDate).toBe("2026-12-01");
    expect(o.log.at(-1)?.what).toContain("Payment received");
  });

  it("sorts each tab", () => {
    const a = markPaid(order(), now, 7);
    const b = { ...markPaid(order(), now, 7), id: "b", dueDate: "2026-11-25" };
    const c = setStatus(order(), "delivered", now);
    const queued = views.find((v) => v.id === "queued")!;
    expect(inView([a, b, c], queued).map((o) => o.dueDate)).toEqual(["2026-11-25", "2026-12-01"]);
    expect(inView([a, b, c], views.find((v) => v.id === "past")!)).toHaveLength(1);
    expect(c.deliveredAt).toBeTruthy();
  });

  it("stores orders and files", async () => {
    const s = memoryStore();
    const o = order();
    const ref = await saveFile(s, o.id, new File(["hi"], "My Résumé.docx"), "Their current resume", now);
    o.files.push(ref);
    await s.setJSON(orderKey(o.id), o);
    expect((await listOrders(s))[0].files[0].filename).toBe("My R_sum_.docx");
    expect(new TextDecoder().decode((await s.getFile(ref.key))!.data)).toBe("hi");
  });
});

describe("client emails (Nancy's wording)", () => {
  const o = markPaid(order(), now, 12);
  const nancy = "nancy@resumepronc.com";
  const all = [
    paidEmail(o, nancy),
    draftEmail(o, nancy, "", [{ filename: "Sam Lee Resume.pdf", content: "" }], 1, now),
    finalEmail(o, nancy, "", [], "https://g.page/r/review"),
    inquiryEmail(inquiryText("Sam Lee", now), nancy),
  ];

  it("greets by time of day, Eastern", () => {
    expect(greeting(new Date("2026-11-20T14:00:00Z"))).toBe("Good morning"); // 9 AM
    expect(greeting(new Date("2026-11-20T19:00:00Z"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-11-20T23:30:00Z"))).toBe("Good evening");
  });

  it("uses her payment, draft and inquiry wording", () => {
    expect(all[0].subject).toBe("Received Payment");
    expect(all[0].text).toContain("you have been added to my writing schedule");
    expect(all[1].text).toContain("Good morning Sam,");
    expect(all[1].text).toContain("resume draft in PDF format");
    expect(all[3].text).toContain("$495 for individuals with management experience and $395");
    expect(all[3].text).toContain("approximately 5 to 7 business days");
  });

  it("explains Word versus PDF and asks for a review with the finals", () => {
    expect(all[2].text).toContain("submit your resume as a Microsoft Word file");
    expect(all[2].html).toContain('<a href="https://g.page/r/review">Click here for a direct link to leave a review</a>');
    expect(finalEmail(o, nancy, "", [], "").text).not.toContain("leave a review");
  });

  it("sign off with her signature, reply to Nancy, and use no em dashes", () => {
    for (const e of all) {
      expect(e.replyTo).toBe(nancy);
      expect(e.text).toContain("Nancy Turner\nResume Pro NC - Professional Resume Service\n704-998-1088\n864-735-7123\nresumepronc.com");
      expect(e.text + e.html).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
