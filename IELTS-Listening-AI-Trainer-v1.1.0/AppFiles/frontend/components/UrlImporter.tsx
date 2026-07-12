"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { fetchImportedAudio, importUrl } from "../lib/api";
import { cacheAudio, urlCacheKey } from "../lib/audioCache";
import { usePracticeStore } from "../lib/practiceStore";
import { emptySession } from "../lib/sessionStore";
import { useI18n } from "../lib/i18n";

export default function UrlImporter({
  onStatus,
  disabled = false
}: {
  onStatus: (status: string) => void;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState("");
  const { t } = useI18n();
  const { beginTranscription, session, setCurrentStatus, setPipelineError, setSessionFromTranscription } = usePracticeStore();

  async function submit() {
    if (!url.trim() || disabled) return;
    try {
      const parsed = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      onStatus(t("Enter a valid public HTTP or HTTPS audio URL."));
      return;
    }
    onStatus("uploading");
    setCurrentStatus("UPLOADING");
    try {
      const cacheKey = urlCacheKey(url);
      if (session.audioCacheKey === cacheKey && session.transcript) {
        onStatus("done");
        setCurrentStatus("READY");
        return;
      }
      beginTranscription({ type: "url", name: new URL(url.trim()).pathname.split("/").pop() || "Imported URL", url: url.trim(), cacheKey });
      const result = await importUrl(url.trim());
      if (result.audioId) {
        try {
          const audioBlob = await fetchImportedAudio(result.audioId);
          await cacheAudio(cacheKey, audioBlob, result.sourceName ?? "Imported URL");
        } catch {
          // The original URL remains usable if browser storage is unavailable.
        }
      }
      setSessionFromTranscription({
        ...emptySession(),
        audioSource: { type: "url", name: result.sourceName ?? "Imported URL", url: url.trim(), cacheKey },
        audioMetadata: result.audio ?? {},
        transcriptionDiagnostics: {
          status: "ready",
          modelName: result.transcription?.modelName,
          language: result.transcription?.language
        },
        alignmentDiagnostics: {
          status: result.alignment?.status ?? "unavailable",
          engine: result.alignment?.engine,
          wordCount: result.alignment?.wordCount
        },
        transcript: result.transcript,
        sentences: result.sentences,
        questions: [],
        correctAnswers: [],
        currentSentenceIndex: 0,
        status: "READY",
        practiceMode: "shadowing",
        score: 0,
        sourceName: result.sourceName ?? "Imported URL",
        sourceUrl: url.trim(),
        audioCacheKey: cacheKey,
        answers: [],
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        studySeconds: 0
      });
      onStatus("done");
    } catch (error) {
      const message = error instanceof Error ? t(error.message) : t("URL audio could not be downloaded or transcribed");
      setPipelineError(message);
      onStatus(message);
    }
  }

  return (
    <form
      className="glass rounded-[20px] p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      aria-busy={disabled}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Link2 size={18} />
        {t("Import from URL")}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="control min-h-12 flex-1 rounded-2xl px-4 text-sm"
          placeholder="https://example.com/listening-audio.mp3"
          value={url}
          disabled={disabled}
          onChange={(event) => setUrl(event.target.value)}
        />
        <button
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
          type="submit"
          disabled={disabled || !url.trim()}
        >
          {disabled ? t("Processing...") : t("Import")}
        </button>
      </div>
    </form>
  );
}
