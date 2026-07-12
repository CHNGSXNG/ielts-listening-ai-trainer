import { bandEstimate } from "./scoring";
import { PracticeState } from "./status";
import { clearSessionRecords, loadCurrentSessionRecord, saveSessionRecord } from "./sessionDatabase";

export type WordTimestamp = { id?: string; text: string; start: number; end: number; confidence?: number };
export type Sentence = { id: string; text: string; start?: number; end?: number; words?: WordTimestamp[] };
export type PlaybackMode = "sentence" | "full";
export type TranscriptVisibility = "show" | "hide" | "auto";
export type LoopCount = 1 | 2 | 3 | 5 | "infinite";
export type ReplayInterval = 0 | 1 | 2 | 3 | 5;
export type PlaybackRate = 0.5 | 0.75 | 0.9 | 1 | 1.1 | 1.25 | 1.5 | 2;
export type ClozeDifficulty = 1 | 2 | 3;
export type ClozeInputMode = "typing" | "word-bank";
export type PracticeSettings = {
  playbackMode: PlaybackMode;
  loopCount: LoopCount;
  replayInterval: ReplayInterval;
  playbackRate: PlaybackRate;
  transcriptVisibility: TranscriptVisibility;
  followAudio: boolean;
  clozeDifficulty: ClozeDifficulty;
  clozeInputMode: ClozeInputMode;
};
export type HintRecord = {
  blankId: string;
  sentenceId: string;
  type: "first-letter" | "word" | "sentence";
  createdAt: string;
};
export type PracticeAttempt = {
  id: string;
  answer: string;
  score: number;
  mistakes: string[];
  createdAt: string;
  replayCount?: number;
  hintUsage?: number;
};

export type AnswerRecord = PracticeAttempt & {
  sentenceId: string;
  mode: "shadowing" | "cloze";
};
export type QuestionState = {
  id: string;
  text: string;
  correctAnswer: string;
  userAnswer: string;
  score?: number;
  mistakes: string[];
  submittedAt?: string;
  attempts: PracticeAttempt[];
};

export type ClozeSentenceState = {
  blankAnswers: Record<string, string>;
  tokenOrder: string[];
  selectedTokenIds: Record<string, string>;
  attemptId: string;
  score?: number;
  mistakes: string[];
  submittedAt?: string;
  hintsUsed: number;
  attemptCount: number;
  attempts: PracticeAttempt[];
};

export type AudioSource = {
  type: "file" | "url" | "";
  name: string;
  url?: string;
  cacheKey?: string;
};

export type AudioMetadata = {
  duration?: number;
  codec?: string;
  sampleRate?: number;
  mimeType?: string;
  size?: number;
};

export type TranscriptionDiagnostics = {
  status: "idle" | "loading-model" | "transcribing" | "ready" | "failed";
  modelName?: string;
  language?: string;
  error?: string;
};

export type AlignmentDiagnostics = {
  status: "waiting" | "aligning" | "ready" | "unavailable" | "failed";
  engine?: string;
  wordCount?: number;
  error?: string;
};

export type TrainerSession = {
  id: string;
  audioSource: AudioSource;
  audioMetadata: AudioMetadata;
  transcriptionDiagnostics: TranscriptionDiagnostics;
  alignmentDiagnostics: AlignmentDiagnostics;
  transcript: string;
  sentences: Sentence[];
  questions: QuestionState[];
  correctAnswers: string[];
  currentSentenceIndex: number;
  currentSentenceId?: string;
  viewedSentenceId?: string;
  status: PracticeState;
  practiceMode: "shadowing" | "cloze" | "reading";
  score: number;
  sourceName: string;
  sourceUrl?: string;
  audioCacheKey?: string;
  answers: AnswerRecord[];
  practiceSettings: PracticeSettings;
  clozeDraft: Record<string, string>;
  clozeSubmittedAt?: string;
  clozeSentenceStates: Record<string, ClozeSentenceState>;
  hintHistory: HintRecord[];
  replayCounts: Record<string, number>;
  favoriteSentenceIds: string[];
  startedAt: string;
  updatedAt: string;
  studySeconds: number;
};

const key = "ielts-listening-session-v1";
let pendingSessionRecord: TrainerSession | null = null;
let sessionWriteWorker: Promise<void> | null = null;

function scheduleSessionRecord(session: TrainerSession) {
  pendingSessionRecord = session;
  if (sessionWriteWorker) return;

  sessionWriteWorker = (async () => {
    while (pendingSessionRecord) {
      const next = pendingSessionRecord;
      pendingSessionRecord = null;
      try {
        await saveSessionRecord(next);
      } catch {
        // localStorage remains the immediate canonical mirror when IndexedDB is unavailable.
      }
    }
  })().finally(() => {
    sessionWriteWorker = null;
    if (pendingSessionRecord) scheduleSessionRecord(pendingSessionRecord);
  });
}

