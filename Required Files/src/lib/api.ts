import type { ClozeBlank, ClozeResponse, EvaluationResponse, TranscriptResponse } from "@/lib/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `API request failed: ${response.status}`);
  }

  return response.json();
}

export async function uploadAudio(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}/upload-audio`, {
    method: "POST",
    body: form
  });
  if (!response.ok) throw new Error("Audio upload failed");
  return response.json() as Promise<{ audio_id: string; filename: string }>;
}

export function transcribe(audioId?: string) {
  const suffix = audioId ? `?audio_id=${encodeURIComponent(audioId)}` : "";
  return fetch(`${API_URL}/transcribe${suffix}`, { method: "POST" }).then((response) => {
    if (!response.ok) {
      return response.json().catch(() => null).then((detail) => {
        throw new Error(detail?.detail ?? "Transcription failed");
      });
    }
    return response.json() as Promise<TranscriptResponse>;
  });
}

export function generateCloze(transcript: string, maxBlanks = 40) {
  return postJson<ClozeResponse>("/generate-cloze", { transcript, max_blanks: maxBlanks });
}

export function evaluateShadow(expected: string, typed: string) {
  return postJson<EvaluationResponse>("/evaluate-shadow", { expected, typed });
}

export function evaluateCloze(blanks: ClozeBlank[], answers: Record<string, string>) {
  return postJson<EvaluationResponse>("/evaluate-cloze", { blanks, answers });
}
