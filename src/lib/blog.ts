import { getCollection } from "astro:content";

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export async function sortedPosts() {
  return (await getCollection("blog")).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const postDate = (d: Date) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
