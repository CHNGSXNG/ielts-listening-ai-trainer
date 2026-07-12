"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Eye,
  Lightbulb,
  ListChecks,
  RotateCcw,
  Shuffle
} from "lucide-react";
import {
  ClozeDifficulty,
  ClozeInputMode,
  ClozeSentenceState,
  HintRecord,
  Sentence,
  emptyClozeSentenceState
} from "../lib/sessionStore";
import {
  activeWordIndex,
  availableWordBankTokens,
  blankSentence,
  buildWordBank,
  isCompleteTokenOrder,
  isWord,
  normalized,
  placeWordBankToken,
  removeWordBankToken,
  reshuffleAvailableTokenOrder,
  shuffledTokenOrder
} from "../lib/clozeModel";
import { useI18n } from "../lib/i18n";

type Props = {
  sentences: Sentence[];
  currentTime: number;
  selectedSentenceIndex: number;
  difficulty: ClozeDifficulty;
  inputMode: ClozeInputMode;
  values: Record<string, string>;
  sentenceStates: Record<string, ClozeSentenceState>;
  showAnswers: boolean;
  disabled: boolean;
  hintCount: number;
  wordBankDifficulty: "easy" | "medium" | "hard";
  hintOptions: { firstLetter: boolean; revealWord: boolean; revealSentence: boolean; maxPerSentence: number };
  onValuesChange: (values: Record<string, string>) => void;
  onSentenceStateChange: (sentenceId: string, patch: Partial<ClozeSentenceState>) => void;
  onHint: (blankId: string, sentenceId: string, type: HintRecord["type"]) => void;
  onInputActivity: () => void;
  onSelectSentence: (index: number) => void;
  onSubmitSentence: (sentenceId: string, answer: string, reference: string) => Promise<void> | void;
  onSubmitAll: (answer: string, reference: string) => Promise<void> | void;
  onRetrySentence: (sentenceId: string) => void;
  onRetryAll: () => void;
};

const EMPTY_CLOZE_SENTENCE_STATE = emptyClozeSentenceState();

