"use client";

import { type DragEvent, useState } from "react";
import { LoaderCircle, UploadCloud } from "lucide-react";
import { cacheAudio, fileCacheKey } from "../lib/audioCache";
import { transcribeFile } from "../lib/api";
import { usePracticeStore } from "../lib/practiceStore";
import { emptySession } from "../lib/sessionStore";
import { useI18n } from "../lib/i18n";

export default function AudioUploader({
  onStatus,
  disabled = false
}: {
  onStatus: (status: string) => void;
  disabled?: boolean;
}) {
  const { beginTranscription, setCurrentStatus, setPipelineError, setSessionFromTranscription } = usePracticeStore();
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (disabled) return;
    if (file.size === 0) {
      onStatus(t("The selected audio file is empty."));
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      onStatus(t("The selected audio file is larger than 500 MB."));
      return;
    }
    if (!/\.(mp3|wav|m4a|mp4|aac|aiff|flac|ogg)$/i.test(file.name)) {
      onStatus(t("Unsupported audio format. Choose MP3, WAV, M4A, AAC, AIFF, FLAC, or OGG."));
      return;
    }
    onStatus("uploading");
    setCurrentStatus("UPLOADING");
    try {
      const cacheKey = await fileCacheKey(file);
      try {
        await cacheAudio(cacheKey, file, file.name);
      } catch {
        // Browsers can disable IndexedDB in private or restricted contexts; upload still works without cache.
      }
      beginTranscription({ type: "file", name: file.name, cacheKey });
      const result = await transcribeFile(file);
      setSessionFromTranscription({
        ...emptySession(),
        audioSource: { type: "file", name: file.name, cacheKey },
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
        sourceName: file.name,
        audioCacheKey: cacheKey,
        answers: [],
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        studySeconds: 0
      });
      onStatus("done");
    } catch (error) {
      const message = error instanceof Error ? t(error.message) : t("Audio transcription failed");
      setPipelineError(message);
      onStatus(message);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div
      className={`glass flex min-h-60 flex-col items-center justify-center rounded-[20px] border border-dashed p-8 text-center transition ${
        dragging ? "border-indigo-400 bg-white/75" : "border-white/70"
      } ${disabled ? "cursor-wait opacity-65" : "hover:bg-white/58"}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      aria-busy={disabled}
    >
      {disabled ? <LoaderCircle className="mb-4 animate-spin text-slate-700" size={38} /> : <UploadCloud className="mb-4 text-slate-700" size={38} />}
      <span className="text-lg font-semibold text-slate-900">{disabled ? t("Processing audio") : dragging ? t("Drop audio here") : t("Upload listening audio")}</span>
      <span className="mt-2 text-sm text-slate-600">MP3, WAV, M4A, AAC, AIFF, FLAC, or OGG</span>
      <label className={`mt-5 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
        {t("Choose file")}
        <input
          className="sr-only"
          type="file"
          disabled={disabled}
          accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/aiff,audio/flac,audio/ogg,.mp3,.wav,.m4a,.mp4,.aac,.aiff,.flac,.ogg"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file).finally(() => {
              event.target.value = "";
            });
          }}
        />
      </label>
    </div>
  );
}
