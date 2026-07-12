"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Circle, RotateCcw, Settings2, Star, XCircle } from "lucide-react";
import ClozeEngine from "../../components/ClozeEngine";
import SentencePlayer from "../../components/SentencePlayer";
import { getCachedAudio, objectUrlFromBlob } from "../../lib/audioCache";
import { usePracticeStore } from "../../lib/practiceStore";
import { useUserPreferences } from "../../lib/userPreferences";
import {
  ClozeDifficulty,
  ClozeInputMode,
  ClozeSentenceState,
  LoopCount,
  PlaybackMode,
  PlaybackRate,
  ReplayInterval,
  Sentence,
  TranscriptVisibility
} from "../../lib/sessionStore";
import { useI18n } from "../../lib/i18n";

function formatDuration(sentence: { start?: number; end?: number }) {
  if (typeof sentence.start !== "number" || typeof sentence.end !== "number" || sentence.end <= sentence.start) return "--";
  return `${(sentence.end - sentence.start).toFixed(2)}s`;
}

function HighlightedText({ sentence, currentTime, enabled = true }: { sentence: Sentence; currentTime: number; enabled?: boolean }) {
  const tokens = sentence.text.split(/(\s+)/);
  const timedWords = sentence.words?.length ? sentence.words : [];
  let wordIndex = -1;

  return (
    <>
      {tokens.map((token, index) => {
        const word = /\S/.test(token);
        if (word) wordIndex += 1;
        const timedWord = timedWords[wordIndex];
        const active = enabled && word && Boolean(timedWord && currentTime >= timedWord.start && currentTime <= timedWord.end);
        return (
          <span key={`${token}-${index}`} className={active ? "word-highlight rounded-md px-1" : ""}>
            {token}
          </span>
        );
      })}
    </>
  );
}