export function defaultPracticeSettings(): PracticeSettings {
  return {
    playbackMode: "sentence",
    loopCount: 1,
    replayInterval: 1,
    playbackRate: 1,
    transcriptVisibility: "auto",
    followAudio: true,
    clozeDifficulty: 1,
    clozeInputMode: "typing"
  };
}

export function emptyClozeSentenceState(): ClozeSentenceState {
  return {
    blankAnswers: {},
    tokenOrder: [],
    selectedTokenIds: {},
    attemptId: "",
    mistakes: [],
    hintsUsed: 0,
    attemptCount: 0,
    attempts: []
  };
}

export function emptySession(): TrainerSession {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    audioSource: { type: "", name: "" },
    audioMetadata: {},
    transcriptionDiagnostics: { status: "idle" },
    alignmentDiagnostics: { status: "waiting" },
    transcript: "",
    sentences: [],
    questions: [],
    correctAnswers: [],
    currentSentenceIndex: 0,
    currentSentenceId: undefined,
    viewedSentenceId: undefined,
    status: "IDLE",
    practiceMode: "shadowing",
    score: 0,
    sourceName: "",
    answers: [],
    practiceSettings: defaultPracticeSettings(),
    clozeDraft: {},
    clozeSubmittedAt: undefined,
    clozeSentenceStates: {},
    hintHistory: [],
    replayCounts: {},
    favoriteSentenceIds: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    studySeconds: 0
  };
}

export function questionsFromSentences(sentences: Sentence[]): QuestionState[] {
  return sentences.map((sentence) => ({
    id: sentence.id,
    text: sentence.text,
    correctAnswer: sentence.text,
    userAnswer: "",
    mistakes: [],
    attempts: []
  }));
}

export function normalizeSession(raw: Partial<TrainerSession>): TrainerSession {
  const base = emptySession();
  const parsed = { ...base, ...raw } as TrainerSession;
  const answers = Array.isArray(parsed.answers)
    ? parsed.answers.map((answer, index) => ({
        ...answer,
        id: answer.id ?? `${answer.mode}-${answer.sentenceId}-${answer.createdAt || index}`,
        mistakes: Array.isArray(answer.mistakes) ? answer.mistakes : []
      }))
    : [];
  const questions =
    parsed.questions?.length === parsed.sentences.length
      ? parsed.questions.map((question, index) => {
          const sentenceId = parsed.sentences[index]?.id ?? question.id;
          const recordedAttempts = answers
            .filter((answer) => answer.sentenceId === sentenceId && answer.mode === "shadowing")
            .map(({ id, answer, score, mistakes, createdAt, replayCount, hintUsage }) => ({ id, answer, score, mistakes, createdAt, replayCount, hintUsage }));
          return {
            ...question,
            id: sentenceId,
            text: parsed.sentences[index]?.text ?? question.text,
            correctAnswer: parsed.sentences[index]?.text ?? question.correctAnswer,
            userAnswer: question.userAnswer ?? "",
            mistakes: question.mistakes ?? [],
            attempts: Array.isArray(question.attempts) && question.attempts.length ? question.attempts : recordedAttempts
          };
        })
      : questionsFromSentences(parsed.sentences).map((question) => {
          const attempts = answers.filter((answer) => answer.sentenceId === question.id && answer.mode === "shadowing");
          const prior = attempts.at(-1);
          return prior
            ? {
                ...question,
                userAnswer: prior.answer,
                score: prior.score,
                mistakes: prior.mistakes,
                submittedAt: prior.createdAt,
                attempts: attempts.map(({ id, answer, score, mistakes, createdAt, replayCount, hintUsage }) => ({ id, answer, score, mistakes, createdAt, replayCount, hintUsage }))
              }
            : question;
        });

  const clozeSentenceStates = Object.fromEntries(
    Object.entries(parsed.clozeSentenceStates ?? {}).map(([sentenceId, state]) => [
      sentenceId,
      {
        ...emptyClozeSentenceState(),
        ...state,
        blankAnswers: state.blankAnswers ?? {},
        tokenOrder: Array.isArray(state.tokenOrder) ? state.tokenOrder : [],
        selectedTokenIds: state.selectedTokenIds ?? {},
        attemptId: state.attemptId ?? "",
        mistakes: Array.isArray(state.mistakes) ? state.mistakes : [],
        attempts: Array.isArray(state.attempts) ? state.attempts : []
      }
    ])
  );

  const idIndex = parsed.currentSentenceId ? parsed.sentences.findIndex((sentence) => sentence.id === parsed.currentSentenceId) : -1;
  const currentSentenceIndex = idIndex >= 0
    ? idIndex
    : Math.min(parsed.currentSentenceIndex ?? 0, Math.max(parsed.sentences.length - 1, 0));

  return {
    ...parsed,
    id: parsed.id || base.id,
    questions,
    answers,
    audioMetadata: parsed.audioMetadata ?? {},
    transcriptionDiagnostics: parsed.transcriptionDiagnostics ?? { status: parsed.transcript ? "ready" : "idle" },
    alignmentDiagnostics: parsed.alignmentDiagnostics ?? {
      status: parsed.sentences.some((sentence) => sentence.words?.length) ? "ready" : "unavailable"
    },
    correctAnswers: parsed.sentences.map((sentence) => sentence.text),
    currentSentenceIndex,
    currentSentenceId: parsed.sentences[currentSentenceIndex]?.id,
    practiceMode: parsed.practiceMode ?? "shadowing",
    practiceSettings: { ...defaultPracticeSettings(), ...(parsed.practiceSettings ?? {}) },
    clozeDraft: parsed.clozeDraft ?? {},
    clozeSubmittedAt: parsed.clozeSubmittedAt,
    clozeSentenceStates,
    hintHistory: Array.isArray(parsed.hintHistory) ? parsed.hintHistory : [],
    replayCounts: parsed.replayCounts ?? {},
    favoriteSentenceIds: Array.isArray(parsed.favoriteSentenceIds) ? parsed.favoriteSentenceIds : []
  };
}

