import type { APIRoute } from "astro";
import { isAdmin } from "../../../lib/admin";
import { store } from "../../../lib/store";

export const prerender = false;

// Downloads a stored file (a client's resume, a draft, the finals). Nancy only.
export const GET: APIRoute = async ({ params, cookies, redirect }) => {
  if (!isAdmin(cookies)) return redirect("/admin/login/");
  const key = `file/${params.key ?? ""}`;
  const f = await store().getFile(key);
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(f.data, {
    headers: {
      "Content-Type": f.type,
      "Content-Disposition": `attachment; filename="${f.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
};
