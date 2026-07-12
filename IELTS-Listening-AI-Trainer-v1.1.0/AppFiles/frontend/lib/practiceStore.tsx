"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PracticeState } from "./status";
import { loadUserPreferences } from "./userPreferences";
import { evaluateAnswer } from "./api";
import {
  AnswerRecord,
  AudioSource,
  ClozeSentenceState,
  HintRecord,
  emptyClozeSentenceState,
  emptySession,
  getPrimarySession,
  getSession,
  normalizeSession,
  questionsFromSentences,
  saveSession,
  clearSession as clearStoredSession,
  QuestionState,
  PracticeSettings,
  Sentence,
  TrainerSession
} from "./sessionStore";
import { ScoreResult } from "./scoring";
import { scoreAnswer } from "./scoring";
import { listLocalBackupRecords, saveAutomaticSessionSnapshot } from "./sessionDatabase";

type StoreState = {
  audioSource: AudioSource;
  transcript: Sentence[];
  transcriptText: string;
  sentences: Sentence[];
  currentStatus: PracticeState;
  currentSentenceIndex: number;
  userAnswers: AnswerRecord[];
  questions: QuestionState[];
  currentQuestion?: QuestionState;
  correctAnswers: string[];
  score: number;
  practiceMode: "shadowing" | "cloze" | "reading";
  practiceSettings: PracticeSettings;
  clozeDraft: Record<string, string>;
  clozeSentenceStates: Record<string, ClozeSentenceState>;
  hintHistory: HintRecord[];
  replayCounts: Record<string, number>;
  favoriteSentenceIds: string[];
  lastScore?: number;
  session: TrainerSession;
};

type StoreActions = {
  setCurrentStatus: (status: PracticeState, score?: number) => void;
  setPipelineError: (error: string) => void;
  beginTranscription: (audioSource: AudioSource) => void;
  setCurrentSentenceIndex: (index: number) => void;
  setViewedSentenceId: (sentenceId: string) => void;
  setSessionFromTranscription: (session: TrainerSession) => void;
  updateCurrentAnswer: (answer: string) => void;
  retryShadowingSentence: (sentenceId: string) => void;
  updatePracticeSettings: (patch: Partial<PracticeSettings>) => void;
  updateClozeDraft: (draft: Record<string, string>) => void;
  updateClozeSentenceState: (sentenceId: string, patch: Partial<ClozeSentenceState>) => void;
  retryCloze: () => void;
  retryClozeSentence: (sentenceId: string) => void;
  recordHint: (blankId: string, sentenceId: string, type: HintRecord["type"]) => void;
  recordReplay: (sentenceId: string) => void;
  toggleFavorite: (sentenceId: string) => void;
  startShadowing: () => void;
  startCloze: () => void;
  startReading: () => void;
  submitCurrentAnswer: (mode: AnswerRecord["mode"], answer: string) => Promise<void>;
  submitClozeAnswerSet: (answer: string, reference?: string) => Promise<void>;
  submitClozeSentence: (sentenceId: string, answer: string, reference: string) => Promise<void>;
  nextSentence: () => void;
  previousSentence: () => void;
  addStudySeconds: (seconds: number) => void;
  clearSession: () => void;
  restoreSession: (session: TrainerSession) => void;
  refreshFromStorage: () => void;
};

type PracticeStoreValue = StoreState & StoreActions;

const PracticeStoreContext = createContext<PracticeStoreValue | null>(null);

