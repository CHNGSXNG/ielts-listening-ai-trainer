"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { usePracticeStore } from "../lib/practiceStore";
import { PracticeState, StatusLightColor, statusLightColor } from "../lib/status";
import { useUserPreferences } from "../lib/userPreferences";
import { useI18n } from "../lib/i18n";

function statusCopy(state: PracticeState) {
  if (state === "UPLOADING") return "Uploading";
  if (state === "TRANSCRIBING") return "Transcribing";
  if (state === "ALIGNING") return "Aligning";
  if (state === "LISTENING") return "Listening";
  if (state === "ANSWERING") return "Answering";
  if (state === "EVALUATING") return "Evaluating";
  if (state === "BACKUP_WORKING") return "Saving data";
  if (state === "MODEL_DOWNLOADING") return "Downloading model";
  if (state === "SUCCESS") return "Complete";
  if (state === "ERROR") return "Action failed";
  if (state === "RESULT") return "Result";
  if (state === "READY") return "Audio ready";
  if (state === "PRACTICE_SHADOWING" || state === "PRACTICE_CLOZE" || state === "PRACTICE_READING") return "Practice ready";
  return "Idle";
}

export default function PracticeStatusLights() {
  const { preferences } = useUserPreferences();
  const { t } = useI18n();
  const pathname = usePathname();
  const { currentStatus, lastScore, session } = usePracticeStore();
  let state = currentStatus;
  let score = lastScore;

  if (pathname === "/analysis" && !["BACKUP_WORKING", "SUCCESS", "ERROR"].includes(currentStatus)) {
    const corrupted = Boolean(session.sentences.length && !session.transcript);
    const practised = new Set(session.answers.filter((answer) => answer.sentenceId !== "full-cloze").map((answer) => answer.sentenceId)).size;
    const completed = Boolean(session.sentences.length && practised >= session.sentences.length);
    state = corrupted ? "ERROR" : completed ? "SUCCESS" : session.sentences.length ? "TRANSCRIBING" : "IDLE";
    score = undefined;
  }
  if (pathname === "/settings" && !["BACKUP_WORKING", "MODEL_DOWNLOADING", "SUCCESS", "ERROR"].includes(currentStatus)) {
    state = "IDLE";
    score = undefined;
  }

  const activeColor = statusLightColor(state, score);
  const pulsing = state === "UPLOADING" || state === "TRANSCRIBING" || state === "ALIGNING" || state === "BACKUP_WORKING" || state === "MODEL_DOWNLOADING" || state === "LISTENING" || state === "ANSWERING";
  const lights: Array<{ color: StatusLightColor; label: string }> = [
    { color: "red", label: "Error or score below 40" },
    { color: "yellow", label: "Listening, processing, or score from 40 to 69" },
    { color: "green", label: "Answering, ready, or score 70 and above" }
  ];
  const copyKey = pathname === "/analysis" && state === "TRANSCRIBING"
    ? "Unfinished session"
    : state === "RESULT" && typeof score === "number"
      ? score >= 70 ? "Correct" : score >= 40 ? "Needs review" : "Try again"
      : state === "EVALUATING" ? "Checking" : statusCopy(state);
  const copy = t(copyKey);
  const previousCopyRef = useRef(copyKey);

  useEffect(() => {
    if (!preferences.accessibility.soundFeedback || previousCopyRef.current === copyKey) {
      previousCopyRef.current = copyKey;
      return;
    }
    previousCopyRef.current = copyKey;
    if (!["Correct", "Needs review", "Try again", "Action failed"].includes(copyKey)) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = copyKey === "Correct" ? 720 : copyKey === "Needs review" ? 520 : 300;
      gain.gain.value = 0.04;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
      oscillator.onended = () => void context.close();
    } catch {
      // Browser autoplay policies may block status sounds before user interaction.
    }
  }, [copyKey, preferences.accessibility.soundFeedback]);

  return (
    <aside className="shrink-0" aria-live="polite" aria-label={copy}>
      <div className="traffic-pill max-w-[220px]">
        {lights.map((light) => {
          const active = activeColor === light.color;
          return (
            <span
              key={light.color}
              className={`traffic-dot ${active ? `traffic-dot-${light.color}` : ""} ${active && pulsing ? "pulse" : ""}`}
              role="img"
              aria-label={`${active ? t("Active") : t("Inactive")}: ${t(light.label)}`}
              title={t(light.label)}
            />
          );
        })}
        <p className="hidden whitespace-nowrap text-[13px] font-semibold text-slate-800 sm:block">
          {state === "RESULT" && typeof score === "number" ? `${score}% · ${copy}` : copy}
        </p>
      </div>
    </aside>
  );
}
