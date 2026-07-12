import type { Sentence } from "./sessionStore";

export function computeClipBounds({
  timeline,
  startTime,
  endTime,
  duration,
  startPaddingMs,
  endPaddingMs,
  playWholeAudio
}: {
  timeline: Sentence[];
  startTime?: number;
  endTime?: number;
  duration: number;
  startPaddingMs: number;
  endPaddingMs: number;
  playWholeAudio: boolean;
}) {
  if (playWholeAudio) return { start: 0, end: duration };
  if (typeof startTime !== "number" || typeof endTime !== "number" || startTime < 0 || endTime <= startTime) {
    return { start: Number.NaN, end: Number.NaN };
  }
  const clipIndex = timeline.findIndex(
    (sentence) => typeof sentence.start === "number" && Math.abs(sentence.start - startTime) < 0.001
  );
  const previousBoundary = clipIndex > 0 ? timeline[clipIndex - 1]?.end : undefined;
  const nextBoundary = clipIndex >= 0 ? timeline[clipIndex + 1]?.start : undefined;
  const start = Math.max(
    0,
    startTime - startPaddingMs / 1000,
    typeof previousBoundary === "number" ? previousBoundary + 0.012 : 0
  );
  const paddedEnd = endTime + endPaddingMs / 1000;
  const nextLimit = typeof nextBoundary === "number" ? nextBoundary - 0.012 : Number.POSITIVE_INFINITY;
  const end = Math.min(paddedEnd, nextLimit, duration || paddedEnd);
  return end > start ? { start, end } : { start: Number.NaN, end: Number.NaN };
}
