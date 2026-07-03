"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileText, Wand2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AudioCard } from "@/components/AudioCard";
import { evaluateCloze, generateCloze, transcribe } from "@/lib/api";
import { useTrainer } from "@/lib/store";

export default function ClozePage() {
  const { transcript, cloze, setTranscript, setCloze, setLastResult } = useTrainer();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [blankCount, setBlankCount] = useState(40);
  const [status, setStatus] = useState("Generate blanks from the active transcript.");

  const parts = useMemo(() => cloze?.cloze_text.split(/(\[\[blank-\d+\]\])/g) ?? [], [cloze]);

  async function createCloze() {
    try {
      const current = transcript ?? (await transcribe());
      setTranscript(current);
      const generated = await generateCloze(current.transcript, blankCount);
      setCloze(generated);
      setAnswers({});
      setStatus(`Generated ${generated.blanks.length} weighted blanks from ${current.sentences.length} sentence segments.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Could not generate cloze: ${message}`);
    }
  }

  async function submit() {
    if (!cloze) return;
    const result = await evaluateCloze(cloze.blanks, answers);
    setLastResult(result);
    setStatus(`Submitted. Score ${result.score}, estimated band ${result.band}.`);
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Mode B</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-normal">Cloze test</h2>
        </div>

        <AudioCard />

        {transcript ? (
          <div className="rounded-[20px] border border-white/60 bg-white/42 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
              <FileText size={17} />
              Active transcript
            </div>
            <p className="max-h-32 overflow-auto text-sm leading-7 text-slate-600">{transcript.transcript}</p>
          </div>
        ) : null}

        <div className="rounded-[22px] border border-white/70 bg-white/44 p-6 leading-10 text-slate-800">
          {cloze ? (
            parts.map((part, index) => {
              const match = part.match(/\[\[(blank-\d+)\]\]/);
              if (!match) return <span key={`${part}-${index}`}>{part} </span>;
              const blankId = match[1];
              const blank = cloze.blanks.find((item) => item.id === blankId);
              return (
                <input
                  key={blankId}
                  aria-label={blankId}
                  value={answers[blankId] ?? ""}
                  onChange={(event) => setAnswers((value) => ({ ...value, [blankId]: event.target.value }))}
                  className="mx-1 inline-block h-10 w-36 rounded-xl border border-white/70 bg-white/72 px-3 text-center text-base font-semibold outline-none transition focus:border-[#7c5cff] focus:shadow-glow"
                  placeholder={blank?.kind ?? "blank"}
                />
              );
            })
          ) : (
            <p className="text-slate-500">{status}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex rounded-2xl border border-white/70 bg-white/50 p-1">
            {[20, 40, 60, 80].map((count) => (
              <button
                key={count}
                onClick={() => setBlankCount(count)}
                className={`soft-button rounded-xl px-4 py-2 text-sm font-semibold ${
                  blankCount === count ? "bg-white text-slate-950 shadow-glow" : "text-slate-500 hover:bg-white/55"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
          <button onClick={createCloze} className="soft-button rounded-2xl bg-[#7c5cff] px-5 py-3 text-sm font-semibold text-white">
            <span className="inline-flex items-center gap-2">
              <Wand2 size={17} />
              Generate {blankCount} blanks
            </span>
          </button>
          <button onClick={submit} className="soft-button rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={17} />
              Submit
            </span>
          </button>
        </div>

        {cloze ? (
          <div className="grid gap-3 md:grid-cols-3">
            {cloze.blanks.map((blank) => (
              <div key={blank.id} className="rounded-2xl border border-white/60 bg-white/42 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{blank.kind}</p>
                <p className="mt-2 text-sm text-slate-600">
                  #{blank.id.replace("blank-", "")} · Weight {blank.weight.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
