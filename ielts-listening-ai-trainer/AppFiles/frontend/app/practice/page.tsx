"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ClozeEngine from "../../components/ClozeEngine";
import SentencePlayer from "../../components/SentencePlayer";
import { getCachedAudio, objectUrlFromBlob } from "../../lib/audioCache";
import { usePracticeStore } from "../../lib/practiceStore";

function formatDuration(sentence: { start?: number; end?: number }) {
  if (typeof sentence.start !== "number" || typeof sentence.end !== "number" || sentence.end <= sentence.start) return "--";
  return `${(sentence.end - sentence.start).toFixed(2)}s`;
}

function HighlightedSentence({
  sentence,
  currentTime
}: {
  sentence: { text: string; start?: number; end?: number; words?: { text: string; start: number; end: number }[] };
  currentTime: number;
}) {
  const tokens = sentence.text.split(/(\s+)/);
  const plainWords = tokens.filter((token) => /\S/.test(token));
  const timedWords = sentence.words?.length ? sentence.words : [];
  const fallbackActiveIndex =
    plainWords.length && typeof sentence.start === "number" && typeof sentence.end === "number" && sentence.end > sentence.start
      ? Math.floor(Math.min(0.999, Math.max(0, (currentTime - sentence.start) / (sentence.end - sentence.start))) * plainWords.length)
      : -1;

  return (
    <p className="text-center text-2xl font-semibold leading-relaxed text-slate-950">
      {tokens.map((token, index) => {
        const wordIndex = tokens.slice(0, index + 1).filter((item) => /\S/.test(item)).length - 1;
        const isWord = /\S/.test(token);
        const timedWord = timedWords[wordIndex];
        const isTimedActive = timedWord ? currentTime >= timedWord.start && currentTime <= timedWord.end : false;
        const isFallbackActive = !timedWords.length && wordIndex === fallbackActiveIndex;
        return (
          <span key={`${token}-${index}`} className={isWord && (isTimedActive || isFallbackActive) ? "rounded-lg bg-[#7478ff]/18 px-1 text-[#5558ff]" : ""}>
            {token}
          </span>
        );
      })}
    </p>
  );
}

