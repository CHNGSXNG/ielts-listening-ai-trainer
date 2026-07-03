"use client";

import Link from "next/link";
import { ArrowRight, Flame, ListChecks } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ScoreRing } from "@/components/ScoreRing";
import { useTrainer } from "@/lib/store";

export default function ResultsPage() {
  const { lastResult } = useTrainer();

  return (
    <AppShell>
      <div className="grid gap-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Dashboard</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-normal">Listening results</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-[260px_1fr]">
          <div className="rounded-[22px] border border-white/70 bg-white/44 p-6">
            <ScoreRing score={lastResult?.score ?? 0} label={lastResult ? `Band ${lastResult.band}` : "No attempt"} />
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/44 p-6">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <ListChecks size={20} />
              Mistake review
            </div>
            <div className="mt-5 space-y-3">
              {lastResult?.mistakes.length ? (
                lastResult.mistakes.map((mistake, index) => (
                  <div key={index} className="rounded-2xl bg-white/56 p-4 text-sm text-slate-700">
                    Expected <strong>{String(mistake.expected)}</strong>
                    {mistake.typed ? <> · Typed {String(mistake.typed)}</> : null}
                  </div>
                ))
              ) : (
                <p className="text-slate-500">Complete a shadowing or cloze attempt to populate weighted feedback.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/70 bg-white/44 p-6">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Flame size={20} />
            Skill heatmap
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {["Numbers", "Keywords", "Function words", "Collocations"].map((skill, index) => (
              <div key={skill} className="rounded-2xl bg-white/54 p-4">
                <p className="text-sm font-semibold">{skill}</p>
                <div className="mt-4 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-[#4f8cff]" style={{ width: `${82 - index * 12}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link href="/shadow" className="soft-button w-fit rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
          <span className="inline-flex items-center gap-2">
            Practice again
            <ArrowRight size={17} />
          </span>
        </Link>
      </div>
    </AppShell>
  );
}
