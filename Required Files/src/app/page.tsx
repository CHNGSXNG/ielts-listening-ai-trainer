"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Cloud, FileAudio, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useTrainer } from "@/lib/store";
import { API_URL, transcribe, uploadAudio } from "@/lib/api";

export default function HomePage() {
  const { setAudio, setTranscript, setCloze, setLastResult } = useTrainer();
  const [status, setStatus] = useState("Ready for an IELTS listening file");
  const [busy, setBusy] = useState(false);

  async function handleFile(file?: File) {
    setBusy(true);
    setStatus("Uploading and preparing transcript...");
    setLastResult(undefined);
    setCloze(undefined);
      try {
      let audioId: string | undefined;
      if (file) {
        const upload = await uploadAudio(file);
        audioId = upload.audio_id;
        setAudio(file.name, `${API_URL}/uploads/${upload.audio_id}`);
      }
      const result = await transcribe(audioId);
      setTranscript(result);
      setStatus(`Transcript ready: ${result.sentences.length} sentence segments created.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Transcription failed: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Upload</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">IELTS listening workspace</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Upload an audio file, generate a transcript, then practise with sentence shadowing or AI-generated cloze blanks.
          </p>
        </div>

        <label className="mt-10 flex min-h-[310px] cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed border-white/80 bg-white/38 p-8 text-center shadow-glass backdrop-blur-xl transition hover:bg-white/58">
          <input
            type="file"
            accept="audio/mp3,audio/mpeg,audio/wav"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <div className="grid h-20 w-20 place-items-center rounded-[20px] bg-white/70 text-[#4f8cff] shadow-glass">
            <Cloud size={34} />
          </div>
          <h3 className="mt-6 text-2xl font-semibold">Drop in MP3 or WAV audio</h3>
          <p className="mt-2 max-w-md text-slate-500">Whisper transcription runs through the FastAPI backend. Sample mode is available without a file.</p>
          <span className="soft-button mt-7 inline-flex items-center gap-2 rounded-2xl bg-[#4f8cff] px-5 py-3 text-sm font-semibold text-white">
            <FileAudio size={18} />
            Select audio
          </span>
        </label>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <div className="rounded-2xl border border-white/60 bg-white/42 p-4 text-sm text-slate-600">{status}</div>
          <button
            className="soft-button rounded-2xl border border-white/70 bg-white/58 px-5 py-3 text-sm font-semibold text-slate-700"
            onClick={() => handleFile()}
            disabled={busy}
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles size={17} />
              Use sample
            </span>
          </button>
          <Link href="/shadow" className="soft-button rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            <span className="inline-flex items-center gap-2">
              Continue
              <ArrowRight size={17} />
            </span>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