function TranscriptTimeline({
  sentences,
  questions,
  currentTime,
  selectedIndex,
  visibility,
  followAudio,
  disabled,
  restoreIndex,
  restoreKey,
  scrollBlock,
  onSelect
}: {
  sentences: Sentence[];
  questions: Array<{ submittedAt?: string }>;
  currentTime: number;
  selectedIndex: number;
  visibility: TranscriptVisibility;
  followAudio: boolean;
  disabled: boolean;
  restoreIndex: number;
  restoreKey: string;
  scrollBlock: ScrollLogicalPosition;
  onSelect: (index: number) => void;
}) {
  const { t } = useI18n();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const restoredKeyRef = useRef("");
  const timedIndex = sentences.findIndex(
    (sentence) => typeof sentence.start === "number" && typeof sentence.end === "number" && currentTime >= sentence.start && currentTime <= sentence.end
  );
  const activeIndex = timedIndex >= 0 ? timedIndex : selectedIndex;

  useEffect(() => {
    if (followAudio) refs.current[activeIndex]?.scrollIntoView({ behavior: "smooth", block: scrollBlock });
  }, [activeIndex, followAudio, scrollBlock]);

  useEffect(() => {
    if (followAudio || restoredKeyRef.current === restoreKey) return;
    restoredKeyRef.current = restoreKey;
    const frame = window.requestAnimationFrame(() => refs.current[restoreIndex]?.scrollIntoView({ block: scrollBlock }));
    return () => window.cancelAnimationFrame(frame);
  }, [followAudio, restoreIndex, restoreKey, scrollBlock]);

  return (
    <div className="lyrics-panel px-2 py-[18vh] sm:px-5">
      <div className="space-y-5">
        {sentences.map((sentence, index) => {
          const active = activeIndex === index;
          const selected = selectedIndex === index;
          const revealText = visibility === "show" || (visibility === "auto" && Boolean(questions[index]?.submittedAt));
          if (!revealText && !selected) return null;
          const distance = Math.abs(index - activeIndex);
          return (
            <button
              key={sentence.id}
              data-sentence-index={index}
              ref={(node) => {
                refs.current[index] = node;
              }}
              className={`lyrics-sentence block w-full scroll-my-24 rounded-[14px] px-4 py-3 text-center transition duration-300 ${
                active ? "text-slate-950" : selected ? "text-slate-700" : "text-slate-500 hover:opacity-90"
              } disabled:cursor-wait`}
              style={{ opacity: active ? 1 : distance <= 1 ? 0.62 : distance <= 2 ? 0.42 : 0.28 }}
              disabled={disabled}
              onClick={() => onSelect(index)}
            >
              <span className="mb-1.5 flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-400">
                <span>{t("Sentence")} {index + 1}</span><span aria-hidden="true">·</span><span>{formatDuration(sentence)}</span>
              </span>
              <span className={`block font-medium leading-[1.5] ${active ? "text-[clamp(1.9rem,2.6vw,2.4rem)]" : distance <= 1 ? "text-xl" : "text-lg"} ${revealText ? "" : "text-slate-500"}`}>
                {revealText ? <HighlightedText sentence={sentence} currentTime={currentTime} /> : t("Listen and type what you hear")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SentenceNavigator({
  sentences,
  currentIndex,
  mode,
  questions,
  clozeStates,
  disabled,
  onSelect
}: {
  sentences: Sentence[];
  currentIndex: number;
  mode: "shadowing" | "cloze" | "reading";
  questions: Array<{ submittedAt?: string; score?: number; userAnswer?: string }>;
  clozeStates: Record<string, ClozeSentenceState>;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  const { t } = useI18n();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    refs.current[currentIndex]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentIndex]);

  const nearbyIndexes = useMemo(() => {
    const start = Math.max(0, Math.min(currentIndex - 2, Math.max(sentences.length - 5, 0)));
    return Array.from({ length: Math.min(5, sentences.length - start) }, (_, offset) => start + offset);
  }, [currentIndex, sentences.length]);

  function statusFor(index: number) {
    if (mode === "reading") return { label: "available", Icon: Circle, className: "text-slate-300" };
    const submittedState = mode === "shadowing" ? questions[index] : clozeStates[sentences[index].id];
    if (submittedState?.submittedAt) {
      const score = submittedState.score ?? 0;
      if (score >= 70) return { label: "correct", Icon: CheckCircle2, className: "text-emerald-600" };
      if (score >= 40) return { label: "needs review", Icon: AlertTriangle, className: "text-amber-600" };
      return { label: "incorrect", Icon: XCircle, className: "text-rose-600" };
    }
    const answered = mode === "shadowing"
      ? Boolean(questions[index]?.userAnswer?.trim())
      : Boolean(clozeStates[sentences[index].id] && Object.values(clozeStates[sentences[index].id].blankAnswers).some((value) => value.trim()));
    return { label: answered ? "answered" : "unanswered", Icon: Circle, className: answered ? "text-blue-600" : "text-slate-300" };
  }

  return (
    <div className="sentence-rail flex min-w-0 items-center gap-2" aria-label={t("Sentence navigation")}>
      <span className="w-14 shrink-0 text-center text-xs font-semibold text-slate-500">{currentIndex + 1} / {sentences.length}</span>
      <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
        <div className="flex min-w-max items-center gap-1.5 px-1">
          {nearbyIndexes.map((index) => {
            const sentence = sentences[index];
            const status = statusFor(index);
            const StatusIcon = status.Icon;
            const active = index === currentIndex;
            return (
              <button
                key={sentence.id}
                ref={(node) => {
                  refs.current[index] = node;
                }}
                type="button"
                className={`inline-flex h-9 min-w-10 items-center justify-center gap-1 rounded-[11px] px-2.5 text-sm font-semibold transition ${active ? "bg-slate-950 text-white shadow-[0_5px_12px_rgba(15,23,42,0.2)]" : "text-slate-600 hover:bg-white/55"}`}
                disabled={disabled}
                aria-current={active ? "step" : undefined}
                aria-label={`${t("Sentence")} ${index + 1}, ${t(status.label)}`}
                title={`${t("Sentence")} ${index + 1}: ${t(status.label)}`}
                onClick={() => onSelect(index)}
              >
                {!active ? <StatusIcon size={12} className={status.className} /> : null}
                {index + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PracticePage() {
  const { t } = useI18n();
  const { preferences } = useUserPreferences();
  const {
    audioSource,
    sentences,
    currentSentenceIndex,
    currentStatus,
    session,
    practiceMode,
    practiceSettings,
    clozeDraft,
    clozeSentenceStates,
    hintHistory,
    favoriteSentenceIds,
    startShadowing,
    startCloze,
    startReading,
    submitCurrentAnswer,
    submitClozeAnswerSet,
    submitClozeSentence,
    currentQuestion,
    questions,
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
    nextSentence,
    previousSentence,
    setCurrentSentenceIndex,
    setViewedSentenceId,
    setCurrentStatus,
    addStudySeconds
  } = usePracticeStore();
  const [audioUrl, setAudioUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [audioLoadError, setAudioLoadError] = useState("");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [followAudio, setFollowAudio] = useState(practiceSettings.followAudio);
  const storedViewedIndex = sentences.findIndex((sentence) => sentence.id === session.viewedSentenceId);
  const restoredViewedIndex = storedViewedIndex >= 0 ? storedViewedIndex : currentSentenceIndex;
  const [viewedSentenceIndex, setViewedSentenceIndex] = useState(restoredViewedIndex);
  const [autoPlayRequest, setAutoPlayRequest] = useState(0);
  const [togglePlaybackRequest, setTogglePlaybackRequest] = useState(0);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);
  const lyricsViewportRef = useRef<HTMLDivElement | null>(null);
  const lyricsScrollFrameRef = useRef<number | null>(null);
  const viewedPersistenceTimerRef = useRef<number | null>(null);
  const previousSentenceIndexRef = useRef(currentSentenceIndex);
  const latestStatusRef = useRef(currentStatus);
  const latestModeRef = useRef(practiceMode);

  const currentSentence = useMemo(() => sentences[currentSentenceIndex] ?? null, [currentSentenceIndex, sentences]);
  const currentSubmitted = Boolean(currentQuestion?.submittedAt);
  const currentQuestionScore = currentQuestion?.score;
  const currentClozeState = currentSentence ? clozeSentenceStates[currentSentence.id] : undefined;
  const fullClozeSubmitted = Boolean(session.clozeSubmittedAt);
  const currentClozeSubmitted = practiceSettings.clozeInputMode === "word-bank" ? Boolean(currentClozeState?.submittedAt) : fullClozeSubmitted;
  const currentClozeScore = practiceSettings.clozeInputMode === "word-bank" ? currentClozeState?.score : session.score;
  const isEvaluating = currentStatus === "EVALUATING";
  const isPracticeEnabled = ["READY", "PRACTICE_SHADOWING", "PRACTICE_CLOZE", "PRACTICE_READING", "LISTENING", "ANSWERING", "EVALUATING", "RESULT", "SUCCESS", "ERROR"].includes(currentStatus);
  const mode = practiceMode;
  const playWholeAudio = practiceSettings.playbackMode === "full";
  const canMoveNext = currentSentenceIndex < sentences.length - 1
    && !(mode === "cloze" && practiceSettings.clozeInputMode === "word-bank" && !currentClozeSubmitted);
  const canAdvanceWithShortcut = mode === "reading"
    || (mode === "shadowing" ? currentSubmitted : currentClozeSubmitted);
  const effectiveFollowAudio = followAudio && (!playWholeAudio || preferences.audio.autoScrollTranscript);
  const transcriptScrollBlock: ScrollLogicalPosition = !preferences.transcript.keepCurrentCentered
    ? "nearest"
    : preferences.transcript.currentSentencePosition === "upper"
      ? "start"
      : preferences.transcript.currentSentencePosition === "lower"
        ? "end"
        : "center";

  const markListening = useCallback(() => setCurrentStatus("LISTENING"), [setCurrentStatus]);
  const restoreShadowState = useCallback(() => {
    if (currentSubmitted) setCurrentStatus("RESULT", currentQuestionScore);
    else setCurrentStatus("PRACTICE_SHADOWING");
  }, [currentQuestionScore, currentSubmitted, setCurrentStatus]);
  const restoreClozeState = useCallback(() => {
    if (currentClozeSubmitted) setCurrentStatus("RESULT", currentClozeScore);
    else setCurrentStatus("PRACTICE_CLOZE");
  }, [currentClozeScore, currentClozeSubmitted, setCurrentStatus]);
  const restoreReadingState = useCallback(() => setCurrentStatus("PRACTICE_READING"), [setCurrentStatus]);
  const markAnswering = useCallback(() => setCurrentStatus("ANSWERING"), [setCurrentStatus]);
  const handlePlaybackRate = useCallback(
    (rate: PlaybackRate) => updatePracticeSettings({ playbackRate: rate }),
    [updatePracticeSettings]
  );
  const handlePlayIteration = useCallback(() => {
    if (!playWholeAudio && currentSentence) recordReplay(currentSentence.id);
  }, [currentSentence, playWholeAudio, recordReplay]);
  const selectSentence = useCallback(
    (index: number) => {
      if (!isEvaluating) {
        setCurrentSentenceIndex(index);
        if (preferences.practice.autoPlaySentence || preferences.audio.autoPlayAfterSelection) setAutoPlayRequest((value) => value + 1);
      }
    },
    [isEvaluating, preferences.audio.autoPlayAfterSelection, preferences.practice.autoPlaySentence, setCurrentSentenceIndex]
  );

  const trackViewedSentence = useCallback(() => {
    if (lyricsScrollFrameRef.current !== null) return;
    lyricsScrollFrameRef.current = window.requestAnimationFrame(() => {
      lyricsScrollFrameRef.current = null;
      const viewport = lyricsViewportRef.current;
      if (!viewport) return;
      const center = viewport.getBoundingClientRect().top + viewport.clientHeight / 2;
      let nearestIndex = viewedSentenceIndex;
      let nearestDistance = Number.POSITIVE_INFINITY;
      viewport.querySelectorAll<HTMLElement>("[data-sentence-index]").forEach((row) => {
        const rect = row.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - center);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = Number(row.dataset.sentenceIndex ?? viewedSentenceIndex);
        }
      });
      setViewedSentenceIndex((current) => current === nearestIndex ? current : nearestIndex);
      if (viewedPersistenceTimerRef.current !== null) window.clearTimeout(viewedPersistenceTimerRef.current);
      viewedPersistenceTimerRef.current = window.setTimeout(() => {
        const sentenceId = sentences[nearestIndex]?.id;
        if (sentenceId) setViewedSentenceId(sentenceId);
      }, 180);
    });
  }, [sentences, setViewedSentenceId, viewedSentenceIndex]);

  const pauseFollowAudio = useCallback(() => {
    if (!followAudio) return;
    setFollowAudio(false);
    updatePracticeSettings({ followAudio: false });
  }, [followAudio, updatePracticeSettings]);

  const resumeFollowAudio = useCallback(() => {
    setFollowAudio(true);
    setViewedSentenceIndex(currentSentenceIndex);
    updatePracticeSettings({ followAudio: true });
  }, [currentSentenceIndex, updatePracticeSettings]);

  useEffect(
    () => setFollowAudio(practiceSettings.followAudio),
    [practiceSettings.followAudio, session.id]
  );

  useEffect(() => {
    if (followAudio) setViewedSentenceIndex(currentSentenceIndex);
  }, [currentSentenceIndex, followAudio]);

  useEffect(() => setViewedSentenceIndex(restoredViewedIndex), [restoredViewedIndex, session.id]);

  useEffect(() => () => {
    if (lyricsScrollFrameRef.current !== null) window.cancelAnimationFrame(lyricsScrollFrameRef.current);
    if (viewedPersistenceTimerRef.current !== null) window.clearTimeout(viewedPersistenceTimerRef.current);
  }, []);

  useEffect(() => {
    if (previousSentenceIndexRef.current !== currentSentenceIndex && preferences.practice.autoPlayNext) {
      setAutoPlayRequest((value) => value + 1);
    }
    previousSentenceIndexRef.current = currentSentenceIndex;
  }, [currentSentenceIndex, preferences.practice.autoPlayNext]);

  useEffect(() => {
    if (mode !== "shadowing" || currentSubmitted || !preferences.practice.autoFocusAnswer) return;
    const frame = window.requestAnimationFrame(() => answerRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [currentSentenceIndex, currentSubmitted, mode, preferences.practice.autoFocusAnswer]);

  useEffect(() => {
    if (!preferences.accessibility.keyboardNavigation) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable));
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canAdvanceWithShortcut && canMoveNext) {
        event.preventDefault();
        selectSentence(currentSentenceIndex + 1);
      } else if (!editing && event.code === "Space") {
        event.preventDefault();
        setTogglePlaybackRequest((value) => value + 1);
      } else if (!editing && event.key === "ArrowLeft" && currentSentenceIndex > 0) {
        selectSentence(currentSentenceIndex - 1);
      } else if (!editing && event.key === "ArrowRight" && canMoveNext) {
        selectSentence(currentSentenceIndex + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canAdvanceWithShortcut, canMoveNext, currentSentenceIndex, preferences.accessibility.keyboardNavigation, selectSentence]);

  useEffect(() => {
    document.body.classList.add("practice-route");
    return () => document.body.classList.remove("practice-route");
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeSettings = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", closeSettings);
    return () => window.removeEventListener("keydown", closeSettings);
  }, [settingsOpen]);

  useEffect(() => {
    let activeObjectUrl = "";
    let cancelled = false;
    async function loadAudio() {
      setAudioUrl("");
      setAudioLoadError("");
      try {
        if (audioSource.cacheKey) {
          const cached = await getCachedAudio(audioSource.cacheKey);
          if (cached?.blob) {
            activeObjectUrl = objectUrlFromBlob(cached.blob);
            if (!cancelled) setAudioUrl(activeObjectUrl);
            return;
          }
        }
        if (audioSource.type === "url" && audioSource.url) {
          if (!cancelled) setAudioUrl(audioSource.url);
          return;
        }
        if (!cancelled && audioSource.type === "file") {
          setAudioLoadError("The uploaded audio is no longer available in this browser. Re-upload it to restore playback.");
        }
      } catch {
        if (!cancelled) setAudioLoadError("The browser could not read the cached audio. Re-upload it to restore playback.");
      }
    }
    void loadAudio();
    return () => {
      cancelled = true;
      if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    };
  }, [audioSource]);

  useEffect(() => {
    latestStatusRef.current = currentStatus;
    latestModeRef.current = practiceMode;
  }, [currentStatus, practiceMode]);

  useEffect(() => {
    if (currentStatus !== "LISTENING" && currentStatus !== "ANSWERING") return;
    let checkpoint = Date.now();
    const commitElapsed = () => {
      const now = Date.now();
      const seconds = Math.floor((now - checkpoint) / 1000);
      if (seconds > 0) {
        addStudySeconds(seconds);
        checkpoint += seconds * 1000;
      }
    };
    const timer = window.setInterval(commitElapsed, 15_000);
    return () => {
      window.clearInterval(timer);
      commitElapsed();
    };
  }, [addStudySeconds, currentStatus]);

  useEffect(() => {
    return () => {
      if (latestStatusRef.current === "LISTENING" || latestStatusRef.current === "ANSWERING") {
        setCurrentStatus(latestModeRef.current === "cloze" ? "PRACTICE_CLOZE" : latestModeRef.current === "reading" ? "PRACTICE_READING" : "PRACTICE_SHADOWING");
      }
    };
  }, [setCurrentStatus]);

  async function submitShadowing() {
    await submitCurrentAnswer("shadowing", currentQuestion?.userAnswer ?? "");
  }

  if (!sentences.length) {
    return (
      <section className="glass m-auto max-w-2xl rounded-[20px] p-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">{t("Practice is locked")}</h1>
        <p className="mt-3 text-sm text-slate-600">{t("Upload and transcribe audio before starting practice.")}</p>
        <Link className="mt-5 inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white" href="/">
          {t("Upload audio")}
        </Link>
      </section>
    );
  }

  if (!isPracticeEnabled) {
    return (
      <section className="glass m-auto max-w-2xl rounded-[20px] p-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">{t("Practice is locked")}</h1>
        <p className="mt-3 text-sm text-slate-600">{t("Current state")}: {currentStatus}</p>
      </section>
    );
  }

  return (
    <div className="practice-canvas flex h-full min-h-0 flex-col overflow-hidden rounded-[24px]">
      <header className="practice-toolbar relative z-20 flex h-[58px] shrink-0 items-center gap-3 overflow-x-auto border-b border-slate-200/65 px-3 [scrollbar-width:none] sm:px-5">
          <div className="flex shrink-0 items-center gap-2">
            <div className="grid grid-cols-3 rounded-[13px] bg-slate-200/55 p-1 text-sm font-semibold">
              <button
                disabled={isEvaluating}
                className={`rounded-[10px] px-3 py-1.5 disabled:cursor-wait disabled:opacity-45 ${mode === "shadowing" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600"}`}
                onClick={startShadowing}
              >
                {t("Shadowing")}
              </button>
              <button
                disabled={isEvaluating}
                className={`rounded-[10px] px-3 py-1.5 disabled:cursor-wait disabled:opacity-45 ${mode === "cloze" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600"}`}
                onClick={startCloze}
              >
                {t("Cloze")}
              </button>
              <button
                disabled={isEvaluating}
                className={`rounded-[10px] px-3 py-1.5 disabled:cursor-wait disabled:opacity-45 ${mode === "reading" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600"}`}
                onClick={startReading}
              >
                {t("Reading")}
              </button>
            </div>
          </div>
          <div className="min-w-[180px] flex-1 sm:min-w-0">
            <SentenceNavigator sentences={sentences} currentIndex={currentSentenceIndex} mode={mode} questions={questions} clozeStates={clozeSentenceStates} disabled={isEvaluating} onSelect={selectSentence} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {currentSentence ? (
              <button
                aria-label={favoriteSentenceIds.includes(currentSentence.id) ? "Remove difficult sentence bookmark" : "Bookmark difficult sentence"}
                title={t("Bookmark difficult sentence")}
                className={`grid size-9 place-items-center rounded-[10px] ${favoriteSentenceIds.includes(currentSentence.id) ? "bg-amber-100 text-amber-600" : "text-slate-400 hover:bg-white/55"}`}
                onClick={() => toggleFavorite(currentSentence.id)}
              >
                <Star size={16} fill={favoriteSentenceIds.includes(currentSentence.id) ? "currentColor" : "none"} />
              </button>
            ) : null}
            <button className="grid size-9 place-items-center rounded-[10px] text-slate-600 hover:bg-white/55 disabled:opacity-30" onClick={previousSentence} disabled={isEvaluating || currentSentenceIndex === 0} aria-label={t("Previous sentence")}>
              <ChevronLeft size={18} />
            </button>
            <button className="grid size-9 place-items-center rounded-[10px] text-slate-600 hover:bg-white/55 disabled:opacity-30" onClick={nextSentence} disabled={isEvaluating || !canMoveNext} aria-label={t("Next sentence")}>
              <ChevronRight size={18} />
            </button>
            <button
              aria-label={t("Practice settings")}
              title={t("Practice settings")}
              className={`grid size-10 place-items-center rounded-[11px] ${settingsOpen ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-white/60"}`}
              disabled={isEvaluating}
              onClick={() => setSettingsOpen((value) => !value)}
            >
              <Settings2 size={18} />
            </button>
          </div>

        {settingsOpen ? (
          <div className="soft-card absolute left-2 right-2 top-[calc(100%+0.5rem)] z-30 grid gap-3 rounded-[20px] p-4 shadow-2xl sm:left-auto sm:right-3 sm:w-[min(760px,calc(100vw-4rem))] sm:grid-cols-2 lg:grid-cols-5">
            <label className="space-y-1.5 text-xs font-semibold text-slate-500">
              <span>{t("Playback")}</span>
              <select
                className="control h-10 w-full rounded-xl px-3 text-sm text-slate-800"
                value={practiceSettings.playbackMode}
                onChange={(event) => updatePracticeSettings({ playbackMode: event.target.value as PlaybackMode })}
              >
                <option value="sentence">{t("Sentence loop")}</option>
                <option value="full">{t("Full audio")}</option>
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-500">
              <span>{t("Transcript")}</span>
              <select
                className="control h-10 w-full rounded-xl px-3 text-sm text-slate-800"
                value={practiceSettings.transcriptVisibility}
                onChange={(event) => updatePracticeSettings({ transcriptVisibility: event.target.value as TranscriptVisibility })}
              >
                <option value="hide">{t("Hidden")}</option>
                <option value="auto">{t("Reveal after answer")}</option>
                <option value="show">{t("Always visible")}</option>
              </select>
            </label>
            {practiceSettings.playbackMode === "sentence" ? (
              <>
                <label className="space-y-1.5 text-xs font-semibold text-slate-500">
                  <span>{t("Loop count")}</span>
                  <select
                    className="control h-10 w-full rounded-xl px-3 text-sm text-slate-800"
                    value={String(practiceSettings.loopCount)}
                    onChange={(event) => {
                      const value = event.target.value;
                      updatePracticeSettings({ loopCount: value === "infinite" ? "infinite" : (Number(value) as LoopCount) });
                    }}
                  >
                    {[1, 2, 3, 5].map((count) => <option key={count} value={count}>{count} time{count > 1 ? "s" : ""}</option>)}
                    <option value="infinite">{t("Unlimited")}</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-slate-500">
                  <span>{t("Replay interval")}</span>
                  <select
                    className="control h-10 w-full rounded-xl px-3 text-sm text-slate-800"
                    value={practiceSettings.replayInterval}
                    onChange={(event) => updatePracticeSettings({ replayInterval: Number(event.target.value) as ReplayInterval })}
                  >
                    {[0, 1, 2, 3, 5].map((seconds) => <option key={seconds} value={seconds}>{seconds} second{seconds === 1 ? "" : "s"}</option>)}
                  </select>
                </label>
              </>
            ) : null}
            {mode === "cloze" ? (
              <label className="space-y-1.5 text-xs font-semibold text-slate-500">
                <span>{t("Cloze style")}</span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="control h-10 min-w-0 rounded-xl px-2 text-sm text-slate-800"
                    value={practiceSettings.clozeDifficulty}
                    onChange={(event) => updatePracticeSettings({ clozeDifficulty: Number(event.target.value) as ClozeDifficulty })}
                  >
                    <option value={1}>{t("Key words")}</option>
                    <option value={2}>{t("Intensive")}</option>
                    <option value={3}>{t("Full mask")}</option>
                  </select>
                  <select
                    className="control h-10 min-w-0 rounded-xl px-2 text-sm text-slate-800"
                    value={practiceSettings.clozeInputMode}
                    onChange={(event) => updatePracticeSettings({ clozeInputMode: event.target.value as ClozeInputMode })}
                  >
                    <option value="typing">{t("Type")}</option>
                    <option value="word-bank">{t("Word bank")}</option>
                  </select>
                </div>
              </label>
            ) : null}
          </div>
        ) : null}
      </header>

      <section className="flex min-h-0 flex-1 flex-col px-3 sm:px-5">
        {audioLoadError ? <div className="mt-2 shrink-0 rounded-[14px] bg-amber-100/90 px-4 py-2 text-sm font-semibold text-amber-900">{audioLoadError}</div> : null}

        <div className="audio-row shrink-0 border-b border-slate-200/60 px-1">
          {currentSentence ? (
            <SentencePlayer
              audioUrl={audioUrl}
              timeline={sentences}
              startTime={currentSentence.start}
              endTime={currentSentence.end}
              playWholeAudio={playWholeAudio}
              loopCount={practiceSettings.loopCount}
              replayInterval={practiceSettings.replayInterval}
              playbackRate={practiceSettings.playbackRate}
              volume={preferences.audio.volume}
              useNativeControls={preferences.audio.useNativeControls}
              showSeekPreview={preferences.audio.seekPreview}
              startPaddingMs={preferences.audio.startPaddingMs}
              endPaddingMs={preferences.audio.endPaddingMs}
              fadeInMs={preferences.audio.fadeInMs}
              fadeOutMs={preferences.audio.fadeOutMs}
              stopOnSentenceChange={preferences.audio.stopOnSentenceChange}
              autoPlayRequest={autoPlayRequest}
              togglePlaybackRequest={togglePlaybackRequest}
              pausedExternally={isEvaluating || currentStatus === "RESULT"}
              onPlaybackRateChange={handlePlaybackRate}
              onPlaybackStateChange={setAudioPlaying}
              onStart={markListening}
              onStop={mode === "cloze" ? restoreClozeState : mode === "reading" ? restoreReadingState : restoreShadowState}
              onPlayIteration={handlePlayIteration}
              onTimeChange={setCurrentTime}
            />
          ) : null}
        </div>

        {currentSentence && (mode === "shadowing" || mode === "reading") ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              ref={lyricsViewportRef}
              className="practice-workspace lyrics-viewport relative min-h-0 flex-1 overflow-y-auto scroll-smooth"
              onWheel={pauseFollowAudio}
              onTouchMove={pauseFollowAudio}
              onScroll={trackViewedSentence}
            >
              {!followAudio ? (
                <button
                  type="button"
                  className="sticky top-3 z-10 ml-auto mr-3 block rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg"
                  title={`Viewing sentence ${viewedSentenceIndex + 1}`}
                  onClick={resumeFollowAudio}
                >
                  {t("Return to current sentence")}
                </button>
              ) : null}
              <div className="mx-auto w-full max-w-[1080px]">
                <TranscriptTimeline
                  sentences={sentences}
                  questions={questions}
                  currentTime={currentTime}
                  selectedIndex={currentSentenceIndex}
                  visibility={mode === "reading" && practiceSettings.transcriptVisibility === "auto" ? "show" : practiceSettings.transcriptVisibility}
                  followAudio={effectiveFollowAudio}
                  disabled={isEvaluating}
                  restoreIndex={restoredViewedIndex}
                  restoreKey={`${session.id}:${mode}`}
                  scrollBlock={transcriptScrollBlock}
                  onSelect={selectSentence}
                />
              </div>
            </div>

            {mode === "shadowing" ? <div className="answer-composer shrink-0 border-t border-slate-200/65 px-1 py-3 sm:px-4">
              {!currentSubmitted ? (
                <div className="mx-auto max-w-[1080px]">
                  <label className="mb-2 block text-xs font-semibold text-slate-500" htmlFor="shadowing-answer">{t("Type what you heard")}</label>
                  <textarea
                    id="shadowing-answer"
                    ref={answerRef}
                    className="control h-[clamp(7.5rem,16vh,10rem)] w-full resize-none rounded-[16px] bg-white/72 p-4 text-base"
                    placeholder={t("Type what you heard")}
                    value={currentQuestion?.userAnswer ?? ""}
                    disabled={isEvaluating}
                    onFocus={markAnswering}
                    onBlur={() => {
                      if (!currentSubmitted) setCurrentStatus(audioPlaying ? "LISTENING" : "PRACTICE_SHADOWING");
                    }}
                    onChange={(event) => {
                      updateCurrentAnswer(event.target.value);
                      if (currentStatus !== "ANSWERING") markAnswering();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !currentSubmitted && (currentQuestion?.userAnswer ?? "").trim()) {
                        event.preventDefault();
                        void submitShadowing();
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="active-exercise-surface mx-auto grid max-w-[1080px] gap-4 rounded-[18px] px-5 py-4 md:grid-cols-[1fr_1fr_auto]">
                  <div><p className="text-xs font-semibold text-slate-500">{t("Your answer")}</p><p className="mt-1.5 text-sm leading-6 text-slate-900">{currentQuestion?.userAnswer}</p></div>
                  {preferences.practice.showAnswerAfterSubmit ? <div><p className="text-xs font-semibold text-slate-500">{t("Correct answer")}</p><p className="mt-1.5 text-sm leading-6 text-slate-900"><HighlightedText sentence={currentSentence} currentTime={currentTime} enabled={preferences.transcript.wordHighlight} /></p></div> : <div />}
                  <div className="text-right"><p className="text-3xl font-semibold text-slate-950">{currentQuestion?.score}%</p><p className="mt-1 text-xs text-slate-500">{currentQuestion?.mistakes.length ? currentQuestion.mistakes.map((mistake) => t(mistake)).join(", ") : t("No mistakes")}</p></div>
                </div>
              )}
            </div> : null}

            {mode === "shadowing" ? <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-t border-slate-200/65 py-2.5">
              <p className="text-xs font-semibold text-slate-500">{currentSubmitted ? t("Attempt {{count}} saved", { count: currentQuestion?.attempts.length ?? 1 }) : (currentQuestion?.userAnswer ?? "").trim() ? t("Ready to score") : t("Type the sentence you heard")}</p>
              <div className="flex shrink-0 items-center gap-2">
                {currentSubmitted ? (
                  <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/75 px-4 text-sm font-semibold text-slate-800 shadow-sm" onClick={() => { if (!preferences.practice.confirmResetSentence || window.confirm(t("Start a new attempt for this sentence?"))) retryShadowingSentence(currentSentence.id); }}>
                    <RotateCcw size={17} /> {t("Try again")}
                  </button>
                ) : (
                  <button className="min-h-11 w-[190px] rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45" onClick={submitShadowing} disabled={isEvaluating || !(currentQuestion?.userAnswer ?? "").trim()}>
                    {isEvaluating ? t("Scoring...") : t("Score answer")}
                  </button>
                )}
                {currentSubmitted && currentSentenceIndex < sentences.length - 1 ? (
                  <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" onClick={nextSentence}>
                    {t("Next")} <ChevronRight size={17} />
                  </button>
                ) : null}
              </div>
            </div> : null}
          </div>
        ) : null}

        {currentSentence && mode === "cloze" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <ClozeEngine
              sentences={sentences}
              currentTime={currentTime}
              selectedSentenceIndex={currentSentenceIndex}
              difficulty={practiceSettings.clozeDifficulty}
              inputMode={practiceSettings.clozeInputMode}
              values={clozeDraft}
              sentenceStates={clozeSentenceStates}
              showAnswers={currentStatus === "RESULT" && fullClozeSubmitted}
              disabled={isEvaluating}
              hintCount={hintHistory.length}
              wordBankDifficulty={preferences.cloze.wordBankDifficulty}
              hintOptions={{ firstLetter: preferences.cloze.firstLetterHint, revealWord: preferences.cloze.revealWordHint, revealSentence: preferences.cloze.revealSentenceHint, maxPerSentence: preferences.cloze.maxHintsPerSentence }}
              onValuesChange={updateClozeDraft}
              onSentenceStateChange={updateClozeSentenceState}
              onHint={recordHint}
              onInputActivity={markAnswering}
              onSelectSentence={selectSentence}
              onSubmitSentence={submitClozeSentence}
              onSubmitAll={submitClozeAnswerSet}
              onRetrySentence={(sentenceId) => { if (!preferences.practice.confirmResetSentence || window.confirm(t("Start a new attempt for this sentence?"))) retryClozeSentence(sentenceId); }}
              onRetryAll={() => { if (!preferences.practice.confirmResetSentence || window.confirm(t("Restart the full Cloze exercise?"))) retryCloze(); }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
