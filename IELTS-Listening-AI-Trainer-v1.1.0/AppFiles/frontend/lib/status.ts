export type PracticeState =
  | "IDLE"
  | "UPLOADING"
  | "TRANSCRIBING"
  | "ALIGNING"
  | "READY"
  | "PRACTICE_SHADOWING"
  | "PRACTICE_CLOZE"
  | "PRACTICE_READING"
  | "LISTENING"
  | "ANSWERING"
  | "EVALUATING"
  | "RESULT"
  | "BACKUP_WORKING"
  | "MODEL_DOWNLOADING"
  | "SUCCESS"
  | "ERROR";

export type StatusLightColor = "red" | "yellow" | "green";

export function statusLightColor(state: PracticeState, score?: number): StatusLightColor | null {
  if (state === "ERROR") return "red";
  if (state === "SUCCESS" || state === "READY" || state === "ANSWERING") return "green";
  if (["UPLOADING", "TRANSCRIBING", "ALIGNING", "BACKUP_WORKING", "MODEL_DOWNLOADING", "LISTENING"].includes(state)) return "yellow";
  if (state === "RESULT") {
    if ((score ?? 0) >= 70) return "green";
    if ((score ?? 0) >= 40) return "yellow";
    return "red";
  }
  return null;
}
