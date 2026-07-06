"use client";

import { usePracticeStore } from "../lib/practiceStore";
import { PracticeState } from "../lib/status";

function colorFor(state: PracticeState, score?: number) {
  if (state === "READY" || state === "PRACTICE_SHADOWING" || state === "PRACTICE_CLOZE") return "traffic-dot-green";
  if (state === "UPLOADING" || state === "TRANSCRIBING" || state === "EVALUATING") return "traffic-dot-yellow";
  if (state === "RESULT") {
    if ((score ?? 0) > 70) return "traffic-dot-green";
    if ((score ?? 0) >= 40) return "traffic-dot-yellow";
    return "traffic-dot-red";
  }
  return "";
}

export default function PracticeStatusLights() {
  const { currentStatus, lastScore } = usePracticeStore();
  const state = currentStatus;
  const pulsing = state === "UPLOADING" || state === "TRANSCRIBING" || state === "PRACTICE_SHADOWING" || state === "PRACTICE_CLOZE" || state === "EVALUATING";
  const active =
    state === "READY" || state === "PRACTICE_SHADOWING" || state === "PRACTICE_CLOZE"
      ? 0
      : state === "UPLOADING" || state === "TRANSCRIBING" || state === "EVALUATING"
        ? 1
        : state === "RESULT"
          ? 2
          : -1;
  return (
    <aside className="shrink-0">
      <div className="traffic-pill max-w-[280px]">
        {[0, 1, 2].map((slot) => (
          <span
            key={slot}
            className={`traffic-dot ${slot === active ? colorFor(state, lastScore) : ""} ${slot === active && pulsing ? "pulse" : ""}`}
          />
        ))}
        <div className="text-right">
          <p className="text-xs font-semibold tracking-wide text-slate-500">{state}</p>
          <p className="text-sm font-semibold text-slate-900">{typeof lastScore === "number" ? `${lastScore}%` : "Ready"}</p>
        </div>
      </div>
    </aside>
  );
}
