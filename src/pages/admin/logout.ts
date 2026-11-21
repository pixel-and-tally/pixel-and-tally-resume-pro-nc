import type { APIRoute } from "astro";
import { sessionCookie } from "../../lib/auth";

export const prerender = false;

export const POST: APIRoute = ({ cookies, redirect }) => {
  cookies.delete(sessionCookie, { path: "/" });
  return redirect("/admin/login/", 303);
};
