// Shared behavior for every form on the site: inline errors, focus on the first
// bad field, a form-level message, and sending in place with fetch. Without
// JavaScript the browser's own validation runs and the endpoint redirects.

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export type FormOptions = {
  /** Extra checks: return the ids of bad fields (a group's id works too). */
  extraChecks?: () => string[];
  /** Where to go after a successful send. */
  successUrl: (data: FormData) => string;
  failMessage: string;
};

const errorEl = (id: string) => document.getElementById(`${id}-error`);

export function wireForm(form: HTMLFormElement, opts: FormOptions) {
  const summary = form.querySelector<HTMLElement>("[data-form-error]")!;
  const button = form.querySelector<HTMLButtonElement>("[type=submit]")!;
  const controls = () => Array.from(form.querySelectorAll<Control>("input[data-error], select[data-error], textarea[data-error]")).filter((c) => !c.disabled);

  const setError = (id: string, message: string) => {
    const el = errorEl(id);
    const target = document.getElementById(id);
    if (el) {
      el.textContent = message;
      el.hidden = !message;
    }
    if (target && "setAttribute" in target) {
      if (message) target.setAttribute("aria-invalid", "true");
      else target.removeAttribute("aria-invalid");
    }
  };

  const messageFor = (id: string) => document.getElementById(id)?.dataset.error ?? "Please check this.";

  const fileProblem = (c: Control) => {
    if (!(c instanceof HTMLInputElement) || c.type !== "file" || !c.files?.length) return false;
    const f = c.files[0];
    const max = Number(c.dataset.maxBytes ?? Infinity);
    const accept = (c.accept || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return f.size > max || (accept.length > 0 && !accept.some((ext) => f.name.toLowerCase().endsWith(ext)));
  };

  const check = (c: Control) => {
    const bad = !c.checkValidity() || fileProblem(c);
    setError(c.id, bad ? messageFor(c.id) : "");
    return !bad;
  };

  controls().forEach((c) => {
    c.addEventListener("blur", () => c.value && check(c));
    c.addEventListener("input", () => c.getAttribute("aria-invalid") && check(c));
    c.addEventListener("change", () => c.getAttribute("aria-invalid") && check(c));
  });

  const showSummary = (count: number) => {
    summary.textContent =
      count === 1 ? "One thing needs a fix before this can send. It's marked below." : `${count} things need a fix before this can send. They're marked below.`;
    summary.hidden = false;
  };

  const focusFirst = (ids: string[]) => {
    const order = Array.from(form.querySelectorAll<HTMLElement>("[id]")).map((e) => e.id);
    const first = ids.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
    const el = document.getElementById(first);
    const focusable = el?.matches("input,select,textarea,button,[tabindex]") ? el : el?.querySelector<HTMLElement>("input,select,textarea,button");
    focusable?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const fail = (ids: string[]) => {
    ids.forEach((id) => setError(id, messageFor(id)));
    showSummary(ids.length);
    focusFirst(ids);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    summary.hidden = true;
    const bad = [...controls().filter((c) => !check(c)).map((c) => c.id), ...(opts.extraChecks?.() ?? [])];
    if (bad.length) return fail([...new Set(bad)]);

    button.disabled = true;
    const label = button.textContent;
    button.textContent = "Sending...";
    try {
      const data = new FormData(form);
      const res = await fetch(form.action, { method: "POST", body: data, headers: { Accept: "application/json" } });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; invalid?: string[] };
      if (res.ok && body.ok) {
        location.href = opts.successUrl(data);
        return;
      }
      if (body.invalid?.length) fail(body.invalid);
      else {
        summary.textContent = opts.failMessage;
        summary.hidden = false;
        summary.focus();
      }
    } catch {
      summary.textContent = opts.failMessage;
      summary.hidden = false;
      summary.focus();
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });

  return { setError };
}
