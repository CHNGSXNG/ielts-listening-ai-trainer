"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Circle, Terminal } from "lucide-react";
import AudioUploader from "../components/AudioUploader";
import UrlImporter from "../components/UrlImporter";
import { BackendHealth, downloadModel as downloadLocalModel, getBackendHealth } from "../lib/api";
import { usePracticeStore } from "../lib/practiceStore";
import { useI18n } from "../lib/i18n";

function formatDuration(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "Unavailable";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function formatBytes(bytes?: number) {
  if (typeof bytes !== "number") return "Unavailable";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DiagnosticRow({ label, value, state = "neutral" }: { label: string; value: string; state?: "neutral" | "ready" | "working" | "failed" }) {
  const { t } = useI18n();
  const Icon = state === "ready" ? CheckCircle2 : state === "failed" ? AlertCircle : Circle;
  const color = state === "ready" ? "text-emerald-600" : state === "working" ? "text-amber-500" : state === "failed" ? "text-rose-600" : "text-slate-400";
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200/65 py-2.5 last:border-0">
      <span className="text-sm font-semibold text-slate-500">{t(label)}</span>
      <span className="flex min-w-0 items-center gap-2 text-right text-sm font-semibold text-slate-900">
        <Icon className={`shrink-0 ${color} ${state === "working" ? "animate-pulse" : ""}`} size={15} />
        <span className="truncate">{t(value)}</span>
      </span>
    </div>
  );
}

export default function UploadPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { transcriptText, currentStatus, sentences, session, setCurrentStatus } = usePracticeStore();
  const [status, setStatus] = useState("idle");
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [storageReady, setStorageReady] = useState<boolean | null>(null);
  const [audioReady, setAudioReady] = useState<boolean | null>(null);
  const [modelAction, setModelAction] = useState("");
  const pipelineBusy = currentStatus === "UPLOADING" || currentStatus === "TRANSCRIBING" || currentStatus === "ALIGNING";
  const busy = pipelineBusy || currentStatus === "MODEL_DOWNLOADING";
  const appReady = onboardingComplete && Boolean(backendHealth?.modelAvailable && backendHealth.alignmentEngine && storageReady && audioReady);

  const refreshHealth = useCallback(async () => {
    try {
      const health = await getBackendHealth();
      setBackendHealth(health);
      setHealthError(false);
      return health;
    } catch {
      setBackendHealth(null);
      setHealthError(true);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    setOnboardingComplete(window.localStorage.getItem("ielts-onboarding-complete") === "true");
    async function checkBrowserCapabilities() {
      if (typeof Audio === "undefined") {
        setAudioReady(false);
      } else {
        const probe = new Audio();
        const supportedTypes = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/aac", "audio/ogg", "audio/flac"];
        setAudioReady(supportedTypes.some((type) => Boolean(probe.canPlayType(type))));
      }
      try {
        const request = indexedDB.open("ielts-startup-check", 1);
        request.onsuccess = () => {
          request.result.close();
          indexedDB.deleteDatabase("ielts-startup-check");
          if (active) setStorageReady(true);
        };
        request.onerror = () => active && setStorageReady(false);
        request.onblocked = () => active && setStorageReady(false);
      } catch {
        if (active) setStorageReady(false);
      }
    }
    void checkBrowserCapabilities();
    void refreshHealth();
    const timer = window.setInterval(refreshHealth, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  async function installSelectedModel() {
    const modelName = backendHealth?.modelName || "base";
    setModelAction(`Downloading ${modelName}. Keep this page open.`);
    setCurrentStatus("MODEL_DOWNLOADING");
    try {
      await downloadLocalModel(modelName);
      await refreshHealth();
      setModelAction(`${modelName} ${t("was downloaded and verified.")}`);
      setCurrentStatus("SUCCESS");
    } catch (error) {
      setModelAction(error instanceof Error ? t(error.message) : t("Model download failed."));
      setCurrentStatus("ERROR");
    }
  }

  function testAudioEngine() {
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.025;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.08);
      oscillator.onended = () => void context.close();
      setAudioReady(true);
    } catch {
      setAudioReady(false);
    }
  }

  const statusLabel = useMemo(() => {
    if (currentStatus === "UPLOADING") return "uploading";
    if (currentStatus === "TRANSCRIBING") return "transcribing";
    if (currentStatus === "ALIGNING") return "aligning";
    if (currentStatus === "MODEL_DOWNLOADING") return "model";
    if (currentStatus === "ERROR") return "error";
    if (!['idle', 'uploading', 'transcribing', 'aligning', 'model', 'done'].includes(status)) return "error";
    if (status === "done" || sentences.length) return "done";
    return status;
  }, [currentStatus, sentences.length, status]);

  const statusMessage = useMemo(() => {
    if (statusLabel === "error") return modelAction ? t("Setup action failed") : t("Transcription failed");
    if (statusLabel === "uploading") return t("Reading audio");
    if (statusLabel === "transcribing") return t("Creating transcript locally");
    if (statusLabel === "aligning") return t("Aligning words and sentences");
    if (statusLabel === "model") return t("Downloading and verifying the local model");
    if (statusLabel === "done") return `${sentences.length} ${t(sentences.length === 1 ? "sentence ready" : "sentences ready")}`;
    return t("Ready for audio");
  }, [modelAction, sentences.length, statusLabel, t]);

  const transcriptionState = pipelineBusy
    ? "working"
    : session.transcriptionDiagnostics.status === "ready"
      ? "ready"
      : session.transcriptionDiagnostics.status === "failed"
        ? "failed"
        : "neutral";
  const alignmentState = pipelineBusy
    ? "working"
    : session.alignmentDiagnostics.status === "ready"
      ? "ready"
      : session.alignmentDiagnostics.status === "failed" || session.alignmentDiagnostics.status === "unavailable"
        ? "failed"
        : "neutral";
  const failureReason = statusLabel === "error"
    ? modelAction || session.transcriptionDiagnostics.error || (status !== "idle" ? status : "") || "The local transcription model could not process this audio."
    : "";

  return (
    <div className="glass stage">
      {!onboardingComplete ? (
        <section className="active-exercise-surface mb-6 rounded-[24px] p-5 sm:p-6" aria-label="First-run system readiness">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t("First-run check")}</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{t("Prepare the local listening engine")}</h2><p className="mt-1 text-sm text-slate-600">{t("Every status below comes from a real browser or backend check.")}</p></div>
            <button className="rounded-xl bg-white/75 px-4 py-2.5 text-sm font-semibold text-slate-800" onClick={() => void refreshHealth()}>{t("Test backend")}</button>
          </div>
          <div className="mt-4 grid gap-x-6 rounded-[18px] bg-white/45 px-4 sm:grid-cols-2 lg:grid-cols-4">
            <DiagnosticRow label="Frontend" value="Loaded" state="ready" />
            <DiagnosticRow label="Backend" value={backendHealth ? "Connected" : healthError ? "Disconnected" : "Checking"} state={backendHealth ? "ready" : healthError ? "failed" : "working"} />
            <DiagnosticRow label="Python" value={backendHealth?.pythonVersion ? `Python ${backendHealth.pythonVersion}` : "Unavailable"} state={backendHealth?.pythonVersion ? "ready" : "failed"} />
            <DiagnosticRow label="Model" value={backendHealth?.modelAvailable ? "Installed" : "Missing"} state={backendHealth?.modelAvailable ? "ready" : "failed"} />
            <DiagnosticRow label="Alignment" value={backendHealth?.alignmentEngine ? "Available" : "Unavailable"} state={backendHealth?.alignmentEngine ? "ready" : "failed"} />
            <DiagnosticRow label="Storage" value={storageReady === null ? "Checking" : storageReady ? "Ready" : "Error"} state={storageReady === null ? "working" : storageReady ? "ready" : "failed"} />
            <DiagnosticRow label="Audio" value={audioReady === null ? "Checking" : audioReady ? "Ready" : "Error"} state={audioReady === null ? "working" : audioReady ? "ready" : "failed"} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm" onClick={() => setShowInstallHelp((value) => !value)}>{t("Install dependencies")}</button>
            <button className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-40" disabled={!backendHealth || Boolean(backendHealth.modelAvailable) || currentStatus === "MODEL_DOWNLOADING"} onClick={() => void installSelectedModel()}>{t("Download model")}</button>
            <button className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm" onClick={testAudioEngine}>{t("Test audio")}</button>
            <button className="ml-auto rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40" disabled={!backendHealth?.modelAvailable || !backendHealth.alignmentEngine || !storageReady || !audioReady} onClick={() => { window.localStorage.setItem("ielts-onboarding-complete", "true"); setOnboardingComplete(true); }}>{t("Continue to app")}</button>
          </div>
          {showInstallHelp ? <p className="mt-3 rounded-xl bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-white">{t("Close the app, then double-click setup.command. Return here after setup completes.")}</p> : null}
          {modelAction ? <p className="mt-3 text-sm font-semibold text-slate-700">{modelAction}</p> : null}
        </section>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">{t("Upload")}</p>
              <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">IELTS Listening AI Trainer</h1>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-full ${healthError ? "bg-rose-500" : backendHealth ? "bg-emerald-500" : "bg-slate-300"}`} />
              {healthError ? t("Local engine offline") : backendHealth ? t("Local engine online") : t("Checking local engine")}
            </div>
          </div>
          <AudioUploader disabled={busy || !appReady} onStatus={setStatus} />
          <UrlImporter disabled={busy || !appReady} onStatus={setStatus} />

          {backendHealth && backendHealth.modelAvailable === false ? (
            <section className="rounded-[20px] border border-amber-200/80 bg-amber-50/90 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-amber-950">{t("Local transcription model is not installed")}</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">{t("Install it before importing real audio. No demo transcript will be substituted.")}</p>
                </div>
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-900 text-white"
                  onClick={() => setShowInstallHelp((value) => !value)}
                  aria-label="Show local model installation instructions"
                  title="Install Local Transcription Model"
                >
                  <Terminal size={18} />
                </button>
              </div>
              {showInstallHelp ? (
                <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 font-mono text-xs leading-6 text-amber-950">
                  Double-click Mac/Mac.command and choose "Download the Whisper model", or run scripts/download-models.command.
                </p>
              ) : null}
            </section>
          ) : null}
        </section>

        <section className="soft-card rounded-[28px] p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-500">{t("Audio pipeline")}</p>
              <p className="mt-1 break-words text-xl font-semibold text-slate-900">{statusMessage}</p>
              {session.sourceName && statusLabel === "done" ? <p className="mt-1 truncate text-sm text-slate-500">{session.sourceName}</p> : null}
            </div>
            <span
              className={`mt-1 h-4 w-4 shrink-0 rounded-full ${
                statusLabel === "done"
                  ? "bg-emerald-500"
                  : busy
                    ? "pulse bg-amber-400"
                    : statusLabel === "error"
                      ? "bg-rose-500"
                      : "bg-slate-300"
              }`}
            />
          </div>

          {failureReason ? (
            <div className="mb-4 rounded-[18px] border border-rose-200 bg-rose-50/90 p-4">
              <p className="font-semibold text-rose-900">{failureReason}</p>
              <p className="mt-1 text-sm text-rose-700">{t("Check the model status below, then choose the audio again to retry.")}</p>
              <button type="button" className="mt-3 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                Return to audio input
              </button>
            </div>
          ) : null}

          <div className="grid gap-x-5 rounded-[18px] bg-white/50 px-4 py-2 sm:grid-cols-2">
            <div>
              <DiagnosticRow label="File" value={session.sourceName || "Waiting"} state={session.sourceName ? "ready" : "neutral"} />
              <DiagnosticRow label="Duration" value={formatDuration(session.audioMetadata.duration)} state={session.audioMetadata.duration ? "ready" : "neutral"} />
              <DiagnosticRow label="Codec" value={session.audioMetadata.codec?.toUpperCase() || "Unavailable"} state={session.audioMetadata.codec ? "ready" : "neutral"} />
              <DiagnosticRow label="Sample rate" value={session.audioMetadata.sampleRate ? `${session.audioMetadata.sampleRate.toLocaleString()} Hz` : "Unavailable"} state={session.audioMetadata.sampleRate ? "ready" : "neutral"} />
              <DiagnosticRow label="File size" value={formatBytes(session.audioMetadata.size)} state={session.audioMetadata.size ? "ready" : "neutral"} />
            </div>
            <div>
              <DiagnosticRow label="Model" value={session.transcriptionDiagnostics.modelName || backendHealth?.modelName || "Unknown"} state={backendHealth?.modelAvailable ? "ready" : "neutral"} />
              <DiagnosticRow label="Transcription" value={busy ? "Processing" : session.transcriptionDiagnostics.status} state={transcriptionState} />
              <DiagnosticRow label="Language" value={session.transcriptionDiagnostics.language?.toUpperCase() || "Waiting"} state={session.transcriptionDiagnostics.language ? "ready" : "neutral"} />
              <DiagnosticRow label="Alignment" value={session.alignmentDiagnostics.status} state={alignmentState} />
              <DiagnosticRow label="Aligned words" value={String(session.alignmentDiagnostics.wordCount ?? 0)} state={session.alignmentDiagnostics.wordCount ? "ready" : "neutral"} />
            </div>
          </div>

          {session.alignmentDiagnostics.status === "unavailable" ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"><span>{t("Word alignment unavailable. Precise word highlighting is disabled.")}</span><Link className="shrink-0 rounded-lg bg-amber-900 px-3 py-2 text-xs text-white" href="/settings">{t("Verify alignment")}</Link></div>
          ) : null}

          <div className="mt-4 min-h-52 rounded-[20px] bg-white/46 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{t("Transcript preview")}</h2>
              <span className="text-xs font-semibold text-slate-500">{sentences.length} sentence(s)</span>
            </div>
            <div className="max-h-[34vh] overflow-y-auto pr-2">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {transcriptText || t("Processed transcript will appear here after file upload or URL import.")}
              </p>
            </div>
          </div>

          <button
            className="mt-4 w-full rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!appReady || !sentences.length || busy}
            onClick={() => router.push("/practice")}
          >
            {session.answers.length ? t("Continue practice") : t("Start practice")}
          </button>
        </section>
      </div>
    </div>
  );
}
