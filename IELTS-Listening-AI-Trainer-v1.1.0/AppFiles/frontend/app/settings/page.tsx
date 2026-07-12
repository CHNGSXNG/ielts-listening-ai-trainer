"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Accessibility,
  Archive,
  CheckCircle2,
  Download,
  HardDrive,
  Headphones,
  Info,
  MonitorCog,
  Palette,
  Play,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload
} from "lucide-react";
import Modal from "../../components/Modal";
import { audioCacheSize, clearAudioCache } from "../../lib/audioCache";
import {
  clearServerAudioCache,
  deleteModel,
  downloadModel,
  getSystemStatus,
  selectModel,
  SystemStatus,
  verifyModel
} from "../../lib/api";
import { clearLocalBackupRecords, clearSessionRecords, deleteSessionRecords, listSessionRecords, loadLatestManualBackup, localBackupRecordsUsage, saveLocalBackupRecord, saveSessionRecord, sessionRecordsUsage } from "../../lib/sessionDatabase";
import { normalizeSession, TrainerSession } from "../../lib/sessionStore";
import { usePracticeStore } from "../../lib/practiceStore";
import { defaultUserPreferences, normalizeUserPreferences, UserPreferences, useUserPreferences } from "../../lib/userPreferences";
import { useI18n } from "../../lib/i18n";

type Category = "appearance" | "practice" | "transcript" | "audio" | "accessibility" | "storage" | "backup" | "about";
type BackupPayload = {
  schemaVersion: 2;
  exportedAt: string;
  sessions: TrainerSession[];
  preferences: UserPreferences;
  audioIncluded: false;
};

const categoryItems: Array<{ id: Category; label: string; Icon: typeof Palette }> = [
  { id: "appearance", label: "Appearance", Icon: Palette },
  { id: "practice", label: "Practice Defaults", Icon: SlidersHorizontal },
  { id: "transcript", label: "Transcript & Cloze", Icon: MonitorCog },
  { id: "audio", label: "Audio", Icon: Headphones },
  { id: "accessibility", label: "Accessibility", Icon: Accessibility },
  { id: "storage", label: "Storage & Models", Icon: HardDrive },
  { id: "backup", label: "Backup & Privacy", Icon: ShieldCheck },
  { id: "about", label: "About", Icon: Info }
];

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SettingGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="settings-group">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-950">{t(title)}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{t(description)}</p> : null}
      </div>
      <div className="divide-y divide-slate-200/65">{children}</div>
    </section>
  );
}

