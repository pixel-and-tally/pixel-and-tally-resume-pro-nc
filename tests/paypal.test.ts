import { describe, expect, it, vi } from "vitest";
import { finalEmail, orderLink, orderLinkEmail, orderLinkText } from "../src/lib/client-mail";
import { paypalLink } from "../src/lib/order";
import { handleIpn } from "../src/lib/paypal";
import { orderKey, type OrderRecord } from "../src/lib/records";
import { memoryStore } from "../src/lib/store";

const now = new Date("2026-11-20T15:00:00Z");
const mail = { apiKey: "k", to: "nancy@resumepronc.com", from: "site@resumepronc.com" };

function order(): OrderRecord {
  return {
    id: "2026-11-20-abc123", createdAt: now.toISOString(), status: "awaiting-payment", name: "Sam Lee", email: "sam@example.com", phone: "",
    address: { street: "", city: "", state: "", zip: "" }, linkedin: "", careerChange: "", rush: "", lines: [{ name: "Professional Resume", price: 395 }],
    total: 395, answers: {}, jobs: [], postings: [], files: [], notes: "", draftCount: 0, log: [],
  };
}

const ipn = (extra: Record<string, string> = {}) =>
  new URLSearchParams({ payment_status: "Completed", receiver_email: "Nancy@ResumeProNC.com", custom: "2026-11-20-abc123", mc_gross: "395.00", mc_currency: "USD", txn_id: "TX1", ...extra }).toString();

async function run(raw: string, verified = true) {
  const store = memoryStore();
  await store.setJSON(orderKey("2026-11-20-abc123"), order());
  const sendMail = vi.fn().mockResolvedValue(undefined);
  const result = await handleIpn(raw, { store, verify: async () => verified, mail, sendMail, paypalEmail: "nancy@resumepronc.com", draftDays: 12, now });
  return { result, sendMail, o: (await store.getJSON<OrderRecord>(orderKey("2026-11-20-abc123")))!, store };
}

describe("checkout", () => {
  it("sends PayPal the order id and where to report the payment", () => {
    const u = new URL(paypalLink("nancy@resumepronc.com", 395, "Resume", { orderId: "abc", siteUrl: "https://www.resumepronc.com" }));
    expect(u.searchParams.get("custom")).toBe("abc");
    expect(u.searchParams.get("amount")).toBe("395.00");
    expect(u.searchParams.get("notify_url")).toBe("https://www.resumepronc.com/api/paypal-ipn");
    expect(u.searchParams.get("return")).toBe("https://www.resumepronc.com/thanks/?form=paid");
  });
});

describe("PayPal payment notice", () => {
  it("marks the order paid and sends her Received Payment email, once", async () => {
    const { result, sendMail, o, store } = await run(ipn());
    expect(result).toBe("paid");
    expect(o.status).toBe("queued");
    expect(o.dueDate).toBe("2026-12-02");
    expect(sendMail.mock.calls[0][0].subject).toBe("Received Payment");
    expect(sendMail.mock.calls[0][2]).toBe("sam@example.com");
    expect(sendMail.mock.calls[1][0].subject).toBe("Paid: Sam Lee, $395");
    const again = await handleIpn(ipn(), { store, verify: async () => true, mail, sendMail, paypalEmail: "nancy@resumepronc.com", draftDays: 12, now });
    expect(again).toBe("duplicate");
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("ignores fakes, other accounts, pending payments and short amounts", async () => {
    expect((await run(ipn(), false)).result).toBe("unverified");
    expect((await run(ipn({ receiver_email: "someone@else.com" }))).result).toBe("ignored");
    expect((await run(ipn({ payment_status: "Pending" }))).result).toBe("ignored");
    const short = await run(ipn({ mc_gross: "1.00" }));
    expect(short.result).toBe("mismatch");
    expect(short.o.status).toBe("awaiting-payment");
    expect(short.o.log[0].what).toContain("doesn't match");
    expect((await run(ipn({ custom: "nope", invoice: "" }))).result).toBe("not-found");
  });
});

describe("order link and final email", () => {
  it("links to the order page with the suggested level picked", () => {
    expect(orderLink("management")).toBe("https://www.resumepronc.com/order/?resume=management");
    const e = orderLinkEmail(orderLinkText("Sam Lee"), orderLink(), "nancy@resumepronc.com");
    expect(e.text).toContain("Hi Sam,");
    expect(e.html).toContain('<a href="https://www.resumepronc.com/order/">Click here to choose your services and get started</a>');
  });

  it("tucks the Word article behind a short link", () => {
    const e = finalEmail(order(), "n@x.com", "", [], "");
    expect(e.html).toMatch(/<a href="https:\/\/askleo\.com[^"]+">this short article<\/a>/);
  });
});
