"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ClozeResponse, EvaluationResponse, TranscriptResponse } from "@/lib/types";

type TrainerState = {
  audioName: string;
  audioUrl: string;
  transcript?: TranscriptResponse;
  cloze?: ClozeResponse;
  lastResult?: EvaluationResponse;
  setAudio: (name: string, url: string) => void;
  setTranscript: (value?: TranscriptResponse) => void;
  setCloze: (value?: ClozeResponse) => void;
  setLastResult: (value?: EvaluationResponse) => void;
};

const TrainerContext = createContext<TrainerState | null>(null);
const STORAGE_KEY = "ielts-trainer-state-clean-v1";

export function TrainerProvider({ children }: { children: React.ReactNode }) {
  const [audioName, setAudioName] = useState("IELTS sample audio");
  const [audioUrl, setAudioUrl] = useState("");
  const [transcript, setTranscript] = useState<TranscriptResponse>();
  const [cloze, setCloze] = useState<ClozeResponse>();
  const [lastResult, setLastResult] = useState<EvaluationResponse>();

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        audioName?: string;
        audioUrl?: string;
        transcript?: TranscriptResponse;
        cloze?: ClozeResponse;
        lastResult?: EvaluationResponse;
      };
      const hasRealAudio = Boolean(parsed.audioUrl);
      const hasRealTranscript = parsed.transcript?.source === "whisper";
      if (hasRealAudio && parsed.audioName) setAudioName(parsed.audioName);
      if (hasRealAudio && parsed.audioUrl) setAudioUrl(parsed.audioUrl);
      if (hasRealTranscript) setTranscript(parsed.transcript);
      if (parsed.cloze) setCloze(parsed.cloze);
      if (parsed.lastResult) setLastResult(parsed.lastResult);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ audioName, audioUrl, transcript, cloze, lastResult })
    );
  }, [audioName, audioUrl, transcript, cloze, lastResult]);

  const value = useMemo(
    () => ({
      audioName,
      audioUrl,
      transcript,
      cloze,
      lastResult,
      setAudio: (name: string, url: string) => {
        setAudioName(name);
        setAudioUrl(url);
      },
      setTranscript,
      setCloze,
      setLastResult
    }),
    [audioName, audioUrl, transcript, cloze, lastResult]
  );

  return <TrainerContext.Provider value={value}>{children}</TrainerContext.Provider>;
}

export function useTrainer() {
  const context = useContext(TrainerContext);
  if (!context) {
    throw new Error("useTrainer must be used inside TrainerProvider");
  }
  return context;
}
