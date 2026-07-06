"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SentencePlayer({
  audioUrl,
  startTime,
  endTime,
  segmentIndex,
  segmentCount,
  playWholeAudio = false,
  onStart,
  onStop,
  onTimeChange
}: {
  audioUrl: string;
  startTime?: number;
  endTime?: number;
  segmentIndex?: number;
  segmentCount?: number;
  playWholeAudio?: boolean;
  onStart: () => void;
  onStop: () => void;
  onTimeChange?: (time: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const fallbackSlice = duration && segmentCount ? duration / segmentCount : 0;
  const rangeStart = playWholeAudio ? 0 : startTime ?? (segmentIndex !== undefined ? fallbackSlice * segmentIndex : 0);
  const rangeEnd = useMemo(() => {
    if (playWholeAudio) return duration;
    if (typeof endTime === "number" && endTime > rangeStart) return Math.min(endTime, duration || endTime);
    if (segmentIndex !== undefined && segmentCount && duration) return Math.min(duration, rangeStart + fallbackSlice);
    return duration;
  }, [duration, endTime, fallbackSlice, playWholeAudio, rangeStart, segmentCount, segmentIndex]);
  const rangeDuration = Math.max(rangeEnd - rangeStart, 0);
  const rangeProgress = rangeDuration ? Math.min(100, Math.max(0, ((currentTime - rangeStart) / rangeDuration) * 100)) : 0;

  const stopAtBoundary = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    if (Number.isFinite(rangeEnd) && rangeEnd > 0) {
      audio.currentTime = rangeEnd;
      onTimeChange?.(rangeEnd);
    }
    setIsPlaying(false);
    playingRef.current = false;
    onStop();
  }, [onStop, onTimeChange, rangeEnd]);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = audio.currentTime;
    setCurrentTime(nextTime);
    onTimeChange?.(nextTime);

    if (playingRef.current && rangeEnd > rangeStart && nextTime >= rangeEnd - 0.012) {
      stopAtBoundary();
      return;
    }

    if (!audio.paused) frameRef.current = requestAnimationFrame(tick);
  }, [onTimeChange, rangeEnd, rangeStart, stopAtBoundary]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoaded = () => {
      const nextDuration = audio.duration || 0;
      setDuration(nextDuration);
      const nextStart = playWholeAudio ? 0 : startTime ?? (nextDuration && segmentCount ? (nextDuration / segmentCount) * (segmentIndex ?? 0) : 0);
      audio.currentTime = nextStart;
      setCurrentTime(nextStart);
      onTimeChange?.(nextStart);
    };
    const handleDuration = () => setDuration(audio.duration || 0);
    const handleTime = () => {
      const nextTime = audio.currentTime;
      setCurrentTime(nextTime);
      onTimeChange?.(nextTime);
      if (playingRef.current && rangeEnd > rangeStart && nextTime >= rangeEnd - 0.012) {
        stopAtBoundary();
      }
    };
    const handleEnded = () => {
      cancelFrame();
      setIsPlaying(false);
      playingRef.current = false;
      onStop();
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("durationchange", handleDuration);
    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("ended", handleEnded);
    return () => {
      cancelFrame();
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("durationchange", handleDuration);
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [cancelFrame, onStop, onTimeChange, playWholeAudio, rangeEnd, rangeStart, segmentCount, segmentIndex, startTime, stopAtBoundary]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    cancelFrame();
    const nextStart = rangeStart;
    audio.pause();
    audio.currentTime = nextStart;
    audio.playbackRate = playbackRate;
    setCurrentTime(nextStart);
    onTimeChange?.(nextStart);
    setIsPlaying(false);
    playingRef.current = false;
  }, [audioUrl, cancelFrame, onTimeChange, playbackRate, rangeStart]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      cancelFrame();
      audio.pause();
      setIsPlaying(false);
      playingRef.current = false;
      onStop();
      return;
    }

    if (rangeEnd <= rangeStart) return;
    if (audio.currentTime < rangeStart || audio.currentTime >= rangeEnd - 0.012) {
      audio.currentTime = rangeStart;
      onTimeChange?.(rangeStart);
    }

    await audio.play();
    setIsPlaying(true);
    playingRef.current = true;
    onStart();
    frameRef.current = requestAnimationFrame(tick);
  }

  function replayRange() {
    const audio = audioRef.current;
    if (!audio) return;
    cancelFrame();
    audio.pause();
    audio.currentTime = rangeStart;
    onTimeChange?.(rangeStart);
    setIsPlaying(false);
    playingRef.current = false;
  }

  function seek(percent: number) {
    const audio = audioRef.current;
    if (!audio || !rangeDuration) return;
    const nextTime = Math.min(rangeEnd - 0.012, rangeStart + rangeDuration * percent);
    audio.currentTime = nextTime;
    onTimeChange?.(nextTime);
  }

  return (
    <div className="space-y-3">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          className="rounded-full bg-[#111827] p-4 text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
          onClick={togglePlay}
          disabled={!audioUrl}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          aria-label="Replay current range"
          className="rounded-full bg-white/80 p-3 text-slate-700 shadow-sm"
          onClick={replayRange}
        >
          <RotateCcw size={17} />
        </button>
        <div className="flex-1">
          <input
            aria-label="Audio progress"
            className="w-full accent-[#7478ff]"
            type="range"
            min={0}
            max={100}
            value={rangeProgress}
            onChange={(event) => seek(Number(event.target.value) / 100)}
          />
          <div className="mt-1 flex justify-between text-xs font-medium text-slate-500">
            <span>{formatTime(Math.max(currentTime - rangeStart, 0))}</span>
            <span>{formatTime(rangeDuration)}</span>
          </div>
        </div>
        <select
          aria-label="Playback speed"
          className="control h-10 rounded-xl px-2 text-sm font-semibold"
          value={playbackRate}
          onChange={(event) => setPlaybackRate(Number(event.target.value))}
        >
          <option value={0.75}>0.75x</option>
          <option value={1}>1.0x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2.0x</option>
        </select>
      </div>
    </div>
  );
}
