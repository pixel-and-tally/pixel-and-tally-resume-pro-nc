import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { blogCategories } from "./site";

const blog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    categories: z.array(z.enum(blogCategories)).min(1),
    /** YouTube video id, for posts that are a video. */
    video: z.string().optional(),
  }),
});

export const collections = { blog };