export function getSession(): TrainerSession {
  if (typeof window === "undefined") return emptySession();
  const raw = window.localStorage.getItem(key);
  if (!raw) return emptySession();
  try {
    const parsed = normalizeSession(JSON.parse(raw) as Partial<TrainerSession>);
    return parsed;
  } catch {
    return emptySession();
  }
}

export function saveSession(session: TrainerSession) {
  if (typeof window === "undefined") return;
  const persisted = { ...session, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(key, JSON.stringify(persisted));
  scheduleSessionRecord(persisted);
  window.dispatchEvent(new CustomEvent("trainer-session-updated"));
}

export async function getPrimarySession() {
  if (typeof window === "undefined") return null;
  try {
    const stored = await loadCurrentSessionRecord();
    return stored ? normalizeSession(stored) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
  pendingSessionRecord = null;
  const priorWrites = sessionWriteWorker ?? Promise.resolve();
  sessionWriteWorker = priorWrites
    .catch(() => undefined)
    .then(() => clearSessionRecords())
    .catch(() => undefined)
    .finally(() => {
      sessionWriteWorker = null;
      if (pendingSessionRecord) scheduleSessionRecord(pendingSessionRecord);
    });
  window.dispatchEvent(new CustomEvent("trainer-session-updated"));
}

export function sessionAverage(session: TrainerSession) {
  return attemptMetrics(session).latestAverage;
}

export function sessionBand(session: TrainerSession) {
  return bandEstimate(sessionAverage(session));
}

export function attemptMetrics(session: TrainerSession) {
  const groups = new Map<string, AnswerRecord[]>();
  [...session.answers]
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .forEach((attempt) => {
      const key = `${attempt.mode}:${attempt.sentenceId}`;
      groups.set(key, [...(groups.get(key) ?? []), attempt]);
    });

  const grouped = Array.from(groups.values());
  const average = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);
  return {
    practisedSentences: new Set(session.answers.filter((answer) => answer.sentenceId !== "full-cloze" && !answer.sentenceId.endsWith(":full-cloze")).map((answer) => answer.sentenceId)).size,
    totalAttempts: session.answers.length,
    firstAverage: average(grouped.map((attempts) => attempts[0].score)),
    bestAverage: average(grouped.map((attempts) => Math.max(...attempts.map((attempt) => attempt.score)))),
    latestAverage: average(grouped.map((attempts) => attempts[attempts.length - 1].score)),
    trend: [...session.answers]
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .map((attempt) => attempt.score)
  };
}

export function estimatedBandRange(session: TrainerSession) {
  if (!session.answers.length) return "--";
  const estimate = bandEstimate(attemptMetrics(session).latestAverage);
  const lower = Math.max(1, estimate - 0.5).toFixed(1);
  const upper = Math.min(9, estimate + 0.5).toFixed(1);
  return `${lower}–${upper}`;
}

export function mistakeCounts(session: TrainerSession) {
  return session.answers.reduce<Record<string, number>>((acc, answer) => {
    answer.mistakes.forEach((mistake) => {
      acc[mistake] = (acc[mistake] ?? 0) + 1;
    });
    return acc;
  }, {});
}

export function recommendation(session: TrainerSession) {
  const counts = mistakeCounts(session);
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name]) => name);
  if (top.includes("numbers")) return "Focus on numbers and dates";
  if (top[0]) return `Focus on ${top[0]}`;
  return "Complete one practice round to unlock a recommendation";
}
