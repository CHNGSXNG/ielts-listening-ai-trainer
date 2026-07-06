import { bandEstimate } from "./scoring";
import { PracticeState } from "./status";

export type WordTimestamp = { text: string; start: number; end: number };
export type Sentence = { id: string; text: string; start?: number; end?: number; words?: WordTimestamp[] };
export type AnswerRecord = {
  sentenceId: string;
  mode: "shadowing" | "cloze";
  answer: string;
  score: number;
  mistakes: string[];
  createdAt: string;
};
export type QuestionState = {
  id: string;
  text: string;
  correctAnswer: string;
  userAnswer: string;
  score?: number;
  mistakes: string[];
  submittedAt?: string;
};

export type AudioSource = {
  type: "file" | "url" | "";
  name: string;
  url?: string;
  cacheKey?: string;
};

export type TrainerSession = {
  audioSource: AudioSource;
  transcript: string;
  sentences: Sentence[];
  questions: QuestionState[];
  correctAnswers: string[];
  currentSentenceIndex: number;
  status: PracticeState;
  practiceMode: "shadowing" | "cloze";
  score: number;
  sourceName: string;
  sourceUrl?: string;
  audioCacheKey?: string;
  answers: AnswerRecord[];
  startedAt: string;
  updatedAt: string;
  studySeconds: number;
};

const key = "ielts-listening-session-v1";
const demoTranscriptMarker = "Good morning and welcome to the city transport information line.";

export function emptySession(): TrainerSession {
  return {
    audioSource: { type: "", name: "" },
    transcript: "",
    sentences: [],
    questions: [],
    correctAnswers: [],
    currentSentenceIndex: 0,
    status: "IDLE",
    practiceMode: "shadowing",
    score: 0,
    sourceName: "",
    answers: [],
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
    mistakes: []
  }));
}

export function normalizeSession(raw: Partial<TrainerSession>): TrainerSession {
  const base = emptySession();
  const parsed = { ...base, ...raw } as TrainerSession;
  const questions =
    parsed.questions?.length === parsed.sentences.length
      ? parsed.questions.map((question, index) => ({
          ...question,
          id: parsed.sentences[index]?.id ?? question.id,
          text: parsed.sentences[index]?.text ?? question.text,
          correctAnswer: parsed.sentences[index]?.text ?? question.correctAnswer,
          userAnswer: question.userAnswer ?? "",
          mistakes: question.mistakes ?? []
        }))
      : questionsFromSentences(parsed.sentences).map((question) => {
          const prior = parsed.answers.find((answer) => answer.sentenceId === question.id && answer.mode === "shadowing");
          return prior ? { ...question, userAnswer: prior.answer, score: prior.score, mistakes: prior.mistakes, submittedAt: prior.createdAt } : question;
        });

  return {
    ...parsed,
    questions,
    correctAnswers: parsed.sentences.map((sentence) => sentence.text),
    currentSentenceIndex: Math.min(parsed.currentSentenceIndex ?? 0, Math.max(parsed.sentences.length - 1, 0)),
    practiceMode: parsed.practiceMode ?? "shadowing"
  };
}

export function getSession(): TrainerSession {
  if (typeof window === "undefined") return emptySession();
  const raw = window.localStorage.getItem(key);
  if (!raw) return emptySession();
  try {
    const parsed = normalizeSession(JSON.parse(raw) as Partial<TrainerSession>);
    if (parsed.transcript.includes(demoTranscriptMarker)) return emptySession();
    return parsed;
  } catch {
    return emptySession();
  }
}

export function saveSession(session: TrainerSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify({ ...session, updatedAt: new Date().toISOString() }));
  window.dispatchEvent(new CustomEvent("trainer-session-updated"));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
  window.dispatchEvent(new CustomEvent("trainer-session-updated"));
}

export function sessionAverage(session: TrainerSession) {
  if (!session.answers.length) return 0;
  return Math.round(session.answers.reduce((sum, item) => sum + item.score, 0) / session.answers.length);
}

export function sessionBand(session: TrainerSession) {
  return bandEstimate(sessionAverage(session));
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
