"use client";

import { useMemo, useState } from "react";
import { Sentence } from "../lib/sessionStore";

type Blank = {
  id: string;
  tokenIndex: number;
  answer: string;
  label: string;
};

function tokenize(text: string) {
  return text.split(/(\s+)/);
}

function activeWordIndex(sentence: Sentence, currentTime: number) {
  const tokens = tokenize(sentence.text).filter((token) => /^[A-Za-z0-9'-]+$/.test(token));
  if (!tokens.length || typeof sentence.start !== "number" || typeof sentence.end !== "number" || sentence.end <= sentence.start) return -1;
  const progress = Math.min(0.999, Math.max(0, (currentTime - sentence.start) / (sentence.end - sentence.start)));
  return Math.floor(progress * tokens.length);
}

function blankSentence(sentence: Sentence, sentenceIndex: number) {
  const tokens = tokenize(sentence.text);
  const wordIndexes = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token }) => /^[A-Za-z0-9'-]+$/.test(token) && token.length > 3)
    .filter((_, index) => index % 4 === 0)
    .slice(0, 3);
  const blanks: Blank[] = wordIndexes.map((item, blankIndex) => ({
    id: `${sentence.id}-${blankIndex}`,
    tokenIndex: item.index,
    answer: item.token,
    label: `${sentenceIndex + 1}.${blankIndex + 1}`
  }));
  return { sentence, tokens, blanks };
}

export default function ClozeEngine({
  sentences,
  currentTime,
  showAnswers,
  onAnswer
}: {
  sentences: Sentence[];
  currentTime: number;
  showAnswers: boolean;
  onAnswer: (answer: string) => void;
}) {
  const clozeSet = useMemo(() => sentences.map(blankSentence), [sentences]);
  const blanks = useMemo(() => clozeSet.flatMap((item) => item.blanks), [clozeSet]);
  const [values, setValues] = useState<Record<string, string>>({});
  const activeSentenceIndex = sentences.findIndex(
    (sentence) => typeof sentence.start === "number" && typeof sentence.end === "number" && currentTime >= sentence.start && currentTime <= sentence.end
  );

  return (
    <div className="space-y-4">
      <div className="lyrics-panel max-h-[52vh] overflow-y-auto px-2 py-5">
        <div className="mx-auto max-w-4xl space-y-5">
          {clozeSet.map((item, sentenceIndex) => {
            const blankMap = new Map(item.blanks.map((blank) => [blank.tokenIndex, blank]));
            const highlightedWord = activeWordIndex(item.sentence, currentTime);
            let wordCursor = -1;
            const active = activeSentenceIndex === sentenceIndex;

            return (
              <p
                key={item.sentence.id}
                className={`rounded-[22px] px-5 py-4 text-lg leading-10 transition duration-300 ${
                  active ? "bg-white/85 text-slate-950 shadow-sm" : "text-slate-500 opacity-70"
                }`}
              >
                <span className="mr-3 text-sm font-semibold text-[#7478ff]">{sentenceIndex + 1}</span>
                {item.tokens.map((token, tokenIndex) => {
                  const blank = blankMap.get(tokenIndex);
                  if (/^[A-Za-z0-9'-]+$/.test(token)) wordCursor += 1;
                  if (blank) {
                    return (
                      <span key={`${blank.id}-${tokenIndex}`} className="mx-1 inline-flex items-center gap-2 align-middle">
                        <input
                          className="control h-9 w-28 rounded-xl px-3 text-base"
                          aria-label={`Blank ${blank.label}`}
                          disabled={showAnswers}
                          value={showAnswers ? values[blank.id] ?? "" : values[blank.id] ?? ""}
                          onChange={(event) => setValues((current) => ({ ...current, [blank.id]: event.target.value }))}
                        />
                        {showAnswers && <span className="rounded-lg bg-emerald-100 px-2 py-1 text-sm font-semibold text-emerald-700">{blank.answer}</span>}
                      </span>
                    );
                  }
                  const wordActive = active && wordCursor === highlightedWord;
                  return (
                    <span key={`${item.sentence.id}-${tokenIndex}`} className={wordActive ? "rounded-md bg-[#7478ff]/18 px-1 text-[#5458ff]" : ""}>
                      {token}
                    </span>
                  );
                })}
              </p>
            );
          })}
        </div>
      </div>
      <button
        className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
        onClick={() => onAnswer(blanks.map((blank) => values[blank.id] ?? "").join(" "))}
        disabled={showAnswers}
      >
        Check answers
      </button>
    </div>
  );
}
