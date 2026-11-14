const memory = new Map();

/** JSON storage that stays usable in private/restricted browser contexts. */
export function createStorage(storage = undefined) {
  let persistent = true;
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    if (!storage) persistent = false;
    else {
      const key = 'error404.storage-check';
      storage.setItem(key, '1');
      storage.removeItem(key);
    }
  } catch { persistent = false; }
  return {
    get persistent() { return persistent; },
    read(key, fallback = null) {
      try {
        const raw = persistent ? storage.getItem(key) : memory.get(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    write(key, value) {
      const raw = JSON.stringify(value);
      memory.set(key, raw);
      if (persistent) {
        try { storage.setItem(key, raw); }
        catch { persistent = false; }
      }
      return persistent;
    },
    remove(key) {
      memory.delete(key);
      if (persistent) {
        try { storage.removeItem(key); } catch { persistent = false; }
      }
    },
  };
}

export const localStorageService = createStorage();
