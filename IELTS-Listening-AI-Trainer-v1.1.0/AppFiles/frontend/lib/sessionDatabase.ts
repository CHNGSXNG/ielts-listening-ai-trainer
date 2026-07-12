import type { TrainerSession } from "./sessionStore";

const databaseName = "ielts-listening-trainer";
const sessionsStore = "sessions";
const metadataStore = "metadata";
const backupsStore = "backups";
const currentSessionKey = "current-session";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(sessionsStore)) database.createObjectStore(sessionsStore, { keyPath: "id" });
      if (!database.objectStoreNames.contains(metadataStore)) database.createObjectStore(metadataStore, { keyPath: "key" });
      if (!database.objectStoreNames.contains(backupsStore)) database.createObjectStore(backupsStore, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSessionRecord(session: TrainerSession) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([sessionsStore, metadataStore], "readwrite");
    transaction.objectStore(sessionsStore).put(session);
    transaction.objectStore(metadataStore).put({ key: currentSessionKey, sessionId: session.id });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadCurrentSessionRecord(): Promise<TrainerSession | null> {
  const database = await openDatabase();
  const session = await new Promise<TrainerSession | null>((resolve, reject) => {
    const transaction = database.transaction([sessionsStore, metadataStore], "readonly");
    const metadataRequest = transaction.objectStore(metadataStore).get(currentSessionKey);
    metadataRequest.onerror = () => reject(metadataRequest.error);
    metadataRequest.onsuccess = () => {
      const sessionId = metadataRequest.result?.sessionId;
      if (!sessionId) {
        resolve(null);
        return;
      }
      const sessionRequest = transaction.objectStore(sessionsStore).get(sessionId);
      sessionRequest.onsuccess = () => resolve(sessionRequest.result ?? null);
      sessionRequest.onerror = () => reject(sessionRequest.error);
    };
  });
  database.close();
  return session;
}

export async function listSessionRecords(): Promise<TrainerSession[]> {
  const database = await openDatabase();
  const sessions = await new Promise<TrainerSession[]>((resolve, reject) => {
    const request = database.transaction(sessionsStore, "readonly").objectStore(sessionsStore).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return sessions;
}

export async function clearSessionRecords() {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([sessionsStore, metadataStore], "readwrite");
    transaction.objectStore(sessionsStore).clear();
    transaction.objectStore(metadataStore).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function deleteSessionRecords(sessionIds: string[]) {
  if (!sessionIds.length) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([sessionsStore, metadataStore], "readwrite");
    sessionIds.forEach((sessionId) => transaction.objectStore(sessionsStore).delete(sessionId));
    const metadataRequest = transaction.objectStore(metadataStore).get(currentSessionKey);
    metadataRequest.onsuccess = () => {
      if (sessionIds.includes(metadataRequest.result?.sessionId)) transaction.objectStore(metadataStore).delete(currentSessionKey);
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function sessionRecordsUsage() {
  const sessions = await listSessionRecords();
  return {
    count: sessions.length,
    bytes: new Blob([JSON.stringify(sessions)]).size,
    sessions
  };
}

export type LocalBackupRecord = {
  id: string;
  type: "manual" | "automatic";
  createdAt: string;
  payload: unknown;
};

export async function saveLocalBackupRecord(record: LocalBackupRecord) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(backupsStore, "readwrite");
    transaction.objectStore(backupsStore).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function listLocalBackupRecords(): Promise<LocalBackupRecord[]> {
  const database = await openDatabase();
  const records = await new Promise<LocalBackupRecord[]>((resolve, reject) => {
    const request = database.transaction(backupsStore, "readonly").objectStore(backupsStore).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return records.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

export async function saveAutomaticSessionSnapshot(session: TrainerSession, retention: number) {
  const existing = (await listLocalBackupRecords()).filter((record) => record.type === "automatic");
  const record: LocalBackupRecord = { id: `auto-${Date.now()}`, type: "automatic", createdAt: new Date().toISOString(), payload: session };
  const obsolete = [...existing, record].slice(0, Math.max(0, existing.length + 1 - retention));
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(backupsStore, "readwrite");
    const store = transaction.objectStore(backupsStore);
    store.put(record);
    obsolete.forEach((item) => item.id !== record.id && store.delete(item.id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadLatestManualBackup() {
  const records = (await listLocalBackupRecords()).filter((record) => record.type === "manual");
  return records.at(-1) ?? null;
}

export async function clearLocalBackupRecords() {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(backupsStore, "readwrite");
    transaction.objectStore(backupsStore).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function localBackupRecordsUsage() {
  const records = await listLocalBackupRecords();
  return { count: records.length, bytes: new Blob([JSON.stringify(records)]).size };
}
