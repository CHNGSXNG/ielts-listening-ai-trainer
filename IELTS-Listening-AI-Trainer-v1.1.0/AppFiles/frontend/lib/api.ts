import { ScoreResult } from "./scoring";
import { loadUserPreferences } from "./userPreferences";

const CONFIGURED_API_BASE = process.env.NEXT_PUBLIC_API_BASE;
let runtimeApiBasePromise: Promise<string> | null = null;
const LONG_REQUEST_MS = 30 * 60 * 1000;
const diagnosticsKey = "ielts-diagnostic-errors-v1";

function recordDiagnosticError(path: string, message: string) {
  try {
    if (!loadUserPreferences().privacy.diagnosticLogs) return;
    const current = JSON.parse(window.localStorage.getItem(diagnosticsKey) || "[]") as Array<{ at: string; path: string; message: string }>;
    window.localStorage.setItem(diagnosticsKey, JSON.stringify([...current, { at: new Date().toISOString(), path, message }].slice(-20)));
  } catch {
    // Diagnostics must never interrupt the requested operation.
  }
}

async function runtimeApiBase() {
  if (CONFIGURED_API_BASE) return CONFIGURED_API_BASE;
  if (!runtimeApiBasePromise) {
    runtimeApiBasePromise = fetch("/runtime-config.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Runtime config unavailable");
        const value = await response.json() as { apiBase?: string };
        if (!value.apiBase) throw new Error("Runtime API address missing");
        return value.apiBase;
      })
      .catch(() => `${window.location.protocol}//${window.location.hostname}:8000`);
  }
  return runtimeApiBasePromise;
}

export type TranscribeResponse = {
  transcript: string;
  sentences: {
    id: string;
    text: string;
    start?: number;
    end?: number;
    words?: { id?: string; text: string; start: number; end: number; confidence?: number }[];
  }[];
  sourceName?: string;
  sourceUrl?: string;
  audio?: { duration?: number; codec?: string; sampleRate?: number; mimeType?: string; size?: number };
  transcription?: { status: "ready"; modelName?: string; language?: string };
  alignment?: { status: "ready" | "unavailable"; engine?: string; wordCount?: number };
  audioId?: string;
};

export type BackendHealth = {
  status: string;
  engine?: string;
  modelName?: string;
  modelAvailable?: boolean;
  alignmentEngine?: string;
  modelSize?: number;
  pythonVersion?: string;
};

export type SystemStatus = {
  backendVersion: string;
  platform: string;
  architecture: string;
  ports: { backend: number; frontend: number };
  audioCache: { files: number; bytes: number };
  models: Array<{ name: "tiny" | "base" | "small" | "medium"; installed: boolean; size: number; selected: boolean }>;
  engine: BackendHealth;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { detail?: unknown };
      if (typeof parsed.detail === "string") message = parsed.detail;
    } catch {
      message = raw;
    }
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json();
}

async function apiFetch(path: string, init?: RequestInit, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const apiBase = await runtimeApiBase();
    return await fetch(`${apiBase}${path}`, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      recordDiagnosticError(path, "Request timed out");
      throw new Error("The local service took too long to respond. Try a shorter audio file or a smaller Whisper model.");
    }
    recordDiagnosticError(path, error instanceof Error ? error.message : "Connection failed");
    throw new Error("The local service is not reachable. Keep the command window open, then try again.");
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function checkBackend() {
  try {
    const response = await apiFetch("/health", { cache: "no-store" }, 3_000);
    return response.ok;
  } catch {
    return false;
  }
}

export async function getBackendHealth() {
  return parseJson<BackendHealth>(await apiFetch("/health", { cache: "no-store" }, 3_000));
}

export async function uploadAudio(file: File) {
  const form = new FormData();
  form.append("file", file);
  return parseJson<{ upload_id: string; filename: string }>(
    await apiFetch("/upload/file", { method: "POST", body: form }, LONG_REQUEST_MS)
  );
}

export async function transcribeFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return parseJson<TranscribeResponse>(await apiFetch("/transcribe", { method: "POST", body: form }, LONG_REQUEST_MS));
}

export async function importUrl(url: string) {
  return parseJson<TranscribeResponse>(
    await apiFetch("/upload/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    }, LONG_REQUEST_MS)
  );
}

export async function fetchImportedAudio(audioId: string) {
  const response = await apiFetch(`/upload/audio/${encodeURIComponent(audioId)}`, undefined, LONG_REQUEST_MS);
  if (!response.ok) throw new Error("Cached URL audio could not be loaded");
  return response.blob();
}

export async function evaluateAnswer(reference: string, answer: string) {
  const preferences = loadUserPreferences();
  return parseJson<ScoreResult>(
    await apiFetch("/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference,
        answer,
        options: {
          strictness: preferences.cloze.strictness,
          caseSensitive: preferences.cloze.caseSensitive,
          strictPlural: preferences.cloze.strictPlural,
          strictPunctuation: preferences.cloze.strictPunctuation,
          spellingTolerance: preferences.cloze.spellingTolerance,
          contractionsEquivalent: preferences.cloze.contractionsEquivalent
        }
      })
    })
  );
}

export async function getSystemStatus() {
  return parseJson<SystemStatus>(await apiFetch("/system/status", { cache: "no-store" }, 5_000));
}

export async function downloadModel(modelName: string) {
  return parseJson<{ name: string; installed: boolean; size: number }>(await apiFetch(`/system/models/${modelName}/download`, { method: "POST" }, LONG_REQUEST_MS));
}

export async function selectModel(modelName: string) {
  return parseJson<BackendHealth>(await apiFetch(`/system/models/${modelName}/select`, { method: "POST" }, 10_000));
}

export async function verifyModel(modelName: string) {
  return parseJson<{ name: string; valid: boolean }>(await apiFetch(`/system/models/${modelName}/verify`, { method: "POST" }, 30_000));
}

export async function deleteModel(modelName: string) {
  return parseJson<{ name: string; deleted: boolean }>(await apiFetch(`/system/models/${modelName}`, { method: "DELETE" }, 30_000));
}

export async function clearServerAudioCache() {
  return parseJson<{ clearedFiles: number; clearedBytes: number }>(await apiFetch("/system/audio-cache", { method: "DELETE" }, 30_000));
}
