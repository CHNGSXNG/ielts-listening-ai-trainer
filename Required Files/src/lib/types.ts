export type Sentence = {
  id: number;
  text: string;
  start?: number | null;
  end?: number | null;
};

export type TranscriptResponse = {
  audio_id: string;
  transcript: string;
  sentences: Sentence[];
  source: "whisper" | "sample";
  warning?: string | null;
};

export type ClozeBlank = {
  id: string;
  answer: string;
  weight: number;
  kind: string;
  position: number;
};

export type ClozeResponse = {
  cloze_text: string;
  blanks: ClozeBlank[];
};

export type EvaluationResponse = {
  score: number;
  band: number;
  mistakes: Array<Record<string, string | number>>;
  correct_answers: Record<string, string> | string[];
  explanation: string;
};
