// Where orders, messages and uploaded files are kept: Netlify Blobs on the live
// site (free, built into Netlify), and an in-memory store during local dev and tests.
import { getStore } from "@netlify/blobs";

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

function blobStore(): Store {
  const s = getStore({ name: "resume-pro-nc", consistency: "strong" });
  return {
    async getJSON<T>(key: string) {
      return ((await s.get(key, { type: "json" })) as T | null) ?? null;
    },
    async setJSON(key, value) {
      await s.setJSON(key, value);
    },
    async listKeys(prefix) {
      const { blobs } = await s.list({ prefix });
      return blobs.map((b) => b.key);
    },
    async getFile(key) {
      const r = await s.getWithMetadata(key, { type: "arrayBuffer" });
      if (!r) return null;
      const m = r.metadata as { type?: string; filename?: string };
      return { data: r.data, type: m.type || "application/octet-stream", filename: m.filename || "file" };
    },
    async setFile(key, file) {
      await s.set(key, file.data, { metadata: { type: file.type, filename: file.filename } });
    },
  };
}

let current: Store | null = null;

/** The store for this environment. Falls back to memory when Netlify Blobs isn't available (local dev). */
export function store(): Store {
  if (current) return current;
  try {
    current = blobStore();
  } catch {
    console.warn("Store: Netlify Blobs not available, keeping data in memory (local dev only)");
    current = memoryStore();
  }
  return current;
}

/** For tests. */
export function useStore(s: Store) {
  current = s;
}
