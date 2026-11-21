// Where orders, messages and uploaded files are kept: Workers KV on the live
// site (the STORE binding in wrangler.jsonc, free), and an in-memory store during
// local dev and tests. src/worker.ts hands the binding over on every request and
// on the morning run.

export type StoredFile = { data: ArrayBuffer; type: string; filename: string };

export interface Store {
  getJSON<T>(key: string): Promise<T | null>;
  setJSON(key: string, value: unknown): Promise<void>;
  listKeys(prefix: string): Promise<string[]>;
  getFile(key: string): Promise<StoredFile | null>;
  setFile(key: string, file: StoredFile): Promise<void>;
}

export function memoryStore(): Store {
  const json = new Map<string, string>();
  const files = new Map<string, StoredFile>();
  return {
    async getJSON<T>(key: string) {
      const v = json.get(key);
      return v === undefined ? null : (JSON.parse(v) as T);
    },
    async setJSON(key, value) {
      json.set(key, JSON.stringify(value));
    },
    async listKeys(prefix) {
      return [...json.keys(), ...files.keys()].filter((k) => k.startsWith(prefix));
    },
    async getFile(key) {
      return files.get(key) ?? null;
    },
    async setFile(key, file) {
      files.set(key, file);
    },
  };
}

/** The bits of a Workers KV namespace this store uses. */
export interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  getWithMetadata<M>(key: string, type: "arrayBuffer"): Promise<{ value: ArrayBuffer | null; metadata: M | null }>;
  put(key: string, value: string | ArrayBuffer, options?: { metadata?: unknown }): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export function kvStore(kv: KVNamespace): Store {
  return {
    async getJSON<T>(key: string) {
      const v = await kv.get(key, "text");
      return v === null ? null : (JSON.parse(v) as T);
    },
    async setJSON(key, value) {
      await kv.put(key, JSON.stringify(value));
    },
    async listKeys(prefix) {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await kv.list({ prefix, cursor });
        keys.push(...page.keys.map((k) => k.name));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return keys;
    },
    async getFile(key) {
      const r = await kv.getWithMetadata<{ type?: string; filename?: string }>(key, "arrayBuffer");
      if (!r.value) return null;
      const m = r.metadata ?? {};
      return { data: r.value, type: m.type || "application/octet-stream", filename: m.filename || "file" };
    },
    async setFile(key, file) {
      // KV metadata is capped at 1 KB, so long names are cut.
      await kv.put(key, file.data, { metadata: { type: file.type.slice(0, 100), filename: file.filename.slice(0, 200) } });
    },
  };
}

let binding: KVNamespace | undefined;

/** Called by src/worker.ts with the Worker's STORE binding. */
export function useBinding(kv: KVNamespace | undefined) {
  if (kv && kv !== binding) {
    binding = kv;
    current = kvStore(kv);
  }
}

let current: Store | null = null;

/** The store for this environment. Falls back to memory when there is no KV binding (local dev). */
export function store(): Store {
  if (current) return current;
  console.warn("Store: no KV binding, keeping data in memory (local dev only)");
  current = memoryStore();
  return current;
}

/** For tests. */
export function useStore(s: Store) {
  current = s;
}
