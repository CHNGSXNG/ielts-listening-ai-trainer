const dbName = "ielts-audio-cache";
const storeName = "audio";

type CacheEntry = {
  key: string;
  blob: Blob;
  name: string;
  type: string;
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheAudio(key: string, blob: Blob, name: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put({ key, blob, name, type: blob.type, createdAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedAudio(key: string): Promise<CacheEntry | null> {
  const db = await openDb();
  const entry = await new Promise<CacheEntry | null>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return entry;
}

export async function hasCachedAudio(key: string) {
  return Boolean(await getCachedAudio(key));
}

export async function audioCacheSize() {
  const db = await openDb();
  const entries = await new Promise<CacheEntry[]>((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return entries.reduce((sum, entry) => sum + entry.blob.size, 0);
}

export async function clearAudioCache() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function fileCacheKey(file: File) {
  const sampleSize = 1024 * 1024;
  const first = file.slice(0, sampleSize);
  const last = file.size > sampleSize ? file.slice(Math.max(0, file.size - sampleSize)) : new Blob();
  const sample = await new Blob([first, last]).arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", sample);
  const hash = Array.from(new Uint8Array(digest)).slice(0, 12).map((value) => value.toString(16).padStart(2, "0")).join("");
  return `file:${file.size}:${hash}`;
}

export function urlCacheKey(url: string) {
  const parsed = new URL(url.trim());
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  return `url:${parsed.toString()}`;
}

export function objectUrlFromBlob(blob: Blob) {
  return URL.createObjectURL(blob);
}
