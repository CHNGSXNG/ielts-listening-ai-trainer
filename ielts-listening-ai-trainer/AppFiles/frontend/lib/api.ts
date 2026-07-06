import { ScoreResult } from "./scoring";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export type TranscribeResponse = {
  transcript: string;
  sentences: { id: string; text: string; start?: number; end?: number; words?: { text: string; start: number; end: number }[] }[];
  sourceName?: string;
  sourceUrl?: string;
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

export async function uploadAudio(file: File) {
  const form = new FormData();
  form.append("file", file);
  return parseJson<{ upload_id: string; filename: string }>(
    await fetch(`${API_BASE}/upload/file`, { method: "POST", body: form })
  );
}

export async function transcribeFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return parseJson<TranscribeResponse>(await fetch(`${API_BASE}/transcribe`, { method: "POST", body: form }));
}

export async function importUrl(url: string) {
  return parseJson<TranscribeResponse>(
    await fetch(`${API_BASE}/upload/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    })
  );
}

export async function evaluateAnswer(reference: string, answer: string) {
  return parseJson<ScoreResult>(
    await fetch(`${API_BASE}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, answer })
    })
  );
}