function attemptId(mode: AnswerRecord["mode"], sentenceId: string) {
  return `${mode}-${sentenceId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function updateRecentSourceHistory(audioSource: AudioSource) {
  const preferences = loadUserPreferences();
  const key = "ielts-recent-audio-sources-v1";
  if (!preferences.privacy.retainRecentFiles) {
    window.localStorage.removeItem(key);
    return;
  }
  const entry = {
    type: audioSource.type,
    name: preferences.privacy.retainFileNames ? audioSource.name : audioSource.type === "url" ? "Imported audio" : "Local audio",
    url: preferences.privacy.retainUrls ? audioSource.url : undefined,
    importedAt: new Date().toISOString()
  };
  try {
    const current = JSON.parse(window.localStorage.getItem(key) || "[]") as typeof entry[];
    window.localStorage.setItem(key, JSON.stringify([entry, ...current].slice(0, 10)));
  } catch {
    window.localStorage.setItem(key, JSON.stringify([entry]));
  }
}

function deriveState(session: TrainerSession, currentStatus: PracticeState, currentSentenceIndex: number, lastScore?: number): StoreState {
  return {
    audioSource: session.audioSource,
    transcript: session.sentences,
    transcriptText: session.transcript,
    sentences: session.sentences,
    currentStatus,
    currentSentenceIndex,
    userAnswers: session.answers,
    questions: session.questions,
    currentQuestion: session.questions[currentSentenceIndex],
    correctAnswers: session.correctAnswers,
    score: session.score,
    practiceMode: session.practiceMode,
    practiceSettings: session.practiceSettings,
    clozeDraft: session.clozeDraft,
    clozeSentenceStates: session.clozeSentenceStates,
    hintHistory: session.hintHistory,
    replayCounts: session.replayCounts,
    favoriteSentenceIds: session.favoriteSentenceIds,
    lastScore,
    session
  };
}

export function PracticeStoreProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<TrainerSession>(() => emptySession());
  const [currentStatus, setCurrentStatusState] = useState<PracticeState>("IDLE");
  const [currentSentenceIndex, setCurrentSentenceIndexState] = useState(0);
  const [lastScore, setLastScore] = useState<number | undefined>();

  const refreshFromStorage = useCallback(() => {
    if (!loadUserPreferences().practice.resumeLastSession) {
      setSession(emptySession());
      setCurrentSentenceIndexState(0);
      setLastScore(undefined);
      setCurrentStatusState("IDLE");
      return;
    }
    const stored = getSession();
    setSession(stored);
    setCurrentSentenceIndexState(Math.min(stored.currentSentenceIndex, Math.max(stored.sentences.length - 1, 0)));
    setLastScore(stored.score || undefined);
    const restoredStatus =
      stored.status === "UPLOADING" ||
      stored.status === "TRANSCRIBING" ||
      stored.status === "ALIGNING" ||
      stored.status === "EVALUATING" ||
      stored.status === "BACKUP_WORKING" ||
      stored.status === "LISTENING" ||
      stored.status === "ANSWERING"
        ? stored.sentences.length
          ? "READY"
          : "IDLE"
        : stored.status;
    setCurrentStatusState(restoredStatus);
  }, []);

  useEffect(() => {
    refreshFromStorage();
    if (!loadUserPreferences().practice.resumeLastSession) return;
    let active = true;
    void getPrimarySession().then((primary) => {
      if (!active || !primary) return;
      const mirror = getSession();
      const primaryIsNewer = new Date(primary.updatedAt).getTime() > new Date(mirror.updatedAt).getTime();
      if (!mirror.sentences.length || primaryIsNewer) {
        const restoredStatus: PracticeState =
          primary.status === "UPLOADING" ||
          primary.status === "TRANSCRIBING" ||
          primary.status === "ALIGNING" ||
          primary.status === "EVALUATING" ||
          primary.status === "BACKUP_WORKING" ||
          primary.status === "LISTENING" ||
          primary.status === "ANSWERING"
            ? primary.sentences.length
              ? "READY"
              : "IDLE"
            : primary.status;
        setSession(primary);
        setCurrentSentenceIndexState(primary.currentSentenceIndex);
        setLastScore(primary.score || undefined);
        setCurrentStatusState(restoredStatus);
      }
    });
    return () => {
      active = false;
    };
  }, [refreshFromStorage]);

  useEffect(() => {
    if (!session.sentences.length) return;
    const backup = loadUserPreferences().backup;
    if (backup.autoBackup === "off") return;
    const interval = backup.autoBackup === "daily" ? 86_400_000 : backup.autoBackup === "weekly" ? 604_800_000 : 2_592_000_000;
    void listLocalBackupRecords().then((records) => {
      const snapshots = records.filter((record) => record.type === "automatic");
      const lastTime = snapshots.length ? new Date(snapshots[snapshots.length - 1].createdAt).getTime() : 0;
      if (Date.now() - lastTime < interval) return;
      return saveAutomaticSessionSnapshot(session, backup.retentionCount);
    }).catch(() => undefined);
  }, [session]);

  const setCurrentStatus = useCallback((status: PracticeState, score?: number) => {
    setCurrentStatusState(status);
    if (typeof score === "number") setLastScore(score);
    setSession((current) => {
      const next = { ...current, status, score: typeof score === "number" ? score : current.score, updatedAt: new Date().toISOString() };
      saveSession(next);
      return next;
    });
  }, []);

  const setPipelineError = useCallback((error: string) => {
    setSession((current) => {
      const next: TrainerSession = {
        ...current,
        status: "ERROR",
        transcriptionDiagnostics: { ...current.transcriptionDiagnostics, status: "failed", error },
        alignmentDiagnostics: { ...current.alignmentDiagnostics, status: "failed", error },
        updatedAt: new Date().toISOString()
      };
      saveSession(next);
      return next;
    });
    setCurrentStatusState("ERROR");
  }, []);

  const beginTranscription = useCallback((audioSource: AudioSource) => {
    const preferences = loadUserPreferences();
    updateRecentSourceHistory(audioSource);
    const base = emptySession();
    const privateAudioSource: AudioSource = {
      ...audioSource,
      name: preferences.privacy.retainFileNames ? audioSource.name : audioSource.type === "url" ? "Imported audio" : "Local audio",
      url: preferences.privacy.retainUrls ? audioSource.url : undefined
    };
    const transcriptVisibility = preferences.transcript.visibility === "visible" ? "show" : preferences.transcript.visibility === "hidden" ? "hide" : "auto";
    const clozeDifficulty = preferences.cloze.style === "full-mask" ? 3 : preferences.cloze.style === "intensive" ? 2 : 1;
    const next: TrainerSession = {
      ...base,
      audioSource: privateAudioSource,
      sourceName: privateAudioSource.name,
      sourceUrl: privateAudioSource.url,
      audioCacheKey: audioSource.cacheKey,
      status: "TRANSCRIBING",
      practiceMode: preferences.practice.defaultMode,
      practiceSettings: {
        ...base.practiceSettings,
        playbackMode: preferences.practice.playbackMode === "sentence-loop" ? "sentence" : "full",
        loopCount: preferences.practice.loopCount,
        replayInterval: preferences.practice.replayIntervalSeconds,
        playbackRate: preferences.practice.playbackRate,
        transcriptVisibility,
        followAudio: preferences.transcript.followAudio,
        clozeDifficulty
      },
      transcriptionDiagnostics: { status: "transcribing" },
      alignmentDiagnostics: { status: "waiting" }
    };
    saveSession(next);
    setSession(next);
    setCurrentSentenceIndexState(0);
    setLastScore(undefined);
    setCurrentStatusState("TRANSCRIBING");
  }, []);

  const setCurrentSentenceIndex = useCallback((index: number) => {
    setSession((current) => {
      const bounded = Math.max(0, Math.min(index, Math.max(current.sentences.length - 1, 0)));
      const sentenceId = current.sentences[bounded]?.id;
      const restoredScore = current.practiceMode === "reading"
        ? undefined
        : current.practiceMode === "cloze"
          ? sentenceId
            ? current.clozeSentenceStates[sentenceId]?.score
            : undefined
          : current.questions[bounded]?.score;
      const hasSavedResult = current.practiceMode === "reading"
        ? false
        : current.practiceMode === "cloze"
          ? Boolean(sentenceId && current.clozeSentenceStates[sentenceId]?.submittedAt)
          : Boolean(current.questions[bounded]?.submittedAt);
      const status: PracticeState =
        current.status === "LISTENING" && current.practiceSettings.playbackMode === "full"
          ? "LISTENING"
          : hasSavedResult
            ? "RESULT"
            : current.practiceMode === "cloze"
              ? "PRACTICE_CLOZE"
              : current.practiceMode === "reading"
                ? "PRACTICE_READING"
                : "PRACTICE_SHADOWING";
      const next = { ...current, currentSentenceIndex: bounded, currentSentenceId: sentenceId, status, updatedAt: new Date().toISOString() };
      saveSession(next);
      setCurrentSentenceIndexState(bounded);
      setLastScore(restoredScore);
      setCurrentStatusState(status);
      return next;
    });
  }, []);

  const setViewedSentenceId = useCallback((sentenceId: string) => {
    setSession((current) => {
      if (current.viewedSentenceId === sentenceId) return current;
      const next = { ...current, viewedSentenceId: sentenceId, updatedAt: new Date().toISOString() };
      saveSession(next);
      return next;
    });
  }, []);

  const setSessionFromTranscription = useCallback((nextSession: TrainerSession) => {
    const preferences = loadUserPreferences();
    const privateName = preferences.privacy.retainFileNames
      ? nextSession.audioSource.name
      : nextSession.audioSource.type === "url" ? "Imported audio" : "Local audio";
    setSession((current) => {
      const normalized: TrainerSession = {
        ...nextSession,
        id: current.id,
        audioSource: { ...nextSession.audioSource, name: privateName, url: preferences.privacy.retainUrls ? nextSession.audioSource.url : undefined },
        sourceName: privateName,
        sourceUrl: preferences.privacy.retainUrls ? nextSession.sourceUrl : undefined,
        correctAnswers: nextSession.sentences.map((sentence) => sentence.text),
        questions: questionsFromSentences(nextSession.sentences),
        currentSentenceIndex: 0,
        currentSentenceId: nextSession.sentences[0]?.id,
        viewedSentenceId: nextSession.sentences[0]?.id,
        practiceMode: current.practiceMode,
        practiceSettings: current.practiceSettings,
        status: nextSession.sentences.length ? "READY" : "IDLE",
        score: 0,
        clozeDraft: {},
        clozeSubmittedAt: undefined,
        clozeSentenceStates: {},
        startedAt: current.startedAt,
        updatedAt: new Date().toISOString()
      };
      saveSession(normalized);
      setCurrentSentenceIndexState(0);
      setLastScore(undefined);
      setCurrentStatusState(normalized.status);
      return normalized;
    });
  }, []);

  const restoreSession = useCallback((importedSession: TrainerSession) => {
    const restored = normalizeSession(importedSession);
    const restoredStatus: PracticeState = restored.sentences.length
      ? restored.status === "UPLOADING" ||
        restored.status === "TRANSCRIBING" ||
        restored.status === "ALIGNING" ||
        restored.status === "EVALUATING" ||
        restored.status === "BACKUP_WORKING" ||
        restored.status === "LISTENING" ||
        restored.status === "ANSWERING"
        ? "READY"
        : restored.status
      : "IDLE";
    const next = { ...restored, status: restoredStatus, updatedAt: new Date().toISOString() };
    saveSession(next);
    setSession(next);
    setCurrentSentenceIndexState(next.currentSentenceIndex);
    setLastScore(next.score || undefined);
    setCurrentStatusState(restoredStatus);
  }, []);

  const updateCurrentAnswer = useCallback((answer: string) => {
    setSession((current) => {
      const questions = current.questions.length === current.sentences.length ? current.questions : questionsFromSentences(current.sentences);
      const nextQuestions = questions.map((question, index) =>
        index === current.currentSentenceIndex ? { ...question, userAnswer: answer } : question
      );
      const next = { ...current, questions: nextQuestions, updatedAt: new Date().toISOString() };
      saveSession(next);
      return next;
    });
  }, []);

  const retryShadowingSentence = useCallback((sentenceId: string) => {
    setSession((current) => {
      const targetIndex = current.sentences.findIndex((sentence) => sentence.id === sentenceId);
      if (targetIndex < 0) return current;
      const questions = current.questions.map((question, index) =>
        index === targetIndex
          ? { ...question, userAnswer: "", score: undefined, mistakes: [], submittedAt: undefined }
          : question
      );
      const next = {
        ...current,
        questions,
        currentSentenceIndex: targetIndex,
        currentSentenceId: current.sentences[targetIndex]?.id,
        practiceMode: "shadowing" as const,
        status: "PRACTICE_SHADOWING" as PracticeState,
        updatedAt: new Date().toISOString()
      };
      saveSession(next);
      setCurrentSentenceIndexState(targetIndex);
      return next;
    });
    setLastScore(undefined);
    setCurrentStatusState("PRACTICE_SHADOWING");
  }, []);

  const updatePracticeSettings = useCallback((patch: Partial<PracticeSettings>) => {
    setSession((current) => {
      const resetsCloze = typeof patch.clozeDifficulty === "number" && patch.clozeDifficulty !== current.practiceSettings.clozeDifficulty;
      const next = {
        ...current,
        practiceSettings: { ...current.practiceSettings, ...patch },
        clozeDraft: resetsCloze ? {} : current.clozeDraft,
        clozeSubmittedAt: resetsCloze ? undefined : current.clozeSubmittedAt,
        clozeSentenceStates: resetsCloze ? {} : current.clozeSentenceStates,
        status: resetsCloze && current.practiceMode === "cloze" ? ("PRACTICE_CLOZE" as PracticeState) : current.status,
        updatedAt: new Date().toISOString()
      };
      saveSession(next);
      if (resetsCloze && current.practiceMode === "cloze") {
        setCurrentStatusState("PRACTICE_CLOZE");
        setLastScore(undefined);
      }
      return next;
    });
  }, []);

  const updateClozeDraft = useCallback((draft: Record<string, string>) => {
    setSession((current) => {
      const next = { ...current, clozeDraft: draft, updatedAt: new Date().toISOString() };
      saveSession(next);
      return next;
    });
  }, []);

  const updateClozeSentenceState = useCallback((sentenceId: string, patch: Partial<ClozeSentenceState>) => {
    setSession((current) => {
      const previous = current.clozeSentenceStates[sentenceId] ?? emptyClozeSentenceState();
      const nextState: ClozeSentenceState = {
        ...previous,
        ...patch,
        blankAnswers: patch.blankAnswers ?? previous.blankAnswers,
        selectedTokenIds: patch.selectedTokenIds ?? previous.selectedTokenIds,
        mistakes: patch.mistakes ?? previous.mistakes
      };
      const next = {
        ...current,
        clozeSentenceStates: { ...current.clozeSentenceStates, [sentenceId]: nextState },
        updatedAt: new Date().toISOString()
      };
      saveSession(next);
      return next;
    });
  }, []);

  const retryCloze = useCallback(() => {
    setSession((current) => {
      const next = {
        ...current,
        clozeDraft: {},
        clozeSubmittedAt: undefined,
        practiceMode: "cloze" as const,
        status: "PRACTICE_CLOZE" as PracticeState,
        updatedAt: new Date().toISOString()
      };
      saveSession(next);
      return next;
    });
    setLastScore(undefined);
    setCurrentStatusState("PRACTICE_CLOZE");
  }, []);

  const retryClozeSentence = useCallback((sentenceId: string) => {
    setSession((current) => {
      const previous = current.clozeSentenceStates[sentenceId] ?? emptyClozeSentenceState();
      const nextState: ClozeSentenceState = {
        ...emptyClozeSentenceState(),
        attemptCount: previous.attemptCount,
        hintsUsed: previous.hintsUsed,
        attempts: previous.attempts
      };
      const next = {
        ...current,
        clozeSentenceStates: { ...current.clozeSentenceStates, [sentenceId]: nextState },
        practiceMode: "cloze" as const,
        status: "PRACTICE_CLOZE" as PracticeState,
        updatedAt: new Date().toISOString()
      };
      saveSession(next);
      return next;
    });
    setLastScore(undefined);
    setCurrentStatusState("PRACTICE_CLOZE");
  }, []);

  const recordHint = useCallback((blankId: string, sentenceId: string, type: HintRecord["type"]) => {
    setSession((current) => {
      const previous = current.clozeSentenceStates[sentenceId] ?? emptyClozeSentenceState();
      const next = {
        ...current,
        hintHistory: [...current.hintHistory, { blankId, sentenceId, type, createdAt: new Date().toISOString() }],
        clozeSentenceStates: {
          ...current.clozeSentenceStates,
          [sentenceId]: { ...previous, hintsUsed: previous.hintsUsed + 1 }
        },
        updatedAt: new Date().toISOString()
      };
      saveSession(next);
      return next;
    });
  }, []);

  const recordReplay = useCallback((sentenceId: string) => {
    setSession((current) => {
      const next = {
        ...current,
        replayCounts: { ...current.replayCounts, [sentenceId]: (current.replayCounts[sentenceId] ?? 0) + 1 },
        updatedAt: new Date().toISOString()
      };
      saveSession(next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((sentenceId: string) => {
    setSession((current) => {
      const favoriteSentenceIds = current.favoriteSentenceIds.includes(sentenceId)
        ? current.favoriteSentenceIds.filter((id) => id !== sentenceId)
        : [...current.favoriteSentenceIds, sentenceId];
      const next = { ...current, favoriteSentenceIds, updatedAt: new Date().toISOString() };
      saveSession(next);
      return next;
    });
  }, []);

  const startShadowing = useCallback(() => {
    setSession((current) => {
      const next = { ...current, practiceMode: "shadowing" as const, status: "PRACTICE_SHADOWING" as PracticeState, updatedAt: new Date().toISOString() };
      saveSession(next);
      return next;
    });
    setCurrentStatusState("PRACTICE_SHADOWING");
  }, [setCurrentStatus]);

  const startCloze = useCallback(() => {
    setSession((current) => {
      const next = { ...current, practiceMode: "cloze" as const, status: "PRACTICE_CLOZE" as PracticeState, updatedAt: new Date().toISOString() };
      saveSession(next);
      return next;
    });
    setCurrentStatusState("PRACTICE_CLOZE");
  }, []);

  const startReading = useCallback(() => {
    setSession((current) => {
      const next = { ...current, practiceMode: "reading" as const, status: "PRACTICE_READING" as PracticeState, updatedAt: new Date().toISOString() };
      saveSession(next);
      return next;
    });
    setLastScore(undefined);
    setCurrentStatusState("PRACTICE_READING");
  }, []);

  const submitCurrentAnswer = useCallback(
    async (mode: AnswerRecord["mode"], answer: string) => {
      const sentence = session.sentences[currentSentenceIndex];
      if (!sentence) return;
      setCurrentStatus("EVALUATING");
      let result: ScoreResult;
      const currentQuestions = session.questions.length === session.sentences.length ? session.questions : questionsFromSentences(session.sentences);
      const referenceAnswer = currentQuestions[currentSentenceIndex]?.correctAnswer ?? session.correctAnswers[currentSentenceIndex] ?? sentence.text;
      const evaluationStartedAt = Date.now();
      try {
        result = await evaluateAnswer(referenceAnswer, answer);
      } catch {
        result = scoreAnswer(referenceAnswer, answer);
      }
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(0, 600 - (Date.now() - evaluationStartedAt))));
      const submittedAt = new Date().toISOString();
      const preferences = loadUserPreferences();
      const id = attemptId(mode, sentence.id);
      const attempt = {
        id,
        answer,
        score: result.score,
        mistakes: result.mistakes,
        createdAt: submittedAt,
        replayCount: session.replayCounts[sentence.id] ?? 0,
        hintUsage: 0
      };
      const nextQuestions = currentQuestions.map((question, index) =>
        index === currentSentenceIndex
          ? {
              ...question,
              userAnswer: answer,
              score: result.score,
              mistakes: result.mistakes,
              submittedAt,
              attempts: preferences.practice.saveAllAttempts ? [...question.attempts, attempt] : [attempt]
            }
          : question
      );
      const answerRecord = {
        id,
        sentenceId: sentence.id,
        mode,
        answer,
        score: result.score,
        mistakes: result.mistakes,
        createdAt: submittedAt,
        replayCount: attempt.replayCount,
        hintUsage: attempt.hintUsage
      };
      const nextSession: TrainerSession = {
        ...session,
        questions: nextQuestions,
        answers: preferences.practice.saveAllAttempts ? [...session.answers, answerRecord] : [...session.answers.filter((item) => item.mode !== mode || item.sentenceId !== sentence.id), answerRecord],
        score: result.score,
        practiceMode: session.practiceMode,
        status: "RESULT",
        updatedAt: new Date().toISOString()
      };
      saveSession(nextSession);
      setSession(nextSession);
      setLastScore(result.score);
      setCurrentStatusState("RESULT");
      if (preferences.practice.autoNext && result.score >= 70 && currentSentenceIndex < session.sentences.length - 1) {
        window.setTimeout(() => setCurrentSentenceIndex(currentSentenceIndex + 1), 450);
      }
    },
    [currentSentenceIndex, session, setCurrentSentenceIndex]
  );

  const submitClozeAnswerSet = useCallback(
    async (answer: string, reference?: string) => {
      const target = reference?.trim() || session.transcript.trim();
      if (!target) return;
      setCurrentStatus("EVALUATING");
      let result: ScoreResult;
      const evaluationStartedAt = Date.now();
      try {
        result = await evaluateAnswer(target, answer);
      } catch {
        result = scoreAnswer(target, answer);
      }
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(0, 600 - (Date.now() - evaluationStartedAt))));
      const submittedAt = new Date().toISOString();
      const preferences = loadUserPreferences();
      const answerRecord: AnswerRecord = {
        id: attemptId("cloze", "full-cloze"),
        sentenceId: "full-cloze",
        mode: "cloze",
        answer,
        score: result.score,
        mistakes: result.mistakes,
        createdAt: submittedAt,
        replayCount: Object.values(session.replayCounts).reduce((total, count) => total + count, 0),
        hintUsage: session.hintHistory.length
      };
      const nextSession: TrainerSession = {
        ...session,
        answers: preferences.practice.saveAllAttempts
          ? [...session.answers, answerRecord]
          : [...session.answers.filter((item) => item.mode !== "cloze" || item.sentenceId !== "full-cloze"), answerRecord],
        score: result.score,
        practiceMode: "cloze",
        clozeSubmittedAt: submittedAt,
        status: "RESULT",
        updatedAt: submittedAt
      };
      saveSession(nextSession);
      setSession(nextSession);
      setLastScore(result.score);
      setCurrentStatusState("RESULT");
    },
    [session, setCurrentStatus]
  );

  const submitClozeSentence = useCallback(
    async (sentenceId: string, answer: string, reference: string) => {
      const target = reference.trim();
      if (!target || !sentenceId) return;
      setCurrentStatus("EVALUATING");
      let result: ScoreResult;
      const evaluationStartedAt = Date.now();
      try {
        result = await evaluateAnswer(target, answer);
      } catch {
        result = scoreAnswer(target, answer);
      }
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(0, 600 - (Date.now() - evaluationStartedAt))));

      const submittedAt = new Date().toISOString();
      const id = attemptId("cloze", sentenceId);
      const previousHintUsage = session.clozeSentenceStates[sentenceId]?.hintsUsed ?? 0;
      const attempt = {
        id,
        answer,
        score: result.score,
        mistakes: result.mistakes,
        createdAt: submittedAt,
        replayCount: session.replayCounts[sentenceId] ?? 0,
        hintUsage: previousHintUsage
      };
      const preferences = loadUserPreferences();
      setSession((current) => {
        const previous = current.clozeSentenceStates[sentenceId] ?? emptyClozeSentenceState();
        const answerRecord: AnswerRecord = {
          id,
          sentenceId,
          mode: "cloze",
          answer,
          score: result.score,
          mistakes: result.mistakes,
          createdAt: submittedAt,
          replayCount: attempt.replayCount,
          hintUsage: attempt.hintUsage
        };
        const next: TrainerSession = {
          ...current,
          answers: preferences.practice.saveAllAttempts ? [...current.answers, answerRecord] : [...current.answers.filter((item) => item.mode !== "cloze" || item.sentenceId !== sentenceId), answerRecord],
          clozeSentenceStates: {
            ...current.clozeSentenceStates,
            [sentenceId]: {
              ...previous,
              score: result.score,
              mistakes: result.mistakes,
              submittedAt,
              attemptCount: previous.attemptCount + 1,
              attempts: preferences.practice.saveAllAttempts ? [...previous.attempts, attempt] : [attempt]
            }
          },
          score: result.score,
          practiceMode: "cloze",
          status: "RESULT",
          updatedAt: submittedAt
        };
        saveSession(next);
        return next;
      });
      setLastScore(result.score);
      setCurrentStatusState("RESULT");
      const sentenceIndex = session.sentences.findIndex((item) => item.id === sentenceId);
      if (preferences.practice.autoNext && result.score >= 70 && sentenceIndex >= 0 && sentenceIndex < session.sentences.length - 1) {
        window.setTimeout(() => setCurrentSentenceIndex(sentenceIndex + 1), 450);
      }
    },
    [session.sentences, setCurrentSentenceIndex, setCurrentStatus]
  );

  const nextSentence = useCallback(() => {
    setCurrentSentenceIndex(currentSentenceIndex + 1);
  }, [currentSentenceIndex, setCurrentSentenceIndex]);

  const previousSentence = useCallback(() => {
    setCurrentSentenceIndex(currentSentenceIndex - 1);
  }, [currentSentenceIndex, setCurrentSentenceIndex]);

  const addStudySeconds = useCallback((seconds: number) => {
    setSession((current) => {
      const next = { ...current, studySeconds: current.studySeconds + seconds, updatedAt: new Date().toISOString() };
      saveSession(next);
      return next;
    });
  }, []);

  const clearSession = useCallback(() => {
    clearStoredSession();
    setSession(emptySession());
    setCurrentSentenceIndexState(0);
    setLastScore(undefined);
    setCurrentStatusState("IDLE");
  }, []);

  const value = useMemo<PracticeStoreValue>(
    () => ({
      ...deriveState(session, currentStatus, currentSentenceIndex, lastScore),
      setCurrentStatus,
      setPipelineError,
      beginTranscription,
      setCurrentSentenceIndex,
      setViewedSentenceId,
      setSessionFromTranscription,
      updateCurrentAnswer,
      retryShadowingSentence,
      updatePracticeSettings,
      updateClozeDraft,
      updateClozeSentenceState,
      retryCloze,
      retryClozeSentence,
      recordHint,
      recordReplay,
      toggleFavorite,
      startShadowing,
      startCloze,
      startReading,
      submitCurrentAnswer,
      submitClozeAnswerSet,
      submitClozeSentence,
      nextSentence,
      previousSentence,
      addStudySeconds,
      clearSession,
      restoreSession,
      refreshFromStorage
    }),
    [
      session,
      currentStatus,
      currentSentenceIndex,
      lastScore,
      setCurrentStatus,
      setPipelineError,
      beginTranscription,
      setCurrentSentenceIndex,
      setViewedSentenceId,
      setSessionFromTranscription,
      updateCurrentAnswer,
      retryShadowingSentence,
      updatePracticeSettings,
      updateClozeDraft,
      updateClozeSentenceState,
      retryCloze,
      retryClozeSentence,
      recordHint,
      recordReplay,
      toggleFavorite,
      startShadowing,
      startCloze,
      startReading,
      submitCurrentAnswer,
      submitClozeAnswerSet,
      submitClozeSentence,
      nextSentence,
      previousSentence,
      addStudySeconds,
      clearSession,
      restoreSession,
      refreshFromStorage
    ]
  );

  return <PracticeStoreContext.Provider value={value}>{children}</PracticeStoreContext.Provider>;
}

export function usePracticeStore() {
  const value = useContext(PracticeStoreContext);
  if (!value) throw new Error("usePracticeStore must be used inside PracticeStoreProvider");
  return value;
}