export default function PracticePage() {
  const {
    audioSource,
    sentences,
    currentSentenceIndex,
    currentStatus,
    lastScore,
    session,
    practiceMode,
    startShadowing,
    startCloze,
    submitCurrentAnswer,
    submitClozeAnswerSet,
    currentQuestion,
    updateCurrentAnswer,
    nextSentence,
    previousSentence,
    setCurrentSentenceIndex,
    setCurrentStatus,
    addStudySeconds
  } = usePracticeStore();
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);
  const [startedAt] = useState(Date.now());

  const currentSentence = useMemo(() => sentences[currentSentenceIndex] ?? null, [currentSentenceIndex, sentences]);
  const isPracticeEnabled = currentStatus === "READY" || currentStatus === "PRACTICE_SHADOWING" || currentStatus === "PRACTICE_CLOZE" || currentStatus === "RESULT";
  const mode = practiceMode;

  useEffect(() => {
    let activeObjectUrl = "";

    async function loadAudio() {
      if (audioSource.cacheKey) {
        const cached = await getCachedAudio(audioSource.cacheKey);
        if (cached?.blob) {
          activeObjectUrl = objectUrlFromBlob(cached.blob);
          setAudioUrl(activeObjectUrl);
          return;
        }
      }
      setAudioUrl(audioSource.type === "url" && audioSource.url ? audioSource.url : "");
    }

    void loadAudio();
    return () => {
      if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    };
  }, [audioSource]);

  useEffect(() => {
    return () => {
      addStudySeconds(Math.round((Date.now() - startedAt) / 1000));
    };
  }, [addStudySeconds, startedAt]);

  async function submitShadowing() {
    await submitCurrentAnswer("shadowing", currentQuestion?.userAnswer ?? "");
  }

  async function submitCloze(value: string) {
    await submitClozeAnswerSet(value);
  }

  if (!sentences.length) {
    return (
      <section className="glass mx-auto max-w-2xl rounded-[20px] p-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Practice is locked</h1>
        <p className="mt-3 text-sm text-slate-600">Upload and transcribe audio before starting practice.</p>
        <Link className="mt-5 inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white" href="/">
          Upload audio
        </Link>
      </section>
    );
  }

  if (!isPracticeEnabled) {
    return (
      <section className="glass mx-auto max-w-2xl rounded-[20px] p-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Practice is locked</h1>
        <p className="mt-3 text-sm text-slate-600">Current state: {currentStatus}</p>
      </section>
    );
  }

  return (
    <div className="glass stage space-y-6">
      <section className="soft-card rounded-[28px] p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-500">Practise</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">{session.sourceName || "Current session"}</h1>
          </div>
          <div className="grid grid-cols-2 rounded-[20px] bg-white/46 p-1 text-sm font-semibold">
            <button
              className={`rounded-2xl px-4 py-2 ${mode === "shadowing" ? "bg-slate-900 text-white" : "text-slate-600"}`}
              onClick={() => {
                startShadowing();
              }}
            >
              Shadowing
            </button>
            <button
              className={`rounded-2xl px-4 py-2 ${mode === "cloze" ? "bg-slate-900 text-white" : "text-slate-600"}`}
              onClick={() => {
                startCloze();
              }}
            >
              Cloze
            </button>
          </div>
        </div>
      </section>

      <section className="soft-card rounded-[28px] p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-slate-500">
            {mode === "shadowing" ? `Sentence ${currentSentenceIndex + 1} of ${sentences.length}` : `Cloze set · ${sentences.length} sentences`}
          </p>
          {mode === "shadowing" && (
            <div className="flex gap-2">
              <button className="rounded-2xl bg-white/60 px-4 py-2 text-sm" onClick={previousSentence}>
                Previous
              </button>
              <button className="rounded-2xl bg-white/60 px-4 py-2 text-sm" onClick={nextSentence}>
                Next
              </button>
            </div>
          )}
        </div>

        {currentSentence && mode === "shadowing" && (
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <aside className="timeline-scroll max-h-[56vh] overflow-y-auto rounded-[24px] bg-white/58 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-500">Sentence timeline</div>
              <div className="space-y-2">
                {sentences.map((sentence, index) => (
                  <button
                    key={sentence.id}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      index === currentSentenceIndex ? "bg-[#7478ff] text-white shadow-lg" : "text-slate-600 hover:bg-white/75"
                    }`}
                    onClick={() => setCurrentSentenceIndex(index)}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${index === currentSentenceIndex ? "bg-white" : "bg-slate-300"}`} />
                    <span className="min-w-0 flex-1 text-sm font-semibold">第{index + 1}句</span>
                    <span className="text-xs opacity-80">{formatDuration(sentence)}</span>
                  </button>
                ))}
              </div>
            </aside>
            <div className="space-y-5">
              <SentencePlayer
                audioUrl={audioUrl}
                startTime={currentSentence.start}
                endTime={currentSentence.end}
                segmentIndex={currentSentenceIndex}
                segmentCount={sentences.length}
                onStart={() => setCurrentStatus("PRACTICE_SHADOWING")}
                onStop={() => setCurrentStatus("PRACTICE_SHADOWING")}
                onTimeChange={setCurrentTime}
              />
              <div className="rounded-[28px] bg-white/80 px-8 py-12 shadow-sm">
                <p className="mb-8 text-center text-sm font-semibold text-slate-400">
                  {currentSentenceIndex + 1} / {sentences.length}
                </p>
                {showTranscript ? (
                  <HighlightedSentence sentence={currentSentence} currentTime={currentTime} />
                ) : (
                  <p className="text-center text-lg font-semibold text-slate-400">Transcript hidden</p>
                )}
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input checked={showTranscript} type="checkbox" onChange={(event) => setShowTranscript(event.target.checked)} />
                Show transcript
              </label>
              <textarea
                className="control min-h-36 w-full rounded-[20px] p-4"
                placeholder="Type what you heard"
                value={currentQuestion?.userAnswer ?? ""}
                onChange={(event) => updateCurrentAnswer(event.target.value)}
              />
              <button
                className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
                onClick={submitShadowing}
                disabled={!(currentQuestion?.userAnswer ?? "").trim()}
              >
                Score answer
              </button>
              {currentQuestion?.submittedAt && (
                <div className="rounded-[20px] bg-white/65 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-500">Saved answer</p>
                    <p className="text-2xl font-semibold text-slate-950">{currentQuestion.score}%</p>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-500">Correct answer</p>
                  <p className="mt-2 leading-7 text-slate-900">{currentQuestion.correctAnswer}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === "cloze" && (
          <div className="space-y-5">
            <SentencePlayer
              audioUrl={audioUrl}
              playWholeAudio
              onStart={() => setCurrentStatus("PRACTICE_CLOZE")}
              onStop={() => setCurrentStatus("PRACTICE_CLOZE")}
              onTimeChange={setCurrentTime}
            />
            <ClozeEngine sentences={sentences} currentTime={currentTime} showAnswers={currentStatus === "RESULT"} onAnswer={submitCloze} />
          </div>
        )}

        {currentStatus === "RESULT" && (
          <div className="mt-5 rounded-[20px] bg-white/45 p-5">
            <p className="text-sm font-semibold text-slate-500">Score</p>
            <p className="mt-2 text-4xl font-semibold text-slate-950">{lastScore ?? session.score}%</p>
          </div>
        )}
      </section>
    </div>
  );
}
