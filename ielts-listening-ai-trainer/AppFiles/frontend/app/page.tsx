"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AudioUploader from "../components/AudioUploader";
import UrlImporter from "../components/UrlImporter";
import { usePracticeStore } from "../lib/practiceStore";

export default function UploadPage() {
  const router = useRouter();
  const { transcriptText, currentStatus, sentences } = usePracticeStore();
  const [status, setStatus] = useState("idle");
  const [transcript, setTranscript] = useState(transcriptText);

  useEffect(() => {
    setTranscript(transcriptText);
  }, [transcriptText]);

  const statusLabel = useMemo(() => {
    if (currentStatus === "UPLOADING") return "uploading";
    if (currentStatus === "TRANSCRIBING") return "transcribing";
    if (sentences.length) return "done";
    return status;
  }, [currentStatus, sentences.length, status]);

  const statusMessage = useMemo(() => {
    if (status === "Local Whisper transcription is unavailable") {
      return "Local Whisper is not installed or not available.";
    }
    if (status === "URL audio could not be downloaded or transcribed") {
      return "URL audio could not be downloaded or transcribed.";
    }
    return statusLabel;
  }, [status, statusLabel]);

  return (
    <div className="glass stage">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Upload</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            IELTS Listening AI Trainer
          </h1>
        </div>
        <AudioUploader onStatus={setStatus} onTranscript={setTranscript} />
        <UrlImporter onStatus={setStatus} onTranscript={setTranscript} />
        </section>

        <section className="soft-card rounded-[28px] p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">Upload status</p>
            <p className="mt-1 break-words text-2xl font-semibold text-slate-900">{statusMessage}</p>
          </div>
          <span
            className={`h-4 w-4 rounded-full ${
              statusLabel === "done" ? "bg-emerald-500" : statusLabel === "uploading" || statusLabel === "transcribing" ? "pulse bg-amber-400" : "bg-slate-300"
            }`}
          />
        </div>

        <div className="min-h-72 rounded-[20px] bg-white/46 p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Transcript preview</h2>
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {transcript || "Processed transcript will appear here after file upload or URL import."}
          </p>
        </div>

        <button
          className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-4 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!sentences.length}
          onClick={() => router.push("/practice")}
        >
          Start practice
        </button>
        </section>
      </div>
    </div>
  );
}
