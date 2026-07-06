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

export function fileCacheKey(file: File) {
  return `file:${file.name}:${file.size}:${file.lastModified}`;
}

export function urlCacheKey(url: string) {
  return `url:${url.trim()}`;
}

export function objectUrlFromBlob(blob: Blob) {
  return URL.createObjectURL(blob);
}
