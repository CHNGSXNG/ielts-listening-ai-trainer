"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { LoopCount, PlaybackRate, ReplayInterval, Sentence } from "../lib/sessionStore";
import { computeClipBounds } from "../lib/audioTimeline";
import { useI18n } from "../lib/i18n";

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SentencePlayer({
  audioUrl,
  timeline = [],
  startTime,
  endTime,
  playWholeAudio = false,
  loopCount = 1,
  replayInterval = 0,
  playbackRate = 1,
  volume = 1,
  useNativeControls = false,
  showSeekPreview = true,
  startPaddingMs = 0,
  endPaddingMs = 0,
  fadeInMs = 0,
  fadeOutMs = 0,
  stopOnSentenceChange = true,
  autoPlayRequest = 0,
  togglePlaybackRequest = 0,
  pausedExternally = false,
  onPlaybackRateChange,
  onPlaybackStateChange,
  onStart,
  onStop,
  onPlayIteration,
  onTimeChange
}: {
  audioUrl: string;
  timeline?: Sentence[];
  startTime?: number;
  endTime?: number;
  playWholeAudio?: boolean;
  loopCount?: LoopCount;
  replayInterval?: ReplayInterval;
  playbackRate?: PlaybackRate;
  volume?: number;
  useNativeControls?: boolean;
  showSeekPreview?: boolean;
  startPaddingMs?: number;
  endPaddingMs?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  stopOnSentenceChange?: boolean;
  autoPlayRequest?: number;
  togglePlaybackRequest?: number;
  pausedExternally?: boolean;
  onPlaybackRateChange?: (rate: PlaybackRate) => void;
  onPlaybackStateChange?: (playing: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onPlayIteration?: () => void;
  onTimeChange?: (time: number) => void;
}) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const tickRef = useRef<(generation: number) => void>(() => undefined);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackGenerationRef = useRef(0);
  const lastAutoPlayRequestRef = useRef(autoPlayRequest);
  const lastTogglePlaybackRequestRef = useRef(togglePlaybackRequest);
  const playingRef = useRef(false);
  const boundaryRef = useRef(false);
  const loopIterationRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waitingForReplay, setWaitingForReplay] = useState(false);
  const [currentLoop, setCurrentLoop] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState("");
  const [previewPercent, setPreviewPercent] = useState<number | null>(null);

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => computeClipBounds({ timeline, startTime, endTime, duration, startPaddingMs, endPaddingMs, playWholeAudio }),
    [duration, endPaddingMs, endTime, playWholeAudio, startPaddingMs, startTime, timeline]
  );
  const preciseRange = playWholeAudio ? duration > 0 : Number.isFinite(rangeStart) && Number.isFinite(rangeEnd) && rangeEnd > rangeStart;
  const rangeDuration = preciseRange ? Math.max(rangeEnd - rangeStart, 0) : 0;
  const rangeProgress = rangeDuration ? Math.min(100, Math.max(0, ((currentTime - rangeStart) / rangeDuration) * 100)) : 0;
  const previewTime = previewPercent === null ? null : rangeStart + rangeDuration * previewPercent;
  const previewSentence =
    previewTime === null
      ? undefined
      : timeline.find((sentence) => typeof sentence.start === "number" && typeof sentence.end === "number" && previewTime >= sentence.start && previewTime <= sentence.end);
  const previewSentenceIndex = previewSentence ? timeline.findIndex((sentence) => sentence.id === previewSentence.id) : -1;

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const cancelReplayTimer = useCallback(() => {
    if (replayTimerRef.current !== null) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setWaitingForReplay(false);
  }, []);

  const waitForSeek = useCallback((audio: HTMLAudioElement, generation: number) => {
    if (!audio.seeking) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timeout = window.setTimeout(finish, 750);
      function finish() {
        window.clearTimeout(timeout);
        audio.removeEventListener("seeked", finish);
        resolve();
      }
      audio.addEventListener("seeked", finish, { once: true });
    }).then(() => {
      if (generation !== playbackGenerationRef.current) throw new DOMException("Playback superseded", "AbortError");
    });
  }, []);

  const applyPlaybackVolume = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    let multiplier = 1;
    if (fadeInMs > 0) multiplier = Math.min(multiplier, Math.max(0, (time - rangeStart) / (fadeInMs / 1000)));
    if (fadeOutMs > 0) multiplier = Math.min(multiplier, Math.max(0, (rangeEnd - time) / (fadeOutMs / 1000)));
    audio.volume = Math.min(1, Math.max(0, volume * multiplier));
  }, [fadeInMs, fadeOutMs, rangeEnd, rangeStart, volume]);

  const startAudioIteration = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !preciseRange) return;
    const generation = playbackGenerationRef.current;
    boundaryRef.current = false;
    audio.currentTime = rangeStart;
    setCurrentTime(rangeStart);
    onTimeChange?.(rangeStart);
    try {
      await waitForSeek(audio, generation);
      await audio.play();
      if (generation !== playbackGenerationRef.current) {
        audio.pause();
        return;
      }
      loopIterationRef.current += 1;
      setCurrentLoop(loopIterationRef.current);
      playingRef.current = true;
      setIsPlaying(true);
      onPlaybackStateChange?.(true);
      setWaitingForReplay(false);
      setPlaybackError("");
      onStart();
      onPlayIteration?.();
      frameRef.current = requestAnimationFrame(() => tickRef.current(generation));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      playingRef.current = false;
      setIsPlaying(false);
      onPlaybackStateChange?.(false);
      setWaitingForReplay(false);
      setPlaybackError(t("Playback could not start. Check the audio source and browser permissions."));
      onStop();
    }
  }, [onPlayIteration, onPlaybackStateChange, onStart, onStop, onTimeChange, preciseRange, rangeStart, waitForSeek]);

  const finishAtBoundary = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || boundaryRef.current) return;
    boundaryRef.current = true;
    cancelFrame();
    audio.pause();
    playingRef.current = false;
    if (Number.isFinite(rangeEnd)) {
      audio.currentTime = rangeEnd;
      setCurrentTime(rangeEnd);
      onTimeChange?.(rangeEnd);
    }

    const completedLoops = Math.max(loopIterationRef.current, 1);
    const hasAnotherLoop = !playWholeAudio && (loopCount === "infinite" || completedLoops < loopCount);
    if (hasAnotherLoop) {
      const generation = playbackGenerationRef.current;
      setWaitingForReplay(true);
      replayTimerRef.current = setTimeout(() => {
        replayTimerRef.current = null;
        if (generation !== playbackGenerationRef.current) return;
        void startAudioIteration();
      }, replayInterval * 1000);
      return;
    }

    setIsPlaying(false);
    setWaitingForReplay(false);
    onPlaybackStateChange?.(false);
    onStop();
  }, [cancelFrame, loopCount, onPlaybackStateChange, onStop, onTimeChange, playWholeAudio, rangeEnd, replayInterval, startAudioIteration]);

  const tick = useCallback((generation: number) => {
    if (generation !== playbackGenerationRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = audio.currentTime;
    applyPlaybackVolume(nextTime);
    setCurrentTime(nextTime);
    onTimeChange?.(nextTime);
    if (playingRef.current && rangeEnd > rangeStart && nextTime >= rangeEnd - 0.012) {
      finishAtBoundary();
      return;
    }
    if (!audio.paused) frameRef.current = requestAnimationFrame(() => tickRef.current(generation));
  }, [applyPlaybackVolume, finishAtBoundary, onTimeChange, rangeEnd, rangeStart]);
  tickRef.current = tick;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoaded = () => {
      const nextDuration = audio.duration || 0;
      setDuration(nextDuration);
      const nextStart = playWholeAudio ? 0 : startTime;
      if (typeof nextStart === "number" && Number.isFinite(nextStart)) {
        audio.currentTime = nextStart;
        setCurrentTime(nextStart);
        onTimeChange?.(nextStart);
      }
      setPlaybackError("");
    };
    const handleDuration = () => setDuration(audio.duration || 0);
    const handleTime = () => {
      const nextTime = audio.currentTime;
      applyPlaybackVolume(nextTime);
      setCurrentTime(nextTime);
      onTimeChange?.(nextTime);
      if (playingRef.current && rangeEnd > rangeStart && nextTime >= rangeEnd - 0.012) finishAtBoundary();
    };
    const handleEnded = () => finishAtBoundary();
    const handleNativePlay = () => {
      if (!useNativeControls || !playWholeAudio) return;
      const generation = playbackGenerationRef.current + 1;
      playbackGenerationRef.current = generation;
      playingRef.current = true;
      setIsPlaying(true);
      onPlaybackStateChange?.(true);
      onStart();
      frameRef.current = requestAnimationFrame(() => tickRef.current(generation));
    };
    const handleNativePause = () => {
      if (!useNativeControls || !playWholeAudio || boundaryRef.current) return;
      cancelFrame();
      playingRef.current = false;
      setIsPlaying(false);
      onPlaybackStateChange?.(false);
      onStop();
    };
    const handleError = () => {
      cancelFrame();
      cancelReplayTimer();
      playingRef.current = false;
      setIsPlaying(false);
      onPlaybackStateChange?.(false);
      setPlaybackError(t("Audio could not be loaded. Re-upload the source file and try again."));
      onStop();
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("durationchange", handleDuration);
    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handleNativePlay);
    audio.addEventListener("pause", handleNativePause);
    audio.addEventListener("error", handleError);
    return () => {
      playbackGenerationRef.current += 1;
      cancelFrame();
      cancelReplayTimer();
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("durationchange", handleDuration);
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handleNativePlay);
      audio.removeEventListener("pause", handleNativePause);
      audio.removeEventListener("error", handleError);
    };
  }, [applyPlaybackVolume, cancelFrame, cancelReplayTimer, finishAtBoundary, onPlaybackStateChange, onStart, onStop, onTimeChange, playWholeAudio, rangeEnd, rangeStart, startTime, useNativeControls]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    playbackGenerationRef.current += 1;
    const wasActive = playingRef.current || replayTimerRef.current !== null;
    cancelFrame();
    cancelReplayTimer();
    const selectionTarget = playWholeAudio && typeof startTime === "number" ? startTime : rangeStart;
    if (playWholeAudio && !stopOnSentenceChange && playingRef.current && Number.isFinite(selectionTarget)) {
      audio.currentTime = selectionTarget;
      setCurrentTime(selectionTarget);
      onTimeChange?.(selectionTarget);
      const generation = playbackGenerationRef.current;
      frameRef.current = requestAnimationFrame(() => tickRef.current(generation));
      return;
    }
    audio.pause();
    if (Number.isFinite(selectionTarget)) audio.currentTime = selectionTarget;
    if (Number.isFinite(selectionTarget)) {
      setCurrentTime(selectionTarget);
      onTimeChange?.(selectionTarget);
    }
    loopIterationRef.current = 0;
    boundaryRef.current = false;
    setCurrentLoop(0);
    setIsPlaying(false);
    playingRef.current = false;
    if (wasActive) {
      onPlaybackStateChange?.(false);
      onStop();
    }
    setPlaybackError("");
  }, [audioUrl, cancelFrame, cancelReplayTimer, onPlaybackStateChange, onStop, onTimeChange, playWholeAudio, rangeStart, startTime, stopOnSentenceChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    applyPlaybackVolume(currentTime);
  }, [applyPlaybackVolume, currentTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !pausedExternally) return;
    playbackGenerationRef.current += 1;
    cancelFrame();
    cancelReplayTimer();
    audio.pause();
    playingRef.current = false;
    boundaryRef.current = false;
    setIsPlaying(false);
    onPlaybackStateChange?.(false);
  }, [cancelFrame, cancelReplayTimer, onPlaybackStateChange, pausedExternally]);

  useEffect(() => {
    return () => {
      cancelFrame();
      cancelReplayTimer();
    };
  }, [cancelFrame, cancelReplayTimer]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      playbackGenerationRef.current += 1;
      cancelFrame();
      cancelReplayTimer();
      audio.pause();
      setIsPlaying(false);
      playingRef.current = false;
      boundaryRef.current = false;
      onPlaybackStateChange?.(false);
      onStop();
      return;
    }
    if (!preciseRange) return;

    const restarting = audio.currentTime < rangeStart || audio.currentTime >= rangeEnd - 0.012 || loopIterationRef.current === 0;
    if (restarting) {
      loopIterationRef.current = 0;
      setCurrentLoop(0);
      audio.currentTime = rangeStart;
      onTimeChange?.(rangeStart);
    }
    boundaryRef.current = false;
    const generation = playbackGenerationRef.current + 1;
    playbackGenerationRef.current = generation;
    try {
      await waitForSeek(audio, generation);
      await audio.play();
      if (generation !== playbackGenerationRef.current) {
        audio.pause();
        return;
      }
      if (restarting) {
        loopIterationRef.current = 1;
        setCurrentLoop(1);
        onPlayIteration?.();
      }
      setPlaybackError("");
      setIsPlaying(true);
      playingRef.current = true;
      onPlaybackStateChange?.(true);
      onStart();
      frameRef.current = requestAnimationFrame(() => tickRef.current(generation));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setPlaybackError(t("Playback could not start. Check the audio source and browser permissions."));
      setIsPlaying(false);
      playingRef.current = false;
      onPlaybackStateChange?.(false);
    }
  }

  function replayRange() {
    const audio = audioRef.current;
    if (!audio || !preciseRange) return;
    playbackGenerationRef.current += 1;
    cancelFrame();
    cancelReplayTimer();
    audio.pause();
    audio.currentTime = rangeStart;
    onTimeChange?.(rangeStart);
    loopIterationRef.current = 0;
    boundaryRef.current = false;
    setCurrentLoop(0);
    setCurrentTime(rangeStart);
    setIsPlaying(false);
    playingRef.current = false;
    onPlaybackStateChange?.(false);
    onStop();
  }

  function seek(percent: number) {
    const audio = audioRef.current;
    if (!audio || !rangeDuration) return;
    const generation = playbackGenerationRef.current + 1;
    playbackGenerationRef.current = generation;
    const wasWaiting = replayTimerRef.current !== null;
    cancelReplayTimer();
    boundaryRef.current = false;
    const nextTime = Math.min(rangeEnd - 0.012, rangeStart + rangeDuration * percent);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    onTimeChange?.(nextTime);
    if (!audio.paused) frameRef.current = requestAnimationFrame(() => tickRef.current(generation));
    if (wasWaiting) {
      setIsPlaying(false);
      playingRef.current = false;
      onPlaybackStateChange?.(false);
      onStop();
    }
  }

  useEffect(() => {
    if (autoPlayRequest === lastAutoPlayRequestRef.current) return;
    lastAutoPlayRequestRef.current = autoPlayRequest;
    const timer = window.setTimeout(() => {
      if (!playingRef.current) void togglePlay();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [autoPlayRequest]);

  useEffect(() => {
    if (togglePlaybackRequest === lastTogglePlaybackRequestRef.current) return;
    lastTogglePlaybackRequestRef.current = togglePlaybackRequest;
    const timer = window.setTimeout(() => void togglePlay(), 30);
    return () => window.clearTimeout(timer);
  }, [togglePlaybackRequest]);

  const showLoopBadge = !playWholeAudio && (loopCount === "infinite" || loopCount > 1 || waitingForReplay || currentLoop > 1);
  const loopLabel = loopCount === "infinite" ? `Loop ${Math.max(currentLoop, 1)} · ∞` : `Loop ${Math.max(currentLoop, 1)} of ${loopCount}`;

  return (
    <div className="audio-control-row">
      <audio ref={audioRef} src={audioUrl} preload="metadata" controls={useNativeControls && playWholeAudio} className={useNativeControls && playWholeAudio ? "h-12 w-full" : undefined} />
      {!(useNativeControls && playWholeAudio) ? <div className="flex min-h-[72px] items-center gap-2.5 sm:gap-3">
        <button
          aria-label={isPlaying ? t("Pause audio") : t("Play audio")}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-slate-950 text-white shadow-[0_8px_18px_rgba(15,23,42,0.2)] disabled:cursor-not-allowed disabled:opacity-45"
          onClick={togglePlay}
          disabled={!audioUrl || !preciseRange}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          aria-label={t("Replay current range")}
          title={t("Restart current playback range")}
          className="grid size-10 shrink-0 place-items-center rounded-full text-slate-600 transition hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-45"
          onClick={replayRange}
          disabled={!audioUrl || !preciseRange}
        >
          <RotateCcw size={17} />
        </button>
        {showLoopBadge ? <span className="hidden shrink-0 rounded-full bg-slate-900/5 px-2.5 py-1 text-[11px] font-semibold text-slate-500 lg:inline">{waitingForReplay ? `Again in ${replayInterval}s` : loopLabel}</span> : null}
        <div className="relative min-w-48 flex-1">
          {showSeekPreview && previewTime !== null ? (
            <div
              className="pointer-events-none absolute bottom-full z-10 mb-2 w-56 -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-xs text-white shadow-xl"
              style={{ left: `${Math.min(94, Math.max(6, previewPercent! * 100))}%` }}
            >
              <p className="font-semibold">
                {formatTime(previewTime)}{previewSentenceIndex >= 0 ? ` · Sentence ${previewSentenceIndex + 1}` : ""}
              </p>
              {previewSentence ? <p className="mt-1 truncate text-white/70">{previewSentence.text}</p> : null}
            </div>
          ) : null}
          <input
            aria-label={t("Audio progress")}
            className="w-full"
            style={{ accentColor: "var(--accent)" }}
            type="range"
            min={0}
            max={100}
            value={rangeProgress}
            onChange={(event) => seek(Number(event.target.value) / 100)}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              setPreviewPercent(Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)));
            }}
            onPointerLeave={() => setPreviewPercent(null)}
          />
          <div className="mt-1 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{formatTime(Math.max(currentTime - rangeStart, 0))} / {formatTime(rangeDuration)}</span>
            {showLoopBadge ? <span className="lg:hidden">{waitingForReplay ? `Again in ${replayInterval}s` : loopLabel}</span> : null}
          </div>
        </div>
        <select
          aria-label={t("Playback speed")}
          className="control h-10 shrink-0 rounded-xl px-2 text-sm font-semibold"
          value={playbackRate}
          onChange={(event) => onPlaybackRateChange?.(Number(event.target.value) as PlaybackRate)}
        >
          <option value={0.5}>0.5x</option>
          <option value={0.75}>0.75x</option>
          <option value={0.9}>0.9x</option>
          <option value={1}>1.0x</option>
          <option value={1.1}>1.1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2.0x</option>
        </select>
      </div> : null}
      {!playWholeAudio && !preciseRange && audioUrl ? <p className="pb-2 text-xs font-semibold text-amber-800">{t("Precise word-aligned timing is unavailable for this sentence.")}</p> : null}
      {playbackError ? <p className="pb-2 text-xs font-semibold text-rose-700">{playbackError}</p> : null}
    </div>
  );
}