export default function ClozeEngine({
  sentences,
  currentTime,
  selectedSentenceIndex,
  difficulty,
  inputMode,
  values,
  sentenceStates,
  showAnswers,
  disabled,
  hintCount,
  wordBankDifficulty,
  hintOptions,
  onValuesChange,
  onSentenceStateChange,
  onHint,
  onInputActivity,
  onSelectSentence,
  onSubmitSentence,
  onSubmitAll,
  onRetrySentence,
  onRetryAll
}: Props) {
  const { t } = useI18n();
  const clozeSet = useMemo(() => sentences.map((sentence, index) => blankSentence(sentence, index, difficulty)), [difficulty, sentences]);
  const allBlanks = useMemo(() => clozeSet.flatMap((item) => item.blanks), [clozeSet]);
  const activeSet = clozeSet[selectedSentenceIndex];
  const activeState = activeSet ? sentenceStates[activeSet.sentence.id] ?? EMPTY_CLOZE_SENTENCE_STATE : EMPTY_CLOZE_SENTENCE_STATE;
  const bankDifficulty = wordBankDifficulty === "hard" ? 3 : wordBankDifficulty === "medium" ? 2 : 1;
  const wordBank = useMemo(() => buildWordBank(clozeSet, selectedSentenceIndex, bankDifficulty), [bankDifficulty, clozeSet, selectedSentenceIndex]);
  const hasCompleteTokenOrder = useMemo(
    () => isCompleteTokenOrder(wordBank, activeState.tokenOrder),
    [activeState.tokenOrder, wordBank]
  );
  const [focusedBlankId, setFocusedBlankId] = useState("");
  const [followAudio, setFollowAudio] = useState(true);
  const transcriptRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const timedSentenceIndex = sentences.findIndex(
    (sentence) => typeof sentence.start === "number" && typeof sentence.end === "number" && currentTime >= sentence.start && currentTime <= sentence.end
  );
  const transcriptActiveIndex = timedSentenceIndex >= 0 ? timedSentenceIndex : selectedSentenceIndex;

  useEffect(() => {
    if (!activeSet) return;
    const firstEmpty = activeSet.blanks.find((blank) => !(activeState.blankAnswers[blank.id] ?? "").trim());
    setFocusedBlankId(firstEmpty?.id ?? activeSet.blanks[0]?.id ?? "");
  }, [activeSet, activeState.blankAnswers]);

  useEffect(() => {
    if (inputMode === "typing" && followAudio) {
      transcriptRefs.current[transcriptActiveIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [followAudio, inputMode, transcriptActiveIndex]);

  const availableTokens = useMemo(() => availableWordBankTokens(wordBank, activeState), [activeState, wordBank]);
  const focusedSentenceBlank = activeSet?.blanks.find((blank) => blank.id === focusedBlankId) ?? activeSet?.blanks.find((blank) => !activeState.blankAnswers[blank.id]);
  const focusedGlobalBlank = allBlanks.find((blank) => blank.id === focusedBlankId) ?? allBlanks.find((blank) => !values[blank.id]) ?? allBlanks[0];
  const interactionDisabled = disabled || Boolean(activeState.submittedAt);
  const activeHintCount = inputMode === "word-bank" ? activeState.hintsUsed : hintCount;
  const hintLimitReached = activeHintCount >= hintOptions.maxPerSentence;

  function updateSentenceState(patch: Partial<ClozeSentenceState>) {
    if (!activeSet) return;
    onSentenceStateChange(activeSet.sentence.id, patch);
  }

  useEffect(() => {
    if (inputMode !== "word-bank" || !activeSet || hasCompleteTokenOrder || !wordBank.length) return;
    updateSentenceState({
      tokenOrder: shuffledTokenOrder(wordBank),
      attemptId: activeState.attemptId || `${activeSet.sentence.id}-${Date.now()}`
    });
  }, [activeSet, activeState.attemptId, hasCompleteTokenOrder, inputMode, wordBank]);

  function fillBlank(blankId: string, tokenId: string) {
    if (!activeSet || interactionDisabled) return;
    const token = wordBank.find((item) => item.id === tokenId);
    if (!token) return;
    const nextState = placeWordBankToken(activeState, blankId, token);
    if (nextState === activeState) return;
    updateSentenceState({ blankAnswers: nextState.blankAnswers, selectedTokenIds: nextState.selectedTokenIds });
    const nextBlank = activeSet.blanks.find((blank) => blank.id !== blankId && !(nextState.blankAnswers[blank.id] ?? "").trim());
    setFocusedBlankId(nextBlank?.id ?? blankId);
    onInputActivity();
  }

  function clearBlank(blankId: string) {
    if (interactionDisabled) return;
    const nextState = removeWordBankToken(activeState, blankId);
    updateSentenceState({ blankAnswers: nextState.blankAnswers, selectedTokenIds: nextState.selectedTokenIds });
    setFocusedBlankId(blankId);
    onInputActivity();
  }

  function setTypingBlank(blankId: string, value: string) {
    if (disabled || showAnswers) return;
    onValuesChange({ ...values, [blankId]: value });
    setFocusedBlankId(blankId);
    onInputActivity();
  }

  function revealFirstLetter() {
    if (!hintOptions.firstLetter || hintLimitReached) return;
    const blank = inputMode === "word-bank" ? focusedSentenceBlank : focusedGlobalBlank;
    if (!blank || disabled) return;
    if (inputMode === "word-bank") {
      const blankAnswers = { ...activeState.blankAnswers, [blank.id]: blank.answer.slice(0, 1) };
      const selectedTokenIds = { ...activeState.selectedTokenIds };
      delete selectedTokenIds[blank.id];
      updateSentenceState({ blankAnswers, selectedTokenIds });
    } else {
      onValuesChange({ ...values, [blank.id]: blank.answer.slice(0, 1) });
    }
    setFocusedBlankId(blank.id);
    onHint(blank.id, blank.sentenceId, "first-letter");
  }

  function revealWord() {
    if (!hintOptions.revealWord || hintLimitReached) return;
    const blank = inputMode === "word-bank" ? focusedSentenceBlank : focusedGlobalBlank;
    if (!blank || disabled) return;
    if (inputMode === "word-bank") {
      const token = wordBank.find((item) => !item.distractor && item.sourceWordIndex === blank.tokenIndex);
      if (token) fillBlank(blank.id, token.id);
    } else {
      onValuesChange({ ...values, [blank.id]: blank.answer });
    }
    setFocusedBlankId(blank.id);
    onHint(blank.id, blank.sentenceId, "word");
  }

  function revealSentence() {
    if (!hintOptions.revealSentence || hintLimitReached) return;
    const item = inputMode === "word-bank" ? activeSet : clozeSet[transcriptActiveIndex];
    if (!item || disabled) return;
    if (inputMode === "word-bank") {
      const blankAnswers = { ...activeState.blankAnswers };
      const selectedTokenIds = { ...activeState.selectedTokenIds };
      item.blanks.forEach((blank) => {
        const token = wordBank.find((candidate) => !candidate.distractor && candidate.sourceWordIndex === blank.tokenIndex);
        blankAnswers[blank.id] = blank.answer;
        if (token) selectedTokenIds[blank.id] = token.id;
        onHint(blank.id, blank.sentenceId, "sentence");
      });
      updateSentenceState({ blankAnswers, selectedTokenIds });
    } else {
      const nextValues = { ...values };
      item.blanks.forEach((blank) => {
        nextValues[blank.id] = blank.answer;
        onHint(blank.id, blank.sentenceId, "sentence");
      });
      onValuesChange(nextValues);
    }
  }

  function renderWordBankSentence() {
    if (!activeSet) return null;
    const blankMap = new Map(activeSet.blanks.map((blank) => [blank.tokenIndex, blank]));
    const highlightedWord = activeWordIndex(activeSet.sentence, currentTime);
    let wordCursor = -1;

    return (
      <p className="text-center text-[clamp(1.75rem,2.5vw,2.25rem)] font-medium leading-[1.75] text-slate-950">
        {activeSet.tokens.map((token, tokenIndex) => {
          const blank = blankMap.get(tokenIndex);
          if (isWord(token)) wordCursor += 1;
          const wordActive = wordCursor === highlightedWord;
          if (!blank) {
            return (
              <span key={`${activeSet.sentence.id}-${tokenIndex}`} className={wordActive ? "word-highlight rounded-md px-1" : ""}>
                {token}
              </span>
            );
          }

          const entered = (activeState.blankAnswers[blank.id] ?? "").trim();
          const correct = normalized(entered) === normalized(blank.answer);
          if (activeState.submittedAt) {
            return (
              <span
                key={blank.id}
                className={`mx-0.5 inline border-b-2 font-semibold ${correct ? "border-emerald-400 text-emerald-800" : "border-rose-400 text-rose-800"}`}
                title={correct ? t("Correct") : entered ? `${t("Your answer")}: ${entered}` : t("No answer")}
              >
                {!correct && entered ? <><span className="line-through opacity-55">{entered}</span><span className="mx-1">→</span></> : null}
                {blank.answer}
              </span>
            );
          }

          const active = focusedBlankId === blank.id;
          if (entered) {
            return (
              <button
                key={blank.id}
                type="button"
                className={`mx-0.5 inline border-b-2 px-0.5 font-medium text-slate-950 transition ${active ? "cloze-blank-active" : "border-slate-300 hover:border-slate-500"}`}
                aria-label={`Blank ${blank.label}, filled with ${entered}. Click to remove.`}
                title={t("Click to return this word to the Word Bank")}
                disabled={interactionDisabled}
                onClick={() => clearBlank(blank.id)}
              >
                {entered}
              </button>
            );
          }
          return (
            <button
              key={blank.id}
              type="button"
              className={`mx-1 inline-flex min-h-11 min-w-24 items-center justify-center rounded-[10px] border px-3 py-1 align-middle text-base font-semibold transition ${
                active ? "cloze-blank-active bg-white/82 shadow-[0_0_0_3px_var(--accent-soft)]" : "border-slate-300 bg-white/82 text-slate-700"
              }`}
              aria-label={`Blank ${blank.label}, empty`}
              title={t("Select this blank")}
              disabled={interactionDisabled}
              onClick={() => {
                setFocusedBlankId(blank.id);
                onInputActivity();
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                fillBlank(blank.id, event.dataTransfer.getData("application/x-word-bank-token"));
              }}
            >
              ______
            </button>
          );
        })}
      </p>
    );
  }

  const allActiveBlanksFilled = Boolean(activeSet?.blanks.length) && activeSet!.blanks.every((blank) => (activeState.blankAnswers[blank.id] ?? "").trim());
  const remainingBlankCount = activeSet?.blanks.filter((blank) => !(activeState.blankAnswers[blank.id] ?? "").trim()).length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-11 shrink-0 items-center border-b border-slate-200/60 px-1">
        {!showAnswers && !activeState.submittedAt ? (
          <div className="flex w-full items-center gap-1 overflow-x-auto [scrollbar-width:none]">
            {hintOptions.firstLetter ? <button
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-slate-600 hover:bg-white/50 disabled:opacity-40"
              disabled={disabled || hintLimitReached || !(inputMode === "word-bank" ? focusedSentenceBlank : focusedGlobalBlank)}
              onClick={revealFirstLetter}
              title={t("Reveal the first letter of the selected blank")}
            >
              <Lightbulb size={16} /> {t("First letter")}
            </button> : null}
            {hintOptions.revealWord ? <button
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-slate-600 hover:bg-white/50 disabled:opacity-40"
              disabled={disabled || hintLimitReached || !(inputMode === "word-bank" ? focusedSentenceBlank : focusedGlobalBlank)}
              onClick={revealWord}
              title={t("Reveal the selected word")}
            >
              <Eye size={16} /> {t("Reveal word")}
            </button> : null}
            {hintOptions.revealSentence ? <button
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-slate-600 hover:bg-white/50 disabled:opacity-40"
              disabled={disabled || hintLimitReached}
              onClick={revealSentence}
              title={t("Reveal every blank in the active sentence")}
            >
              <ListChecks size={16} /> {t("Reveal sentence")}
            </button> : null}
            <span className="ml-auto shrink-0 text-xs font-semibold text-slate-500">
              {activeHintCount} / {hintOptions.maxPerSentence} hints
            </span>
            {inputMode === "typing" && !followAudio ? (
              <button
                type="button"
                className="min-h-9 shrink-0 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white"
                onClick={() => setFollowAudio(true)}
              >
                {t("Return to current sentence")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {inputMode === "word-bank" && activeSet ? (
        <div className="practice-workspace min-h-0 flex-1 overflow-y-auto py-3 sm:py-4">
          <div className="mx-auto flex min-h-full max-w-[1080px] items-center justify-center">
            <div className="active-exercise-surface w-full rounded-[22px] px-5 py-[clamp(1.25rem,3vh,2.5rem)] sm:px-10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("Current exercise")}</p>
                {activeState.submittedAt ? (
                  <div className="rounded-xl bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white">{activeState.score ?? 0}%</div>
                ) : null}
              </div>

              {renderWordBankSentence()}

              {!activeState.submittedAt ? (
                <div className="mt-7 border-t border-slate-200/65 pt-4">
                  <div className="mb-3 flex items-center justify-center gap-3">
                    <p className="text-center text-xs font-semibold text-slate-500">{t("Word Bank")} · {availableTokens.length} {t("remaining")}</p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white/60 disabled:opacity-35"
                      disabled={disabled || Boolean(activeState.submittedAt) || availableTokens.length < 2}
                      onClick={() => updateSentenceState({ tokenOrder: reshuffleAvailableTokenOrder(wordBank, activeState) })}
                      aria-label={t("Shuffle available Word Bank tokens")}
                      title={t("Shuffle available words")}
                    >
                      <Shuffle size={13} /> {t("Shuffle")}
                    </button>
                  </div>
                  <div className="word-bank-tray overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label={t("Word bank")}>
                    <div className="mx-auto flex min-w-max items-center justify-center gap-2 sm:min-w-0 sm:flex-wrap">
                      {availableTokens.map((token) => (
                        <button
                          key={token.id}
                          type="button"
                          className="word-bank-token min-h-11 rounded-xl bg-white/92 px-4 text-[15px] font-semibold text-slate-700 shadow-[0_5px_12px_rgba(15,23,42,0.09)] transition hover:bg-indigo-50 disabled:opacity-40"
                          draggable
                          disabled={disabled}
                          title={token.distractor ? t("Contextual option") : t("Answer option")}
                          onDragStart={(event) => event.dataTransfer.setData("application/x-word-bank-token", token.id)}
                          onClick={() => {
                            const target = focusedSentenceBlank ?? activeSet.blanks.find((blank) => !activeState.blankAnswers[blank.id]);
                            if (target) fillBlank(target.id, token.id);
                          }}
                        >
                          {token.text}
                        </button>
                      ))}
                      {!availableTokens.length ? <p className="py-3 text-sm font-semibold text-emerald-700">{t("All words placed")}</p> : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 border-t border-slate-200/65 pt-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">{t("Answer saved")}</p>
                  <p className="mt-1">Attempt {activeState.attemptCount} · {activeState.hintsUsed} hint(s) used</p>
                  {activeState.mistakes.length ? <p className="mt-2">Review: {activeState.mistakes.join(", ")}</p> : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="practice-workspace lyrics-panel min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5"
          onWheel={() => setFollowAudio(false)}
          onTouchMove={() => setFollowAudio(false)}
        >
          <div className="mx-auto max-w-4xl space-y-4">
            {clozeSet.map((item, sentenceIndex) => {
              const blankMap = new Map(item.blanks.map((blank) => [blank.tokenIndex, blank]));
              const highlightedWord = activeWordIndex(item.sentence, currentTime);
              let wordCursor = -1;
              const active = transcriptActiveIndex === sentenceIndex;
              return (
                <p
                  key={item.sentence.id}
                  ref={(node) => {
                    transcriptRefs.current[sentenceIndex] = node;
                  }}
                  className={`cursor-pointer rounded-[20px] px-5 py-4 text-lg leading-10 transition ${
                    active ? "bg-white/90 text-slate-950 shadow-sm" : "text-slate-500 opacity-65 hover:opacity-90"
                  }`}
                  onClick={() => !disabled && onSelectSentence(sentenceIndex)}
                >
                  <span className="mr-3 text-sm font-semibold text-indigo-500">{sentenceIndex + 1}</span>
                  {item.tokens.map((token, tokenIndex) => {
                    const blank = blankMap.get(tokenIndex);
                    if (isWord(token)) wordCursor += 1;
                    const wordActive = active && wordCursor === highlightedWord;
                    if (!blank) {
                      return <span key={`${item.sentence.id}-${tokenIndex}`} className={wordActive ? "word-highlight rounded-md px-1" : ""}>{token}</span>;
                    }
                    const entered = (values[blank.id] ?? "").trim();
                    const correct = normalized(entered) === normalized(blank.answer);
                    if (showAnswers) {
                      return (
                        <span key={blank.id} className={`mx-1 inline-flex rounded-lg px-2 py-1 font-semibold ${correct ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                          {!correct && entered ? <><span className="line-through opacity-60">{entered}</span><span className="mx-1">→</span></> : null}
                          {blank.answer}
                        </span>
                      );
                    }
                    return (
                      <input
                        key={blank.id}
                        className={`control mx-1 h-10 rounded-xl px-2 text-center text-base font-semibold ${focusedBlankId === blank.id ? "border-indigo-400 bg-indigo-50" : ""}`}
                        style={{ width: `${Math.min(13, Math.max(4.5, blank.answer.length + 1.5))}ch` }}
                        aria-label={`Blank ${blank.label}`}
                        disabled={disabled}
                        value={values[blank.id] ?? ""}
                        onClick={(event) => event.stopPropagation()}
                        onFocus={() => {
                          setFocusedBlankId(blank.id);
                          onInputActivity();
                        }}
                        onChange={(event) => setTypingBlank(blank.id, event.target.value)}
                      />
                    );
                  })}
                </p>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex min-h-16 shrink-0 items-center border-t border-slate-200/65 py-2.5">
        {inputMode === "word-bank" && activeSet ? (
          activeState.submittedAt ? (
            <div className="flex w-full items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Sentence checked · {activeState.score ?? 0}%</p>
                <p className="truncate text-xs text-slate-500">{t("Your work is saved for this sentence.")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="grid size-11 place-items-center rounded-xl bg-white/75 text-slate-700 shadow-sm"
                  onClick={() => onRetrySentence(activeSet.sentence.id)}
                  aria-label={t("Retry sentence")}
                  title={t("Retry sentence")}
                >
                  <RotateCcw size={17} />
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-40"
                  disabled={selectedSentenceIndex >= sentences.length - 1}
                  onClick={() => onSelectSentence(selectedSentenceIndex + 1)}
                >
                  {t("Next sentence")} <ChevronRight size={17} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between gap-4">
              <p className="text-xs font-semibold text-slate-500">{remainingBlankCount ? `${remainingBlankCount} ${t(remainingBlankCount === 1 ? "blank remaining" : "blanks remaining")}` : t("Ready to check")}</p>
              <button
                type="button"
                className="min-h-11 w-[210px] rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
                disabled={disabled || !allActiveBlanksFilled}
                onClick={() => {
                  const answer = activeSet.blanks.map((blank) => activeState.blankAnswers[blank.id] ?? "").join(" ");
                  const reference = activeSet.blanks.map((blank) => blank.answer).join(" ");
                  void onSubmitSentence(activeSet.sentence.id, answer, reference);
                }}
              >
                {disabled ? t("Scoring...") : t("Check sentence →")}
              </button>
            </div>
          )
        ) : showAnswers ? (
          <button type="button" className="ml-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/75 px-5 text-sm font-semibold text-slate-800 shadow-sm" onClick={onRetryAll}>
            <RotateCcw size={17} /> {t("Try full transcript again")}
          </button>
        ) : (
          <button
            type="button"
            className="ml-auto min-h-11 w-[210px] rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
            disabled={disabled || !allBlanks.some((blank) => (values[blank.id] ?? "").trim())}
            onClick={() => {
              const answer = allBlanks.map((blank) => values[blank.id] ?? "").join(" ");
              const reference = allBlanks.map((blank) => blank.answer).join(" ");
              void onSubmitAll(answer, reference);
            }}
          >
            {disabled ? t("Scoring...") : t("Check all answers")}
          </button>
        )}
      </div>
    </div>
  );
}
