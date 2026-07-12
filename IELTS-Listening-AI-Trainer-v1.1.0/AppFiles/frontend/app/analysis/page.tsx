"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { attemptMetrics, emptySession, estimatedBandRange, mistakeCounts, questionsFromSentences, recommendation, TrainerSession } from "../../lib/sessionStore";
import { usePracticeStore } from "../../lib/practiceStore";
import { listSessionRecords } from "../../lib/sessionDatabase";
import { useI18n } from "../../lib/i18n";

export default function AnalysisPage() {
  const { language, t } = useI18n();
  const router = useRouter();
  const { session, restoreSession } = usePracticeStore();
  const [storedSessions, setStoredSessions] = useState<TrainerSession[]>([]);
  const allSessions = useMemo(() => {
    const records = storedSessions.filter((record) => record.id !== session.id);
    return session.sentences.length || session.answers.length ? [session, ...records] : records;
  }, [session, storedSessions]);
  const analyticsSession = useMemo(() => {
    const replayCounts = allSessions.reduce<Record<string, number>>((result, item) => {
      Object.entries(item.replayCounts).forEach(([sentenceId, count]) => { result[`${item.id}:${sentenceId}`] = count; });
      return result;
    }, {});
    return {
      ...session,
      answers: allSessions.flatMap((item) => item.answers.map((answer) => ({ ...answer, sentenceId: `${item.id}:${answer.sentenceId}` }))),
      hintHistory: allSessions.flatMap((item) => item.hintHistory),
      replayCounts,
      favoriteSentenceIds: allSessions.flatMap((item) => item.favoriteSentenceIds.map((id) => `${item.id}:${id}`)),
      studySeconds: allSessions.reduce((sum, item) => sum + item.studySeconds, 0)
    };
  }, [allSessions, session]);
  const hasAnswers = analyticsSession.answers.length > 0;

  useEffect(() => {
    let active = true;
    const refresh = () => void listSessionRecords().then((records) => active && setStoredSessions(records)).catch(() => active && setStoredSessions([]));
    refresh();
    window.addEventListener("trainer-session-updated", refresh);
    return () => { active = false; window.removeEventListener("trainer-session-updated", refresh); };
  }, []);

  const metrics = useMemo(() => {
    const attempts = attemptMetrics(analyticsSession);
    return {
      ...attempts,
      estimatedRange: estimatedBandRange(analyticsSession),
      mistakes: mistakeCounts(analyticsSession),
      recommendation: recommendation(analyticsSession),
      replays: Object.values(analyticsSession.replayCounts).reduce((sum, count) => sum + count, 0),
      hints: analyticsSession.hintHistory.length,
      favorites: analyticsSession.favoriteSentenceIds.length,
      completedSessions: allSessions.filter((item) => item.sentences.length > 0 && new Set(item.answers.filter((answer) => answer.sentenceId !== "full-cloze").map((answer) => answer.sentenceId)).size >= item.sentences.length).length
    };
  }, [allSessions, analyticsSession]);

  const mistakeCategories = useMemo(() => {
    const names = new Set(["spelling", "numbers", "vocabulary", "grammar", ...Object.keys(metrics.mistakes)]);
    return Array.from(names).sort((left, right) => (metrics.mistakes[right] ?? 0) - (metrics.mistakes[left] ?? 0));
  }, [metrics.mistakes]);

  function reviewCategory(category: string) {
    const source = allSessions.find((item) => item.answers.some((attempt) => attempt.sentenceId !== "full-cloze" && attempt.mistakes.includes(category)));
    if (!source) return;
    const sentenceIds = new Set(source.answers.filter((attempt) => attempt.sentenceId !== "full-cloze" && attempt.mistakes.includes(category)).map((attempt) => attempt.sentenceId));
    const sentences = source.sentences.filter((sentence) => sentenceIds.has(sentence.id));
    if (!sentences.length) return;
    const now = new Date().toISOString();
    const focused: TrainerSession = {
      ...emptySession(),
      id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      audioSource: source.audioSource,
      audioMetadata: source.audioMetadata,
      audioCacheKey: source.audioCacheKey,
      sourceName: `${source.sourceName || "Listening session"} · ${category} review`,
      transcript: sentences.map((sentence) => sentence.text).join(" "),
      sentences,
      correctAnswers: sentences.map((sentence) => sentence.text),
      questions: questionsFromSentences(sentences),
      transcriptionDiagnostics: source.transcriptionDiagnostics,
      alignmentDiagnostics: source.alignmentDiagnostics,
      practiceMode: "shadowing",
      status: "PRACTICE_SHADOWING",
      practiceSettings: source.practiceSettings,
      startedAt: now,
      updatedAt: now
    };
    restoreSession(focused);
    router.push("/practice");
  }

  function restoreStoredSession(item: TrainerSession) {
    restoreSession(item);
    router.push("/practice");
  }

  const totalSentenceCount = allSessions.reduce((sum, item) => sum + item.sentences.length, 0);
  const skillProfile = [
    ["Spelling", Math.max(0, 100 - (metrics.mistakes.spelling ?? 0) * 8)],
    ["Number recognition", Math.max(0, 100 - (metrics.mistakes.numbers ?? 0) * 12)],
    ["Vocabulary", Math.max(0, 100 - (metrics.mistakes.vocabulary ?? 0) * 8)],
    ["Sentence retention", metrics.bestAverage],
    ["First-attempt comprehension", metrics.firstAverage],
    ["Listening endurance", Math.min(100, Math.round((metrics.practisedSentences / Math.max(totalSentenceCount, 1)) * 100))]
  ] as Array<[string, number]>;

  return (
    <div className="glass stage space-y-6">
      <section className="soft-card rounded-[28px] p-6">
        <p className="text-sm font-semibold text-slate-500">{t("Analysis")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950 sm:text-4xl">
          {t("Estimated Band Range")} {hasAnswers ? metrics.estimatedRange : "--"}
        </h1>
        <p className="mt-2 text-slate-600">
          {hasAnswers ? (language === "zh-CN" && metrics.recommendation.startsWith("Focus on ") ? `${t("Focus on")} ${t(metrics.recommendation.slice(9))}` : t(metrics.recommendation)) : t("Complete at least one answer to generate meaningful analysis.")}
        </p>
        <p className="mt-2 text-xs font-medium text-slate-400">{t("Heuristic practice estimate, not an official IELTS result.")}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["First attempt", hasAnswers ? `${metrics.firstAverage}%` : "--"],
          ["Best attempt", hasAnswers ? `${metrics.bestAverage}%` : "--"],
          ["Latest attempt", hasAnswers ? `${metrics.latestAverage}%` : "--"],
          ["Practised sentences", String(metrics.practisedSentences)]
        ].map(([label, value]) => (
          <section key={label} className="soft-card rounded-[22px] p-5">
            <p className="text-sm font-semibold text-slate-500">{t(label)}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="soft-card rounded-[22px] p-5"><p className="text-sm font-semibold text-slate-500">{t("Completed sessions")}</p><p className="mt-3 text-3xl font-semibold text-slate-950">{metrics.completedSessions}</p></section>
        <section className="soft-card rounded-[22px] p-5"><p className="text-sm font-semibold text-slate-500">{t("Saved sessions")}</p><p className="mt-3 text-3xl font-semibold text-slate-950">{allSessions.length}</p></section>
        <section className="soft-card rounded-[22px] p-5"><p className="text-sm font-semibold text-slate-500">{t("Study duration")}</p><p className="mt-3 text-3xl font-semibold text-slate-950">{Math.round(analyticsSession.studySeconds / 60)}m</p></section>
        <section className="soft-card rounded-[22px] p-5"><p className="text-sm font-semibold text-slate-500">{t("Replay count")}</p><p className="mt-3 text-3xl font-semibold text-slate-950">{metrics.replays}</p></section>
      </div>

      <section className="soft-card rounded-[28px] p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">{t("Attempt trend")}</h2>
          <span className="text-xs font-semibold text-slate-500">{metrics.totalAttempts} {t("total attempt(s)")}</span>
        </div>
        <div className="mt-5 h-44 overflow-x-auto rounded-[20px] bg-white/42 p-4">
          {metrics.trend.length ? (
            <div className="flex h-full min-w-full items-end gap-3">
              {metrics.trend.map((score, index) => (
                <div key={`${score}-${index}`} className="flex h-full w-9 shrink-0 flex-col items-center justify-end gap-2">
                  <div className="w-full rounded-t-lg bg-slate-900" style={{ height: `${Math.max(score, 4)}%` }} />
                  <span className="text-xs text-slate-500">{score}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">{t("No scored attempts yet")}</div>
          )}
        </div>
      </section>

      <section className="soft-card rounded-[28px] p-6">
        <h2 className="text-lg font-semibold text-slate-900">{t("Local skill profile")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("Heuristic strengths derived from saved attempts, not an official IELTS assessment.")}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skillProfile.map(([label, value]) => <div key={label}><div className="flex justify-between text-sm font-semibold"><span className="text-slate-600">{t(label)}</span><span className="text-slate-900">{value}%</span></div><div className="mt-2 h-2 rounded-full bg-slate-200"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${value}%` }} /></div></div>)}
        </div>
      </section>

      <section className="soft-card rounded-[28px] p-6">
        <h2 className="text-lg font-semibold text-slate-900">{t("Recent sessions")}</h2>
        <div className="mt-4 divide-y divide-slate-200/70">
          {allSessions.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 6).map((item) => (
            <button key={item.id} className="flex w-full items-center justify-between gap-4 py-4 text-left" onClick={() => restoreStoredSession(item)}>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{item.sourceName || t("Listening session")}</span><span className="mt-1 block text-xs text-slate-500">{item.answers.length} {t("attempt(s)")} · {new Date(item.updatedAt).toLocaleDateString(language)}</span></span><ArrowRight size={18} className="shrink-0 text-slate-400" />
            </button>
          ))}
          {!allSessions.length ? <p className="py-6 text-sm text-slate-500">{t("No saved sessions yet.")}</p> : null}
        </div>
      </section>

      <section className="soft-card rounded-[28px] p-6">
        <h2 className="text-lg font-semibold text-slate-900">{t("Practice behavior")}</h2>
        <dl className="mt-5 grid gap-4 divide-y divide-slate-200/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {[
            ["Study time", `${Math.round(session.studySeconds / 60)}m`],
            ["Sentence plays", String(metrics.replays)],
            ["Hints used", String(metrics.hints)],
            ["Difficult sentences", String(metrics.favorites)]
          ].map(([label, value]) => (
            <div key={label} className="pt-4 sm:pl-4 sm:pt-0">
              <dt className="text-sm font-semibold text-slate-500">{t(label)}</dt>
              <dd className="mt-2 text-3xl font-semibold text-slate-950">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="soft-card rounded-[28px] p-6">
        <h2 className="text-lg font-semibold text-slate-900">{t("Focused error review")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("Counts and review links come from saved mistake records.")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mistakeCategories.map((name) => {
            const count = metrics.mistakes[name] ?? 0;
            return (
              <button
                key={name}
                type="button"
                className="flex min-h-20 items-center justify-between rounded-[18px] bg-white/55 p-4 text-left disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!count}
                onClick={() => reviewCategory(name)}
              >
                <span>
                  <span className="block text-sm capitalize text-slate-500">{t(name)}</span>
                  <span className="mt-1 block text-2xl font-semibold text-slate-950">{count}</span>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