function SettingRow({ label, detail, children }: { label: string; detail?: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-16 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 sm:max-w-[62%]">
        <p className="text-sm font-semibold text-slate-900">{t(label)}</p>
        {detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{t(detail)}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={t(label)} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition disabled:opacity-35 ${checked ? "bg-[var(--accent)]" : "bg-slate-300/80"}`}>
      <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

function SelectControl({ value, onChange, children, label }: { value: string | number; onChange: (value: string) => void; children: React.ReactNode; label: string }) {
  const { t } = useI18n();
  return <select aria-label={t(label)} className="control h-10 min-w-40 rounded-xl px-3 text-sm font-semibold" value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>;
}

function Segments({ value, options, onChange, label }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; label: string }) {
  const { t } = useI18n();
  return (
    <div className="flex max-w-full overflow-x-auto rounded-xl bg-slate-200/60 p-1" role="group" aria-label={t(label)}>
      {options.map((option) => <button key={option.value} type="button" className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${value === option.value ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => onChange(option.value)}>{t(option.label)}</button>)}
    </div>
  );
}

function validateBackup(raw: unknown): BackupPayload {
  if (!raw || typeof raw !== "object") throw new Error("Backup file is not a JSON object.");
  const candidate = raw as Partial<BackupPayload> & { schemaVersion?: number };
  if (candidate.schemaVersion !== 2) throw new Error("Unsupported backup schema version.");
  if (!Array.isArray(candidate.sessions)) throw new Error("Backup sessions are missing.");
  const sessions = candidate.sessions.map((item, index) => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !Array.isArray(item.sentences) || !Array.isArray(item.answers)) {
      throw new Error(`Session ${index + 1} has an invalid structure.`);
    }
    const sentenceIds = item.sentences.map((sentence) => sentence?.id);
    if (sentenceIds.some((id) => typeof id !== "string" || !id) || new Set(sentenceIds).size !== sentenceIds.length) {
      throw new Error(`Session ${index + 1} has missing or duplicate sentence IDs.`);
    }
    if (item.sentences.some((sentence) => typeof sentence.text !== "string")) throw new Error(`Session ${index + 1} has an invalid transcript sentence.`);
    if (item.answers.some((attempt) => !attempt || typeof attempt.id !== "string" || typeof attempt.sentenceId !== "string" || typeof attempt.score !== "number" || typeof attempt.createdAt !== "string")) {
      throw new Error(`Session ${index + 1} has an invalid attempt record.`);
    }
    const normalized = normalizeSession(item);
    if (!normalized.id || !normalized.sentences.length) throw new Error(`Session ${index + 1} is invalid.`);
    return normalized;
  });
  return {
    schemaVersion: 2,
    exportedAt: typeof candidate.exportedAt === "string" ? candidate.exportedAt : new Date().toISOString(),
    sessions,
    preferences: normalizeUserPreferences(candidate.preferences ?? defaultUserPreferences),
    audioIncluded: false
  };
}

export default function SettingsPage() {
  const { language, t } = useI18n();
  const { preferences, resolvedTheme, updateSection, replacePreferences, resetPreferences } = useUserPreferences();
  const { session, clearSession, restoreSession, setCurrentStatus, updatePracticeSettings, startShadowing, startCloze, startReading } = usePracticeStore();
  const [category, setCategory] = useState<Category>("appearance");
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [sessions, setSessions] = useState<TrainerSession[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [browserAudioBytes, setBrowserAudioBytes] = useState(0);
  const [recordBytes, setRecordBytes] = useState(0);
  const [backupBytes, setBackupBytes] = useState(0);
  const [storageHealthy, setStorageHealthy] = useState(true);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null);
  const [confirmAction, setConfirmAction] = useState<"delete-sessions" | "clear-records" | "reset-all" | "delete-model" | null>(null);
  const [modelTarget, setModelTarget] = useState("base");
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const modelOperationRef = useRef(false);
  const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL;

  const refreshStatus = useCallback(async () => {
    let storageOk = true;
    const [usage, backups, audioBytes, backend] = await Promise.all([
      sessionRecordsUsage().catch(() => { storageOk = false; return { count: 0, bytes: 0, sessions: [] as TrainerSession[] }; }),
      localBackupRecordsUsage().catch(() => { storageOk = false; return { count: 0, bytes: 0 }; }),
      audioCacheSize().catch(() => { storageOk = false; return 0; }),
      getSystemStatus().catch(() => null)
    ]);
    setSessions(usage.sessions);
    setRecordBytes(usage.bytes);
    setBackupBytes(backups.bytes);
    setBrowserAudioBytes(audioBytes);
    setSystemStatus(backend);
    setStorageHealthy(storageOk);
  }, []);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  function begin(name: string) {
    setWorking(name);
    setMessage("");
    setCurrentStatus("BACKUP_WORKING");
  }

  function finish(text: string, success = true) {
    setMessage(text);
    setWorking("");
    setCurrentStatus(success ? "SUCCESS" : "ERROR");
    window.setTimeout(() => setCurrentStatus(session.sentences.length ? "READY" : "IDLE"), 1400);
  }

  async function createBackupPayload(): Promise<BackupPayload> {
    const records = await listSessionRecords();
    return { schemaVersion: 2, exportedAt: new Date().toISOString(), sessions: records, preferences, audioIncluded: false };
  }

  async function createBackup(exportFile = false) {
    begin(exportFile ? "export" : "backup");
    try {
      const payload = await createBackupPayload();
      await saveLocalBackupRecord({ id: "manual-latest", type: "manual", createdAt: payload.exportedAt, payload });
      updateSection("backup", { lastBackupAt: payload.exportedAt });
      if (exportFile) downloadJson(`ielts-listening-backup-${payload.exportedAt.slice(0, 10)}.json`, payload);
      finish(`${exportFile ? "Exported" : "Created"} a versioned backup with ${payload.sessions.length} session(s). Audio was excluded.`);
    } catch (error) {
      finish(error instanceof Error ? error.message : "Backup failed.", false);
    }
  }

  async function restoreLocalBackup() {
    begin("restore");
    try {
      const record = await loadLatestManualBackup();
      if (!record) throw new Error("No local backup is available yet.");
      setPendingImport(validateBackup(record.payload));
      setWorking("");
      setCurrentStatus("IDLE");
      setMessage("Local backup validated. Choose Merge or Replace.");
    } catch (error) {
      finish(error instanceof Error ? error.message : "Local backup could not be restored.", false);
    }
  }

  function readImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try { setPendingImport(validateBackup(JSON.parse(String(reader.result)))); }
      catch (error) { finish(error instanceof Error ? error.message : "Backup validation failed.", false); }
    };
    reader.readAsText(file);
  }

  async function applyImport(mode: "merge" | "replace") {
    if (!pendingImport) return;
    begin("import");
    try {
      if (mode === "replace") await clearSessionRecords();
      const existingIds = new Set(mode === "merge" ? (await listSessionRecords()).map((record) => record.id) : []);
      const importedRecords = pendingImport.sessions.map((record) => {
        if (!existingIds.has(record.id)) {
          existingIds.add(record.id);
          return record;
        }
        const imported = { ...record, id: `${record.id}-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, sourceName: `${record.sourceName || "Listening session"} · Imported copy` };
        existingIds.add(imported.id);
        return imported;
      });
      for (const record of importedRecords) await saveSessionRecord(record);
      replacePreferences(pendingImport.preferences);
      if (importedRecords[0]) restoreSession(importedRecords[0]);
      setPendingImport(null);
      await refreshStatus();
      finish(`${mode === "replace" ? "Replaced" : "Merged"} ${pendingImport.sessions.length} session(s) and restored preferences.`);
    } catch (error) {
      finish(error instanceof Error ? error.message : "Import failed.", false);
    }
  }

  async function runConfirmedAction() {
    const action = confirmAction;
    setConfirmAction(null);
    begin(action || "delete");
    try {
      if (action === "delete-sessions") {
        await deleteSessionRecords(selectedSessionIds);
        setSelectedSessionIds([]);
        finish("Selected sessions were deleted.");
      } else if (action === "clear-records") {
        await clearSessionRecords();
        clearSession();
        finish("All learning records were cleared.");
      } else if (action === "delete-model") {
        await deleteModel(modelTarget);
        finish(`Deleted the local ${modelTarget} model.`);
      } else if (action === "reset-all") {
        await Promise.all([clearSessionRecords(), clearLocalBackupRecords(), clearAudioCache(), clearServerAudioCache().catch(() => null)]);
        ["ielts-diagnostic-errors-v1", "ielts-recent-audio-sources-v1", "ielts-onboarding-complete"].forEach((key) => window.localStorage.removeItem(key));
        clearSession();
        resetPreferences();
        finish("All local learning data, preferences, and audio caches were reset.");
      }
      await refreshStatus();
    } catch (error) {
      finish(error instanceof Error ? error.message : "The operation failed.", false);
    }
  }

  async function runModelAction(action: "download" | "select" | "verify", modelName: string) {
    if (modelOperationRef.current) return;
    modelOperationRef.current = true;
    begin(`${action}-${modelName}`);
    if (action === "download") setCurrentStatus("MODEL_DOWNLOADING");
    try {
      if (action === "download") await downloadModel(modelName);
      if (action === "select") {
        await selectModel(modelName);
        updateSection("performance", { selectedModel: modelName as UserPreferences["performance"]["selectedModel"] });
      }
      if (action === "verify") {
        const result = await verifyModel(modelName);
        if (!result.valid) throw new Error(`${modelName} is missing or failed integrity verification.`);
      }
      await refreshStatus();
      finish(`${modelName} model ${action === "download" ? "downloaded and verified" : action === "select" ? "selected" : "verified"}.`);
    } catch (error) {
      finish(error instanceof Error ? error.message : "Model operation failed.", false);
    } finally {
      modelOperationRef.current = false;
    }
  }

  async function applyPerformanceProfile(profile: UserPreferences["performance"]["profile"]) {
    const target = profile === "speed" ? "tiny" : profile === "accuracy" ? "small" : "base";
    updateSection("performance", { profile, selectedModel: target });
    const installed = systemStatus?.models.find((model) => model.name === target)?.installed;
    if (!installed) {
      setMessage(`${profile === "accuracy" ? "Accuracy" : profile === "speed" ? "Speed" : "Balanced"} profile selected. Download ${target} explicitly to apply its transcription model.`);
      return;
    }
    await runModelAction("select", target);
  }

  function applyDefaultsToCurrentSession() {
    updatePracticeSettings({
      playbackMode: preferences.practice.playbackMode === "sentence-loop" ? "sentence" : "full",
      loopCount: preferences.practice.loopCount,
      replayInterval: preferences.practice.replayIntervalSeconds,
      playbackRate: preferences.practice.playbackRate,
      transcriptVisibility: preferences.transcript.visibility === "visible" ? "show" : preferences.transcript.visibility === "hidden" ? "hide" : "auto",
      followAudio: preferences.transcript.followAudio,
      clozeDifficulty: preferences.cloze.style === "full-mask" ? 3 : preferences.cloze.style === "intensive" ? 2 : 1
    });
    if (preferences.practice.defaultMode === "cloze") startCloze();
    else if (preferences.practice.defaultMode === "reading") startReading();
    else startShadowing();
    setMessage("Defaults were explicitly applied to the current session.");
  }

  function testAudio() {
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = Math.min(0.12, preferences.audio.volume * 0.12);
      oscillator.frequency.value = 660;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.16);
      oscillator.onended = () => void context.close();
      setMessage("Audio playback test completed.");
    } catch {
      setMessage("Audio playback test failed. Check browser audio permissions.");
    }
  }

  const installedModelBytes = systemStatus?.models.reduce((sum, model) => sum + model.size, 0) ?? 0;
  const totalLocalBytes = browserAudioBytes + recordBytes + backupBytes + installedModelBytes + (systemStatus?.audioCache.bytes ?? 0);
  const activeModel = systemStatus?.models.find((model) => model.selected);

  return (
    <div className="settings-shell mx-auto min-h-[calc(100vh-7rem)] max-w-[1500px] overflow-hidden rounded-[24px]">
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-slate-200/65 p-3 lg:w-64 lg:border-b-0 lg:border-r lg:p-4">
          <div className="mb-3 px-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("Preferences")}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">{t("Settings")}</h1>
          </div>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label={t("Settings categories")}>
            {categoryItems.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => setCategory(id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition ${category === id ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:bg-white/45"}`}><Icon size={17} />{t(label)}</button>)}
          </nav>
        </aside>

        <main className="settings-content min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 lg:px-9">
          {category === "appearance" ? <>
            <SettingGroup title="Appearance" description="Changes apply immediately and remain local to this browser.">
              <SettingRow label="Interface Language" detail="Choose the language used by navigation, controls, status messages, and settings."><Segments label="Interface Language" value={preferences.appearance.language} options={[{ value: "en", label: "English" }, { value: "zh-CN", label: "Simplified Chinese" }]} onChange={(value) => updateSection("appearance", { language: value as UserPreferences["appearance"]["language"] })} /></SettingRow>
              <SettingRow label="Appearance mode" detail={`Currently resolved to ${resolvedTheme}. System follows operating-system changes.`}><Segments label="Appearance mode" value={preferences.appearance.mode} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} onChange={(value) => updateSection("appearance", { mode: value as UserPreferences["appearance"]["mode"] })} /></SettingRow>
              <SettingRow label="Theme color" detail="Controls the atmospheric background and surface tint independently from the accent."><SelectControl label="Theme color" value={preferences.appearance.theme} onChange={(value) => updateSection("appearance", { theme: value as UserPreferences["appearance"]["theme"] })}>{[["glacier","Glacier Blue"],["arctic","Arctic White"],["midnight","Midnight"],["lavender","Lavender"],["mint","Mint"],["warm-sand","Warm Sand"],["graphite","Graphite"]].map(([value,label]) => <option key={value} value={value}>{t(label)}</option>)}</SelectControl></SettingRow>
              <SettingRow label="Accent color" detail="Used for controls, focus, active sentences, progress, and links."><div className="flex items-center gap-2">{["blue","purple","green","orange","red"].map((color) => <button key={color} type="button" aria-label={`${color} accent`} className={`size-9 rounded-full border-2 ${preferences.appearance.accent === color ? "border-slate-950" : "border-white"}`} style={{ background: { blue:"#315bea",purple:"#7c4dff",green:"#168a5b",orange:"#c75a16",red:"#c83a4c" }[color] }} onClick={() => updateSection("appearance", { accent: color as UserPreferences["appearance"]["accent"] })} />)}<input aria-label="Custom accent color" type="color" value={preferences.appearance.customAccent} onChange={(event) => updateSection("appearance", { accent: "custom", customAccent: event.target.value })} className="h-9 w-11 rounded-lg" /></div></SettingRow>
              <SettingRow label="Background" detail="Dynamic motion is disabled automatically by Reduce Motion and Low Power Mode."><div className="flex gap-2"><Segments label="Background mode" value={preferences.appearance.backgroundMode} options={[{value:"static",label:"Static"},{value:"dynamic",label:"Dynamic"}]} onChange={(value) => updateSection("appearance", { backgroundMode: value as "static" | "dynamic" })} /><SelectControl label="Dynamic style" value={preferences.appearance.dynamicStyle} onChange={(value) => updateSection("appearance", { dynamicStyle: value as UserPreferences["appearance"]["dynamicStyle"] })}><option value="gradient-drift">{t("Gradient Drift")}</option><option value="aurora">{t("Aurora")}</option><option value="soft-light">{t("Soft Light")}</option><option value="liquid-blur">{t("Liquid Blur")}</option><option value="off">{t("Off")}</option></SelectControl></div></SettingRow>
              <SettingRow label="Motion intensity"><Segments label="Motion intensity" value={preferences.appearance.motionIntensity} options={[{value:"subtle",label:"Subtle"},{value:"normal",label:"Normal"},{value:"expressive",label:"Expressive"}]} onChange={(value) => updateSection("appearance", { motionIntensity: value as UserPreferences["appearance"]["motionIntensity"] })} /></SettingRow>
              <SettingRow label="Glass intensity"><Segments label="Glass intensity" value={preferences.appearance.glassIntensity} options={[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"}]} onChange={(value) => updateSection("appearance", { glassIntensity: value as UserPreferences["appearance"]["glassIntensity"] })} /></SettingRow>
              <SettingRow label="Background blur"><Segments label="Background blur" value={preferences.appearance.blurIntensity} options={[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"}]} onChange={(value) => updateSection("appearance", { blurIntensity: value as UserPreferences["appearance"]["blurIntensity"] })} /></SettingRow>
              <SettingRow label="Noise texture"><Segments label="Noise texture" value={preferences.appearance.noiseIntensity} options={[{value:"off",label:"Off"},{value:"subtle",label:"Subtle"},{value:"visible",label:"Visible"}]} onChange={(value) => updateSection("appearance", { noiseIntensity: value as UserPreferences["appearance"]["noiseIntensity"] })} /></SettingRow>
              <SettingRow label="Layout density" detail="Compact compresses controls before reducing exercise space."><Segments label="Layout density" value={preferences.appearance.density} options={[{value:"comfortable",label:"Comfortable"},{value:"compact",label:"Compact"}]} onChange={(value) => updateSection("appearance", { density: value as "comfortable" | "compact" })} /></SettingRow>
            </SettingGroup>
            <section className="settings-preview mt-6 rounded-[20px] p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("Live preview")}</p><div className="mt-4 flex items-center justify-between gap-4"><button className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">{t("Active action")}</button><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-3/5 bg-[var(--accent)]" /></div><span className="text-sm font-semibold text-slate-700">{t("Listening")}</span></div><p className="mt-5 text-xl font-medium text-slate-950">{t("The current transcript sentence remains the visual focus.")}</p></section>
          </> : null}

          {category === "practice" ? <SettingGroup title="Practice Defaults" description="Defaults apply to new sessions. Use the explicit action below to change the active session.">
            <SettingRow label="Default practice mode"><Segments label="Default practice mode" value={preferences.practice.defaultMode} options={[{value:"shadowing",label:"Shadowing"},{value:"cloze",label:"Cloze"},{value:"reading",label:"Reading"}]} onChange={(value) => updateSection("practice", { defaultMode: value as "shadowing" | "cloze" | "reading" })} /></SettingRow>
            <SettingRow label="Default playback mode"><Segments label="Default playback mode" value={preferences.practice.playbackMode} options={[{value:"full",label:"Full Audio"},{value:"sentence-loop",label:"Sentence Loop"}]} onChange={(value) => updateSection("practice", { playbackMode: value as "full" | "sentence-loop" })} /></SettingRow>
            <SettingRow label="Loop count"><SelectControl label="Loop count" value={preferences.practice.loopCount} onChange={(value) => updateSection("practice", { loopCount: value === "infinite" ? "infinite" : Number(value) as 1|2|3|5 })}>{[1,2,3,5].map((value) => <option key={value} value={value}>{value}</option>)}<option value="infinite">{t("Infinite")}</option></SelectControl></SettingRow>
            <SettingRow label="Replay interval"><SelectControl label="Replay interval" value={preferences.practice.replayIntervalSeconds} onChange={(value) => updateSection("practice", { replayIntervalSeconds: Number(value) as 0|1|2|3|5 })}>{[0,1,2,3,5].map((value) => <option key={value} value={value}>{value} seconds</option>)}</SelectControl></SettingRow>
            <SettingRow label="Default playback speed"><SelectControl label="Default playback speed" value={preferences.practice.playbackRate} onChange={(value) => { const rate = Number(value) as UserPreferences["practice"]["playbackRate"]; updateSection("practice", { playbackRate: rate }); updateSection("audio", { playbackRate: rate }); }}>{[0.5,0.75,0.9,1,1.1,1.25,1.5,2].map((value) => <option key={value} value={value}>{value.toFixed(value % 1 ? 2 : 1)}x</option>)}</SelectControl></SettingRow>
            {[ ["autoFocusAnswer","Automatically focus the answer field"], ["autoPlaySentence","Automatically play a selected sentence"], ["autoNext","Move to the next sentence after a correct answer"], ["autoPlayNext","Automatically play the next sentence"], ["showAnswerAfterSubmit","Show the correct answer after submission"], ["saveAllAttempts","Save all attempts"], ["confirmResetSentence","Confirm before resetting a sentence"], ["resumeLastSession","Resume the last unfinished session on launch"] ].map(([key,label]) => <SettingRow key={key} label={label}><Toggle label={label} checked={Boolean(preferences.practice[key as keyof UserPreferences["practice"]])} onChange={(checked) => updateSection("practice", { [key]: checked })} /></SettingRow>)}
            <SettingRow label="Keyboard controls" detail="Enter submits Shadowing; Command/Ctrl+Enter advances; Space and arrows work outside text fields."><span className="text-xs font-semibold text-emerald-700">{t("Enabled through Accessibility")}</span></SettingRow>
            <SettingRow label="Apply defaults to current session" detail="This is the only action that overwrites active session-specific controls."><button type="button" disabled={!session.sentences.length} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-35" onClick={applyDefaultsToCurrentSession}>{t("Apply now")}</button></SettingRow>
          </SettingGroup> : null}

          {category === "transcript" ? <>
            <SettingGroup title="Transcript" description="Display preferences apply immediately; defaults are copied into new sessions where appropriate.">
              <SettingRow label="Default transcript visibility"><SelectControl label="Transcript visibility" value={preferences.transcript.visibility} onChange={(value) => updateSection("transcript", { visibility: value as UserPreferences["transcript"]["visibility"] })}><option value="visible">{t("Always Visible")}</option><option value="hidden">{t("Hidden")}</option><option value="reveal-after-submit">{t("Reveal After Submission")}</option></SelectControl></SettingRow>
              <SettingRow label="Chinese translation" detail="This controls transcript translation, not the interface language. No local translation model is installed."><span className="text-xs font-semibold text-slate-400">{t("Not installed")}</span></SettingRow>
              {[ ["wordHighlight","Word-by-word highlight"], ["followAudio","Follow audio automatically"], ["fadeInactive","Fade inactive sentences"], ["keepCurrentCentered","Keep current sentence near center"] ].map(([key,label]) => <SettingRow key={key} label={label}><Toggle label={label} checked={Boolean(preferences.transcript[key as keyof UserPreferences["transcript"]])} onChange={(checked) => updateSection("transcript", { [key]: checked })} /></SettingRow>)}
              <SettingRow label="Text size"><Segments label="Transcript text size" value={preferences.transcript.textSize} options={[{value:"small",label:"Small"},{value:"medium",label:"Medium"},{value:"large",label:"Large"},{value:"extra-large",label:"Extra Large"}]} onChange={(value) => updateSection("transcript", { textSize: value as UserPreferences["transcript"]["textSize"] })} /></SettingRow>
              <SettingRow label="Line spacing"><Segments label="Line spacing" value={preferences.transcript.lineSpacing} options={[{value:"compact",label:"Compact"},{value:"normal",label:"Normal"},{value:"relaxed",label:"Relaxed"}]} onChange={(value) => updateSection("transcript", { lineSpacing: value as UserPreferences["transcript"]["lineSpacing"] })} /></SettingRow>
              <SettingRow label="Current sentence position"><Segments label="Current sentence position" value={preferences.transcript.currentSentencePosition} options={[{value:"upper",label:"Upper Third"},{value:"center",label:"Center"},{value:"lower",label:"Lower Third"}]} onChange={(value) => updateSection("transcript", { currentSentencePosition: value as UserPreferences["transcript"]["currentSentencePosition"] })} /></SettingRow>
            </SettingGroup>
            <SettingGroup title="Cloze" description="Hint use remains recorded in session analytics.">
              <SettingRow label="Default Cloze style"><Segments label="Default Cloze style" value={preferences.cloze.style} options={[{value:"keyword",label:"Keyword"},{value:"intensive",label:"Intensive"},{value:"full-mask",label:"Full Mask"}]} onChange={(value) => updateSection("cloze", { style: value as UserPreferences["cloze"]["style"] })} /></SettingRow>
              <SettingRow label="Word Bank difficulty"><SelectControl label="Word Bank difficulty" value={preferences.cloze.wordBankDifficulty} onChange={(value) => updateSection("cloze", { wordBankDifficulty: value as UserPreferences["cloze"]["wordBankDifficulty"] })}><option value="easy">{t("Exact Answers Only")}</option><option value="medium">{t("Answers + 1–2 Distractors")}</option><option value="hard">{t("Answers + 3–5 Distractors")}</option></SelectControl></SettingRow>
              <SettingRow label="Scoring strictness" detail="Standard is the current validated scoring behavior."><Segments label="Scoring strictness" value={preferences.cloze.strictness} options={[{value:"lenient",label:"Lenient"},{value:"standard",label:"Standard"},{value:"strict",label:"Strict"}]} onChange={(value) => updateSection("cloze", { strictness: value as UserPreferences["cloze"]["strictness"] })} /></SettingRow>
              {[ ["caseSensitive","Case-sensitive scoring"], ["strictPlural","Strict singular/plural checking"], ["strictPunctuation","Strict punctuation checking"], ["spellingTolerance","Allow minor spelling tolerance"], ["contractionsEquivalent","Treat contractions as equivalent"] ].map(([key,label]) => <SettingRow key={key} label={label}><Toggle label={label} checked={Boolean(preferences.cloze[key as keyof UserPreferences["cloze"]])} onChange={(checked) => updateSection("cloze", { [key]: checked })} /></SettingRow>)}
              {[ ["firstLetterHint","Enable First Letter"], ["revealWordHint","Enable Reveal Word"], ["revealSentenceHint","Enable Reveal Sentence"] ].map(([key,label]) => <SettingRow key={key} label={label}><Toggle label={label} checked={Boolean(preferences.cloze[key as keyof UserPreferences["cloze"]])} onChange={(checked) => updateSection("cloze", { [key]: checked })} /></SettingRow>)}
              <SettingRow label="Maximum hints per sentence"><input aria-label="Maximum hints per sentence" type="number" min={0} max={10} className="control h-10 w-24 rounded-xl px-3" value={preferences.cloze.maxHintsPerSentence} onChange={(event) => updateSection("cloze", { maxHintsPerSentence: Math.max(0, Math.min(10, Number(event.target.value))) })} /></SettingRow>
            </SettingGroup>
          </> : null}

          {category === "audio" ? <SettingGroup title="Audio" description="These controls affect the existing shared audio element; aligned timestamps remain unchanged.">
            <SettingRow label="Default volume" detail={`${Math.round(preferences.audio.volume * 100)}%`}><input aria-label="Default volume" type="range" min={0} max={1} step={0.05} value={preferences.audio.volume} onChange={(event) => updateSection("audio", { volume: Number(event.target.value) })} /></SettingRow>
            <SettingRow label="Default playback speed"><SelectControl label="Audio playback speed" value={preferences.audio.playbackRate} onChange={(value) => { const rate = Number(value) as UserPreferences["audio"]["playbackRate"]; updateSection("audio", { playbackRate: rate }); updateSection("practice", { playbackRate: rate }); }}>{[0.5,0.75,0.9,1,1.1,1.25,1.5,2].map((value) => <option key={value} value={value}>{value}x</option>)}</SelectControl></SettingRow>
            <SettingRow label="Use native audio controls" detail="Applied in Full Audio mode; sentence clips keep the precise custom controller."><Toggle label="Use native audio controls" checked={preferences.audio.useNativeControls} onChange={(checked) => updateSection("audio", { useNativeControls: checked })} /></SettingRow>
            {[ ["autoPlayAfterSelection","Auto-play after sentence selection"], ["stopOnSentenceChange","Stop playback when switching sentences"], ["seekPreview","Show seek preview"], ["autoScrollTranscript","Auto-scroll transcript during full playback"] ].map(([key,label]) => <SettingRow key={key} label={label}><Toggle label={label} checked={Boolean(preferences.audio[key as keyof UserPreferences["audio"]])} onChange={(checked) => updateSection("audio", { [key]: checked })} /></SettingRow>)}
            <SettingRow label="Start padding" detail="Playback comfort only; original alignment is preserved."><input aria-label="Start padding milliseconds" type="range" min={0} max={300} step={10} value={preferences.audio.startPaddingMs} onChange={(event) => updateSection("audio", { startPaddingMs: Number(event.target.value) })} /><span className="ml-3 text-xs font-semibold text-slate-500">{preferences.audio.startPaddingMs} ms</span></SettingRow>
            <SettingRow label="End padding" detail="Playback comfort only; original alignment is preserved."><input aria-label="End padding milliseconds" type="range" min={0} max={300} step={10} value={preferences.audio.endPaddingMs} onChange={(event) => updateSection("audio", { endPaddingMs: Number(event.target.value) })} /><span className="ml-3 text-xs font-semibold text-slate-500">{preferences.audio.endPaddingMs} ms</span></SettingRow>
            <SettingRow label="Fade in"><SelectControl label="Fade in" value={preferences.audio.fadeInMs} onChange={(value) => updateSection("audio", { fadeInMs: Number(value) as 0|50|100|200 })}>{[0,50,100,200].map((value) => <option key={value} value={value}>{value ? `${value} ms` : t("Off")}</option>)}</SelectControl></SettingRow>
            <SettingRow label="Fade out"><SelectControl label="Fade out" value={preferences.audio.fadeOutMs} onChange={(value) => updateSection("audio", { fadeOutMs: Number(value) as 0|50|100|200 })}>{[0,50,100,200].map((value) => <option key={value} value={value}>{value ? `${value} ms` : t("Off")}</option>)}</SelectControl></SettingRow>
            <SettingRow label="Waveform" detail="No waveform engine is bundled, so an unsupported switch is not shown."><span className="text-xs font-semibold text-slate-400">{t("Not installed")}</span></SettingRow>
          </SettingGroup> : null}

          {category === "accessibility" ? <SettingGroup title="Accessibility" description="System Reduce Motion and contrast preferences are respected automatically where available.">
            {[ ["reduceMotion","Reduce Motion"], ["highContrast","High Contrast"], ["largeText","Larger Interface Text"], ["strongFocus","Strong Focus Indicators"], ["keyboardNavigation","Keyboard Navigation"], ["screenReaderLabels","Screen Reader Enhanced Labels"], ["dyslexiaFont","Dyslexia-friendly Font"], ["soundFeedback","Sound Feedback for Status Changes"] ].map(([key,label]) => <SettingRow key={key} label={label}><Toggle label={label} checked={Boolean(preferences.accessibility[key as keyof UserPreferences["accessibility"]])} onChange={(checked) => updateSection("accessibility", { [key]: checked })} /></SettingRow>)}
            <SettingRow label="Color vision mode" detail="Status lights keep text and icon labels in every mode."><SelectControl label="Color vision mode" value={preferences.accessibility.colorVisionMode} onChange={(value) => updateSection("accessibility", { colorVisionMode: value as UserPreferences["accessibility"]["colorVisionMode"] })}><option value="default">{t("Default")}</option><option value="red-green">{t("Red–Green Assistance")}</option><option value="blue-yellow">{t("Blue–Yellow Assistance")}</option><option value="monochrome">{t("Monochrome Status Assistance")}</option></SelectControl></SettingRow>
          </SettingGroup> : null}

          {category === "storage" ? <>
            <SettingGroup title="Local Storage" description={`Estimated total local usage: ${formatBytes(totalLocalBytes)}. Values are measured from browser records, browser audio, server URL cache, and installed models.`}>
              <SettingRow label="Stored sessions"><span className="text-sm font-semibold text-slate-900">{sessions.length} · {formatBytes(recordBytes)}</span></SettingRow>
              <SettingRow label="Local backups"><span className="text-sm font-semibold text-slate-900">{formatBytes(backupBytes)}</span></SettingRow>
              <SettingRow label="Audio cache"><span className="text-sm font-semibold text-slate-900">{formatBytes(browserAudioBytes + (systemStatus?.audioCache.bytes ?? 0))}</span></SettingRow>
              <SettingRow label="Installed models"><span className="text-sm font-semibold text-slate-900">{formatBytes(installedModelBytes)}</span></SettingRow>
              <SettingRow label="Clear audio cache" detail="Removes browser audio and backend URL-import cache while keeping learning records."><button disabled={Boolean(working)} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-35" onClick={async () => { begin("cache"); try { await Promise.all([clearAudioCache(), clearServerAudioCache()]); await refreshStatus(); finish(t("Audio caches were cleared.")); } catch { finish(t("Audio cache could not be cleared."), false); } }}>{t("Clear Audio Cache")}</button></SettingRow>
              <SettingRow label="Delete selected sessions" detail="Select records below; deletion requires confirmation."><button disabled={!selectedSessionIds.length || Boolean(working)} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-35" onClick={() => setConfirmAction("delete-sessions")}>{t("Delete Selected")}</button></SettingRow>
              <div className="max-h-48 overflow-y-auto py-2">{sessions.map((record) => <label key={record.id} className="flex items-center gap-3 py-2 text-sm text-slate-700"><input type="checkbox" checked={selectedSessionIds.includes(record.id)} onChange={(event) => setSelectedSessionIds((current) => event.target.checked ? [...current, record.id] : current.filter((id) => id !== record.id))} /><span className="min-w-0 flex-1 truncate">{record.sourceName || t("Untitled session")}</span><span className="text-xs text-slate-400">{record.answers.length} {t("attempts")}</span></label>)}</div>
              <SettingRow label="Clear all learning records"><button className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => setConfirmAction("clear-records")}>{t("Clear Records")}</button></SettingRow>
              <SettingRow label="Reset all local data" detail="Clears learning records, caches, local preferences, and restore points."><button className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => setConfirmAction("reset-all")}>{t("Reset All")}</button></SettingRow>
            </SettingGroup>
            <SettingGroup title="Model Management" description={systemStatus ? `Engine: ${systemStatus.engine.engine}. Models are stored in the app-managed local cache.` : "Backend is disconnected."}>
              {(["tiny", "base", "small", "medium"] as const).map((name) => {
                const model = systemStatus?.models.find((item) => item.name === name);
                const descriptions = {
                  tiny: "Fastest, lower accuracy",
                  base: "Recommended for normal use",
                  small: "Higher accuracy",
                  medium: "Highest supported accuracy, slower"
                };
                return (
                  <div key={name} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold capitalize text-slate-900">{name} {model?.selected ? `· ${t("Active")}` : ""}</p>
                      <p className="mt-1 text-xs text-slate-500">{t(descriptions[name])} · {model?.installed ? formatBytes(model.size) : t("Not installed")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {model?.installed ? (
                        <>
                          <button disabled={Boolean(working)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm disabled:opacity-35" onClick={() => void runModelAction("verify", name)}>{t("Verify")}</button>
                          <button disabled={Boolean(working) || model.selected} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-35" onClick={() => void runModelAction("select", name)}>{t("Switch")}</button>
                          <button disabled={Boolean(working) || model.selected} title={model.selected ? t("Switch to another installed model before deleting this one") : t("Delete model")} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35" onClick={() => { setModelTarget(name); setConfirmAction("delete-model"); }}>{t("Delete")}</button>
                        </>
                      ) : (
                        <button disabled={Boolean(working)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-35" onClick={() => void runModelAction("download", name)}>{working === `download-${name}` ? t("Downloading...") : t("Download")}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </SettingGroup>
            <SettingGroup title="Performance Profile" description="Profiles adjust recommendations only and never download a larger model silently.">
              <SettingRow label="Profile"><Segments label="Performance profile" value={preferences.performance.profile} options={[{value:"speed",label:"Prioritize Speed"},{value:"balanced",label:"Balanced"},{value:"accuracy",label:"Prioritize Accuracy"}]} onChange={(value) => void applyPerformanceProfile(value as UserPreferences["performance"]["profile"])} /></SettingRow>
              <SettingRow label="Low Power Mode" detail="Uses static visuals and reduced motion; it suggests a lighter model but never downloads it."><Toggle label="Low Power Mode" checked={preferences.performance.lowPowerMode} onChange={(checked) => updateSection("performance", { lowPowerMode: checked })} /></SettingRow>
            </SettingGroup>
          </> : null}

          {category === "backup" ? <>
            <SettingGroup title="Backup" description="Backups contain sessions, attempts, scores, analytics source records, and preferences. Cached audio is excluded.">
              <div className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-4"><button disabled={Boolean(working)} className="settings-action" onClick={() => void createBackup(false)}><Archive size={18} />{t("Create Backup")}</button><button disabled={Boolean(working)} className="settings-action" onClick={() => void restoreLocalBackup()}><RefreshCw size={18} />{t("Restore Local")}</button><button disabled={Boolean(working)} className="settings-action" onClick={() => void createBackup(true)}><Download size={18} />{t("Export Backup")}</button><label className="settings-action cursor-pointer"><Upload size={18} />{t("Import Backup")}<input className="sr-only" type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) readImport(file); event.target.value = ""; }} /></label></div>
              <SettingRow label="Last backup"><span className="text-sm font-semibold text-slate-700">{preferences.backup.lastBackupAt ? new Date(preferences.backup.lastBackupAt).toLocaleString(language) : t("Never")}</span></SettingRow>
              <SettingRow label="Automatic local snapshots"><SelectControl label="Automatic backup frequency" value={preferences.backup.autoBackup} onChange={(value) => updateSection("backup", { autoBackup: value as UserPreferences["backup"]["autoBackup"] })}><option value="off">{t("Off")}</option><option value="daily">{t("Daily")}</option><option value="weekly">{t("Weekly")}</option><option value="monthly">{t("Monthly")}</option></SelectControl></SettingRow>
              <SettingRow label="Snapshot retention"><SelectControl label="Snapshot retention" value={preferences.backup.retentionCount} onChange={(value) => updateSection("backup", { retentionCount: Number(value) as 3|5|10 })}>{[3,5,10].map((value) => <option key={value} value={value}>Latest {value}</option>)}</SelectControl></SettingRow>
            </SettingGroup>
            <SettingGroup title="Privacy" description="Audio and transcription stay local. No paid AI API or external analytics service is used.">
              {[ ["retainFileNames","Retain original file names"], ["retainUrls","Retain imported URLs"], ["retainRecentFiles","Store recent file history"], ["diagnosticLogs","Keep non-sensitive diagnostic errors"] ].map(([key,label]) => <SettingRow key={key} label={label}><Toggle label={label} checked={Boolean(preferences.privacy[key as keyof UserPreferences["privacy"]])} onChange={(checked) => updateSection("privacy", { [key]: checked })} /></SettingRow>)}
              <SettingRow label="Clear URL and diagnostic history"><button className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm" onClick={() => { window.localStorage.removeItem("ielts-diagnostic-errors-v1"); window.localStorage.removeItem("ielts-recent-audio-sources-v1"); setMessage(t("URL, recent-file, and diagnostic history were cleared.")); }}>{t("Clear History")}</button></SettingRow>
            </SettingGroup>
            <SettingGroup title="System Health" description="Values come from live browser and backend checks.">
              <SettingRow label="Backend"><span className={`text-sm font-semibold ${systemStatus ? "text-emerald-700" : "text-rose-700"}`}>{systemStatus ? t("Connected") : t("Disconnected")}</span></SettingRow>
              <SettingRow label="Audio Engine"><span className="text-sm font-semibold text-emerald-700">{typeof Audio !== "undefined" ? t("Ready") : t("Error")}</span></SettingRow>
              <SettingRow label="Transcription Model"><span className={`text-sm font-semibold ${activeModel?.installed ? "text-emerald-700" : "text-amber-700"}`}>{activeModel?.installed ? `${activeModel.name} installed` : "Missing or invalid"}</span></SettingRow>
              <SettingRow label="Alignment"><span className="text-sm font-semibold text-slate-700">{systemStatus?.engine.alignmentEngine ? t("Available") : t("Unavailable")}</span></SettingRow>
              <SettingRow label="Storage"><span className={`text-sm font-semibold ${storageHealthy ? "text-emerald-700" : "text-rose-700"}`}>{storageHealthy ? `Available · ${formatBytes(totalLocalBytes)}` : "Error"}</span></SettingRow>
              <SettingRow label="Last Backup"><span className="text-sm font-semibold text-slate-700">{preferences.backup.lastBackupAt ? new Date(preferences.backup.lastBackupAt).toLocaleString(language) : t("Never")}</span></SettingRow>
              <div className="flex flex-wrap gap-2 py-4"><button className="settings-action" onClick={() => void refreshStatus()}><RefreshCw size={16} />{t("Test Backend")}</button><button className="settings-action" onClick={testAudio}><Play size={16} />{t("Test Audio")}</button><button disabled={!activeModel} className="settings-action" onClick={() => activeModel && void runModelAction("verify", activeModel.name)}><CheckCircle2 size={16} />{t("Verify Model")}</button><button className="settings-action" onClick={() => { void getSystemStatus().then((status) => { setSystemStatus(status); setMessage(status.engine.alignmentEngine ? t("Alignment engine is available.") : t("Alignment engine is unavailable.")); }).catch(() => setMessage(t("Alignment verification failed because the backend is disconnected."))); }}><CheckCircle2 size={16} />{t("Verify Alignment")}</button><button className="settings-action" onClick={() => downloadJson("ielts-diagnostic-report.json", { appVersion:"1.1.0", frontendVersion:"1.1.0", backendVersion:systemStatus?.backendVersion ?? "disconnected", operatingSystem:systemStatus?.platform ?? navigator.platform, architecture:systemStatus?.architecture ?? "unknown", installedModels:systemStatus?.models.map(({name,installed,size,selected}) => ({name,installed,size,selected})) ?? [], modelStatus:systemStatus?.engine.modelAvailable ?? false, ports:systemStatus?.ports ?? {frontend:3001,backend:8000}, recentErrors: preferences.privacy.diagnosticLogs ? JSON.parse(window.localStorage.getItem("ielts-diagnostic-errors-v1") || "[]") : [] })}><Download size={16} />{t("Export Diagnostics")}</button></div>
            </SettingGroup>
          </> : null}

          {category === "about" ? <SettingGroup title="About" description="Local-first, open-source IELTS listening practice.">
            <SettingRow label="Application"><div className="text-right"><p className="text-sm font-semibold text-slate-900">IELTS Listening AI Trainer</p><p className="text-xs text-slate-500">{t("Version")} 1.1.0</p></div></SettingRow>
            <SettingRow label="Made by"><span className="text-sm font-semibold text-slate-900">CHNGSXNG</span></SettingRow>
            <SettingRow label="Open-source license"><span className="text-sm font-semibold text-slate-700">MIT</span></SettingRow>
            <SettingRow label="Local model"><span className="text-sm font-semibold text-slate-700">OpenAI Whisper · {activeModel?.name ?? t("not selected")}</span></SettingRow>
            <SettingRow label="GitHub repository" detail={githubUrl ? "Open the configured source repository." : "Set NEXT_PUBLIC_GITHUB_URL to enable this action; no fake destination is used."}>{githubUrl ? <a className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm" href={githubUrl} target="_blank" rel="noreferrer">{t("Open Repository")}</a> : <span className="text-xs font-semibold text-slate-400">{t("Not configured")}</span>}</SettingRow>
            <SettingRow label="Release notes"><button className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm" onClick={() => setShowReleaseNotes(true)}>{t("View Release Notes")}</button></SettingRow>
            <SettingRow label="Reset onboarding"><button className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm" onClick={() => { window.localStorage.removeItem("ielts-onboarding-complete"); setMessage(t("The first-run system check will appear the next time Upload opens.")); }}>{t("Reset")}</button></SettingRow>
          </SettingGroup> : null}

          {message ? <p className="sticky bottom-3 mt-5 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl">{t(message)}</p> : null}
        </main>
      </div>

      <Modal open={Boolean(pendingImport)} title={t("Import validated backup")} onClose={() => setPendingImport(null)}><p className="text-sm leading-7 text-slate-600">{t("{{count}} session(s) passed validation. Merge keeps existing records; Replace clears local learning records first. Preferences are restored in both modes.", { count: pendingImport?.sessions.length ?? 0 })}</p><div className="mt-5 flex gap-3"><button className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" onClick={() => void applyImport("merge")}>{t("Merge")}</button><button className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white" onClick={() => void applyImport("replace")}>{t("Replace")}</button></div></Modal>
      <Modal open={Boolean(confirmAction)} title={t("Confirm destructive action")} onClose={() => setConfirmAction(null)}><p className="text-sm leading-7 text-slate-600">{t("This operation changes local files or learning records and cannot be undone from the app unless you exported a backup.")}</p><button className="mt-5 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white" onClick={() => void runConfirmedAction()}>{t("Confirm")}</button></Modal>
      <Modal open={showReleaseNotes} title={`${t("Version")} 1.1.0`} onClose={() => setShowReleaseNotes(false)}><ul className="space-y-2 text-sm leading-6 text-slate-600"><li>{t("English and Simplified Chinese interface support.")}</li><li>{t("Word-aligned local transcription and precise sentence playback.")}</li><li>{t("Persistent Shadowing attempts and sentence-scoped inline Cloze.")}</li><li>{t("Versioned backups, model verification, diagnostics, and lightweight setup scripts.")}</li></ul></Modal>
    </div>
  );
}
