"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Eye, ListMusic, Play, SkipForward } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AudioCard } from "@/components/AudioCard";
import { evaluateShadow, transcribe } from "@/lib/api";
import { useTrainer } from "@/lib/store";

export default function ShadowPage() {
  const { transcript, setTranscript, setLastResult } = useTrainer();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState("Choose a sentence and play it.");
  const sentence = transcript?.sentences[index];

  const progress = useMemo(() => {
    if (!transcript?.sentences.length) return 0;
    return Math.round(((index + 1) / transcript.sentences.length) * 100);
  }, [index, transcript]);

  async function ensureTranscript() {
    if (transcript) return transcript;
    try {
      const prepared = await transcribe();
      setTranscript(prepared);
      setStatus(`Prepared ${prepared.sentences.length} sample sentence segments.`);
      return prepared;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Transcript unavailable: ${message}`);
      throw error;
    }
  }

  async function submit() {
    const prepared = await ensureTranscript();
    const current = sentence ?? prepared.sentences[0];
    if (!current) return;
    const result = await evaluateShadow(current.text, typed);
    setLastResult(result);
    setRevealed(true);
  }

  async function playCurrent() {
    const prepared = await ensureTranscript();
    const current = sentence ?? prepared.sentences[0];
    const audio = audioRef.current;
    if (!current || !audio || current.start == null) {
      setStatus("No timestamped audio segment is available yet.");
      return;
    }

    audio.pause();
    audio.currentTime = Math.max(0, current.start);
    await audio.play();
    setStatus(`Playing sentence ${current.id + 1}`);

    const stopAt = current.end ?? current.start + 4;
    const watcher = window.setInterval(() => {
      if (audio.currentTime >= stopAt) {
        audio.pause();
        window.clearInterval(watcher);
        setStatus("Paused after the sentence.");
      }
    }, 120);
  }

  function next() {
    const total = transcript?.sentences.length ?? 1;
    setIndex((value) => Math.min(total - 1, value + 1));
    setTyped("");
    setRevealed(false);
  }

  return (
    <AppShell>
      <div className="grid h-full gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Mode A</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-normal">Sentence shadowing</h2>
        </div>

        <AudioCard audioRef={audioRef} />

        <div className="rounded-[20px] border border-white/60 bg-white/42 p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-slate-500">Sentence {sentence ? index + 1 : 0}</p>
            <div className="h-2 w-40 rounded-full bg-slate-200/70">
              <div className="h-2 rounded-full bg-[#4f8cff]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="rounded-[18px] bg-white/50 p-6">
            <p className="text-sm text-slate-500">{status}</p>
            <textarea
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="mt-5 min-h-40 w-full resize-none rounded-[18px] border border-white/70 bg-white/58 p-4 text-lg outline-none transition focus:border-[#4f8cff] focus:shadow-glow"
              placeholder="Type the sentence here..."
            />
          </div>
        </div>

        {transcript?.sentences.length ? (
          <div className="rounded-[20px] border border-white/60 bg-white/42 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
              <ListMusic size={17} />
              Sentence segments
            </div>
            <div className="grid max-h-64 gap-2 overflow-auto pr-1">
              {transcript.sentences.map((item, itemIndex) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setIndex(itemIndex);
                    setTyped("");
                    setRevealed(false);
                    setStatus(`Selected sentence ${itemIndex + 1}`);
                  }}
                  className={`rounded-2xl border p-3 text-left text-sm leading-6 transition ${
                    itemIndex === index
                      ? "border-[#4f8cff]/60 bg-white/75 text-slate-950 shadow-glow"
                      : "border-white/50 bg-white/35 text-slate-600 hover:bg-white/55"
                  }`}
                >
                  <span className="font-semibold">#{itemIndex + 1}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {item.start?.toFixed(1)}s-{item.end?.toFixed(1)}s
                  </span>
                  {revealed && itemIndex === index ? <span className="mt-1 block">{item.text}</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {revealed && sentence ? (
          <div className="rounded-[20px] border border-white/70 bg-white/52 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Correct answer</p>
            <p className="mt-3 text-lg leading-8 text-slate-800">{sentence.text}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button onClick={playCurrent} className="soft-button rounded-2xl bg-white/60 px-5 py-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2">
              <Play size={17} />
              Play sentence
            </span>
          </button>
          <button onClick={submit} className="soft-button rounded-2xl bg-[#4f8cff] px-5 py-3 text-sm font-semibold text-white">
            <span className="inline-flex items-center gap-2">
              <Check size={17} />
              Evaluate
            </span>
          </button>
          <button onClick={() => setRevealed(true)} className="soft-button rounded-2xl bg-white/60 px-5 py-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2">
              <Eye size={17} />
              Reveal
            </span>
          </button>
          <button onClick={next} className="soft-button rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            <span className="inline-flex items-center gap-2">
              <SkipForward size={17} />
              Next
            </span>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
