const DB_NAME = "avisor-flight-v1";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv");
      }
      if (!db.objectStoreNames.contains("events")) {
        db.createObjectStore("events", { autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save flight plan / app state JSON — works with zero network. */
export async function saveFlightSnapshot(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const payload = JSON.stringify({ savedAt: new Date().toISOString(), data: value });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("kv").put(payload, key);
  });
}

export async function loadFlightSnapshot<T>(key: string): Promise<{ savedAt: string; data: T } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly");
    const q = tx.objectStore("kv").get(key);
    q.onsuccess = () => {
      const raw = q.result as string | undefined;
      if (raw == null) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as { savedAt: string; data: T };
        resolve(parsed);
      } catch {
        resolve(null);
      }
    };
    q.onerror = () => reject(q.error);
  });
}

/** Append-only log for manual in-flight updates (ATIS, runway, etc.). */
export async function appendFlightEvent(entry: Record<string, unknown>): Promise<void> {
  const db = await openDb();
  const row = { at: new Date().toISOString(), ...entry };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("events").add(row);
  });
}

export async function loadRecentEvents(max = 50): Promise<unknown[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const store = tx.objectStore("events");
    const out: unknown[] = [];
    const req = store.openCursor(null, "prev");
    req.onsuccess = () => {
      const c = req.result;
      if (!c || out.length >= max) {
        resolve(out);
        return;
      }
      out.push(c.value);
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}
