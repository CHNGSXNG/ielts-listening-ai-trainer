"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { importUrl } from "../lib/api";
import { urlCacheKey } from "../lib/audioCache";
import { usePracticeStore } from "../lib/practiceStore";

export default function UrlImporter({
  onStatus,
  onTranscript
}: {
  onStatus: (status: string) => void;
  onTranscript: (transcript: string) => void;
}) {
  const [url, setUrl] = useState("");
  const { session, setCurrentStatus, setSessionFromTranscription } = usePracticeStore();

  async function submit() {
    if (!url.trim()) return;
    onStatus("uploading");
    setCurrentStatus("UPLOADING");
    try {
      const cacheKey = urlCacheKey(url);
      if (session.sourceUrl === url.trim() && session.transcript) {
        onTranscript(session.transcript);
        onStatus("done");
        setCurrentStatus("READY");
        return;
      }
      setCurrentStatus("TRANSCRIBING");
      const result = await importUrl(url.trim());
      setSessionFromTranscription({
        audioSource: { type: "url", name: result.sourceName ?? "Imported URL", url: url.trim(), cacheKey },
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
      onTranscript(result.transcript);
      onStatus("done");
    } catch (error) {
      setCurrentStatus("IDLE");
      onStatus(error instanceof Error ? error.message : "error");
    }
  }

  return (
    <div className="glass rounded-[20px] p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Link2 size={18} />
        Import from URL
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="control min-h-12 flex-1 rounded-2xl px-4 text-sm"
          placeholder="https://example.com/listening-audio.mp3"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <button
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
          onClick={submit}
          disabled={!url.trim()}
        >
          Import
        </button>
      </div>
    </div>
  );
}
