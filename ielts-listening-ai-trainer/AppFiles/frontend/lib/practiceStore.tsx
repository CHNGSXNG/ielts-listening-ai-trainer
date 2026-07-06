"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PracticeState } from "./status";
import { evaluateAnswer } from "./api";
import {
  AnswerRecord,
  AudioSource,
  emptySession,
  getSession,
  normalizeSession,
  questionsFromSentences,
  saveSession,
  clearSession as clearStoredSession,
  QuestionState,
  Sentence,
  TrainerSession
} from "./sessionStore";
import { ScoreResult } from "./scoring";
import { scoreAnswer } from "./scoring";

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
  practiceMode: "shadowing" | "cloze";
  lastScore?: number;
  session: TrainerSession;
};

type StoreActions = {
  setCurrentStatus: (status: PracticeState, score?: number) => void;
  setCurrentSentenceIndex: (index: number) => void;
  setSessionFromTranscription: (session: TrainerSession) => void;
  updateCurrentAnswer: (answer: string) => void;
  startShadowing: () => void;
  startCloze: () => void;
  submitCurrentAnswer: (mode: AnswerRecord["mode"], answer: string) => Promise<void>;
  submitClozeAnswerSet: (answer: string) => Promise<void>;
  nextSentence: () => void;
  previousSentence: () => void;
  addStudySeconds: (seconds: number) => void;
  clearSession: () => void;
  refreshFromStorage: () => void;
};

type PracticeStoreValue = StoreState & StoreActions;

const PracticeStoreContext = createContext<PracticeStoreValue | null>(null);

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
    const stored = getSession();
    setSession(stored);
    setCurrentSentenceIndexState(Math.min(stored.currentSentenceIndex, Math.max(stored.sentences.length - 1, 0)));
    setLastScore(stored.score || undefined);
    const restoredStatus =
      stored.status === "UPLOADING" || stored.status === "TRANSCRIBING" || stored.status === "EVALUATING"
        ? stored.sentences.length
          ? "READY"
          : "IDLE"
        : stored.status;
    setCurrentStatusState(restoredStatus);
  }, []);

  useEffect(() => {
    refreshFromStorage();
  }, [refreshFromStorage]);

  const setCurrentStatus = useCallback((status: PracticeState, score?: number) => {
    setCurrentStatusState(status);
    if (typeof score === "number") setLastScore(score);
    setSession((current) => {
      const next = { ...current, status, score: typeof score === "number" ? score : current.score, updatedAt: new Date().toISOString() };
      saveSession(next);
      return next;
    });
  }, []);

  const setCurrentSentenceIndex = useCallback((index: number) => {
    setSession((current) => {
      const bounded = Math.max(0, Math.min(index, Math.max(current.sentences.length - 1, 0)));
      const status: PracticeState = current.practiceMode === "cloze" ? "PRACTICE_CLOZE" : "PRACTICE_SHADOWING";
      const next = { ...current, currentSentenceIndex: bounded, status, updatedAt: new Date().toISOString() };
      saveSession(next);
      setCurrentSentenceIndexState(bounded);
      setLastScore(next.questions[bounded]?.score);
      setCurrentStatusState(status);
      return next;
    });
  }, []);

  const setSessionFromTranscription = useCallback((nextSession: TrainerSession) => {
    const normalized: TrainerSession = {
      ...nextSession,
      correctAnswers: nextSession.sentences.map((sentence) => sentence.text),
      questions: questionsFromSentences(nextSession.sentences),
      currentSentenceIndex: 0,
      practiceMode: nextSession.practiceMode ?? "shadowing",
      status: nextSession.sentences.length ? "READY" : "IDLE",
      score: 0,
      updatedAt: new Date().toISOString()
    };
    saveSession(normalized);
    setSession(normalized);
    setCurrentSentenceIndexState(0);
    setLastScore(undefined);
    setCurrentStatusState(normalized.status);
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

  const submitCurrentAnswer = useCallback(
    async (mode: AnswerRecord["mode"], answer: string) => {
      const sentence = session.sentences[currentSentenceIndex];
      if (!sentence) return;
      setCurrentStatus("EVALUATING");
      let result: ScoreResult;
      const currentQuestions = session.questions.length === session.sentences.length ? session.questions : questionsFromSentences(session.sentences);
      const referenceAnswer = currentQuestions[currentSentenceIndex]?.correctAnswer ?? session.correctAnswers[currentSentenceIndex] ?? sentence.text;
      try {
        result = await evaluateAnswer(referenceAnswer, answer);
      } catch {
        result = scoreAnswer(referenceAnswer, answer);
      }
      const submittedAt = new Date().toISOString();
      const nextQuestions = currentQuestions.map((question, index) =>
        index === currentSentenceIndex
          ? {
              ...question,
              userAnswer: answer,
              score: result.score,
              mistakes: result.mistakes,
              submittedAt
            }
          : question
      );
      const answerRecord = {
        sentenceId: sentence.id,
        mode,
        answer,
        score: result.score,
        mistakes: result.mistakes,
        createdAt: submittedAt
      };
      const nextSession: TrainerSession = {
        ...session,
        questions: nextQuestions,
        answers: [...session.answers.filter((item) => !(item.sentenceId === sentence.id && item.mode === mode)), answerRecord],
        score: result.score,
        practiceMode: session.practiceMode,
        status: "RESULT",
        updatedAt: new Date().toISOString()
      };
      saveSession(nextSession);
      setSession(nextSession);
      setLastScore(result.score);
      setCurrentStatusState("RESULT");
    },
    [currentSentenceIndex, session]
  );

  const submitClozeAnswerSet = useCallback(
    async (answer: string) => {
      if (!session.transcript.trim()) return;
      setCurrentStatus("EVALUATING");
      let result: ScoreResult;
      try {
        result = await evaluateAnswer(session.transcript, answer);
      } catch {
        result = scoreAnswer(session.transcript, answer);
      }
      const nextSession: TrainerSession = {
        ...session,
        answers: [
          ...session.answers,
          {
            sentenceId: "full-cloze",
            mode: "cloze",
            answer,
            score: result.score,
            mistakes: result.mistakes,
            createdAt: new Date().toISOString()
          }
        ],
        score: result.score,
        practiceMode: "cloze",
        status: "RESULT",
        updatedAt: new Date().toISOString()
      };
      saveSession(nextSession);
      setSession(nextSession);
      setLastScore(result.score);
      setCurrentStatusState("RESULT");
    },
    [session, setCurrentStatus]
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
      setCurrentSentenceIndex,
      setSessionFromTranscription,
      updateCurrentAnswer,
      startShadowing,
      startCloze,
      submitCurrentAnswer,
      submitClozeAnswerSet,
      nextSentence,
      previousSentence,
      addStudySeconds,
      clearSession,
      refreshFromStorage
    }),
    [
      session,
      currentStatus,
      currentSentenceIndex,
      lastScore,
      setCurrentStatus,
      setCurrentSentenceIndex,
      setSessionFromTranscription,
      updateCurrentAnswer,
      startShadowing,
      startCloze,
      submitCurrentAnswer,
      submitClozeAnswerSet,
      nextSentence,
      previousSentence,
      addStudySeconds,
      clearSession,
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
