"use client";

import { useMemo } from "react";
import { mistakeCounts, recommendation, sessionAverage, sessionBand } from "../../lib/sessionStore";
import { usePracticeStore } from "../../lib/practiceStore";

export default function AnalysisPage() {
  const { session } = usePracticeStore();

  const metrics = useMemo(() => {
    return {
      average: sessionAverage(session),
      band: sessionBand(session),
      mistakes: mistakeCounts(session),
      recommendation: recommendation(session),
      trend: session.answers.map((answer) => answer.score)
    };
  }, [session]);

  return (
    <div className="glass stage space-y-6">
      <section className="soft-card rounded-[28px] p-6">
        <p className="text-sm font-semibold text-slate-500">Analysis</p>
        <h1 className="mt-2 text-4xl font-semibold text-slate-950">Band {metrics.band.toFixed(0)}</h1>
        <p className="mt-2 text-slate-600">{metrics.recommendation}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="soft-card rounded-[28px] p-6">
          <p className="text-sm font-semibold text-slate-500">Session score</p>
          <p className="mt-3 text-5xl font-semibold text-slate-950">{metrics.average}%</p>
        </section>
        <section className="soft-card rounded-[28px] p-6">
          <p className="text-sm font-semibold text-slate-500">Study time</p>
          <p className="mt-3 text-5xl font-semibold text-slate-950">{Math.round(session.studySeconds / 60)}m</p>
        </section>
        <section className="soft-card rounded-[28px] p-6">
          <p className="text-sm font-semibold text-slate-500">Answers</p>
          <p className="mt-3 text-5xl font-semibold text-slate-950">{session.answers.length}</p>
        </section>
      </div>

      <section className="soft-card rounded-[28px] p-6">
        <h2 className="text-lg font-semibold text-slate-900">Accuracy trend</h2>
        <div className="mt-5 flex h-44 items-end gap-2 rounded-[20px] bg-white/42 p-4">
          {(metrics.trend.length ? metrics.trend : [0]).map((score, index) => (
            <div key={index} className="flex flex-1 flex-col items-center justify-end gap-2">
              <div className="w-full rounded-t-xl bg-slate-900" style={{ height: `${Math.max(score, 4)}%` }} />
              <span className="text-xs text-slate-500">{score}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="soft-card rounded-[28px] p-6">
        <h2 className="text-lg font-semibold text-slate-900">Mistake categories</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {["spelling", "numbers", "vocabulary", "grammar"].map((name) => (
            <div key={name} className="rounded-[20px] bg-white/45 p-4">
              <p className="text-sm capitalize text-slate-500">{name}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{metrics.mistakes[name] ?? 0}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
