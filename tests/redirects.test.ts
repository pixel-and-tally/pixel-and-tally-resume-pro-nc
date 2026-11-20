import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every old Wix blog URL must land on a post that exists.
const rules = readFileSync("public/_redirects", "utf8")
  .split("\n")
  .filter((l) => l.startsWith("/"))
  .map((l) => l.trim().split(/\s+/));
const posts = new Set(readdirSync("src/content/blog").map((f) => f.replace(/\.md$/, "")));

describe("redirects", () => {
  it("covers all 40 old blog post URLs", () => {
    expect(rules.filter(([from]) => from.startsWith("/single-post/") && !from.includes("*"))).toHaveLength(40);
  });
  it.each(rules.filter(([, to]) => to.startsWith("/career-tips/") && to.split("/").length === 4))("%s points to a real post", (_from, to) => {
    expect(posts.has(to.split("/")[2])).toBe(true);
  });
  it("points old pages at pages that exist", () => {
    for (const [, to] of rules) {
      const path = to.split("#")[0].replace(/\/$/, "") || "/index";
      if (path.startsWith("/career-tips")) continue;
      expect(existsSync(`src/pages${path}.astro`), to).toBe(true);
    }
  });
});
