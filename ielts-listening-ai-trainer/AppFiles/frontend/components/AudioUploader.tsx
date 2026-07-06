"use client";

import { UploadCloud } from "lucide-react";
import { cacheAudio, fileCacheKey } from "../lib/audioCache";
import { transcribeFile, uploadAudio } from "../lib/api";
import { usePracticeStore } from "../lib/practiceStore";

export default function AudioUploader({
  onStatus,
  onTranscript
}: {
  onStatus: (status: string) => void;
  onTranscript: (transcript: string) => void;
}) {
  const { setCurrentStatus, setSessionFromTranscription } = usePracticeStore();

  async function handleFile(file: File) {
    onStatus("uploading");
    setCurrentStatus("UPLOADING");
    try {
      const cacheKey = fileCacheKey(file);
      try {
        await cacheAudio(cacheKey, file, file.name);
      } catch {
        // Browsers can disable IndexedDB in private or restricted contexts; upload still works without cache.
      }
      await uploadAudio(file);
      setCurrentStatus("TRANSCRIBING");
      const result = await transcribeFile(file);
      setSessionFromTranscription({
        audioSource: { type: "file", name: file.name, cacheKey },
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
      onTranscript(result.transcript);
      onStatus("done");
    } catch (error) {
      setCurrentStatus("IDLE");
      onStatus(error instanceof Error ? error.message : "error");
    }
  }

  return (
    <label className="glass flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dashed border-white/70 p-8 text-center transition hover:bg-white/58">
      <UploadCloud className="mb-4 text-slate-700" size={40} />
      <span className="text-lg font-semibold text-slate-900">Upload listening audio</span>
      <span className="mt-2 text-sm text-slate-600">MP3, WAV, or M4A</span>
      <input
        className="sr-only"
        type="file"
        accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/m4a,.mp3,.wav,.m4a"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </label>
  );
}
