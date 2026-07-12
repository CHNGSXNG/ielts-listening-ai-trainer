"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AppearanceMode = "light" | "dark" | "system";
export type ThemePreset = "glacier" | "arctic" | "midnight" | "lavender" | "mint" | "warm-sand" | "graphite";
export type AccentPreset = "blue" | "purple" | "green" | "orange" | "red" | "custom";
export type UserPreferences = {
  appearance: {
    language: "en" | "zh-CN";
    mode: AppearanceMode;
    theme: ThemePreset;
    accent: AccentPreset;
    customAccent: string;
    backgroundMode: "static" | "dynamic";
    dynamicStyle: "gradient-drift" | "aurora" | "soft-light" | "liquid-blur" | "off";
    motionIntensity: "subtle" | "normal" | "expressive";
    glassIntensity: "low" | "medium" | "high";
    blurIntensity: "low" | "medium" | "high";
    noiseIntensity: "off" | "subtle" | "visible";
    density: "comfortable" | "compact";
  };
  practice: {
    defaultMode: "shadowing" | "cloze" | "reading";
    playbackMode: "full" | "sentence-loop";
    loopCount: 1 | 2 | 3 | 5 | "infinite";
    replayIntervalSeconds: 0 | 1 | 2 | 3 | 5;
    playbackRate: 0.5 | 0.75 | 0.9 | 1 | 1.1 | 1.25 | 1.5 | 2;
    autoFocusAnswer: boolean;
    autoPlaySentence: boolean;
    autoNext: boolean;
    autoPlayNext: boolean;
    showAnswerAfterSubmit: boolean;
    saveAllAttempts: boolean;
    preserveBestScore: boolean;
    confirmResetSentence: boolean;
    resumeLastSession: boolean;
  };
  transcript: {
    visibility: "visible" | "hidden" | "reveal-after-submit";
    showTranslation: boolean;
    wordHighlight: boolean;
    followAudio: boolean;
    fadeInactive: boolean;
    keepCurrentCentered: boolean;
    textSize: "small" | "medium" | "large" | "extra-large";
    lineSpacing: "compact" | "normal" | "relaxed";
    currentSentencePosition: "upper" | "center" | "lower";
  };
  cloze: {
    style: "keyword" | "intensive" | "full-mask";
    wordBankDifficulty: "easy" | "medium" | "hard";
    strictness: "lenient" | "standard" | "strict";
    caseSensitive: boolean;
    strictPlural: boolean;
    strictPunctuation: boolean;
    spellingTolerance: boolean;
    contractionsEquivalent: boolean;
    firstLetterHint: boolean;
    revealWordHint: boolean;
    revealSentenceHint: boolean;
    maxHintsPerSentence: number;
  };
  audio: {
    volume: number;
    playbackRate: 0.5 | 0.75 | 0.9 | 1 | 1.1 | 1.25 | 1.5 | 2;
    useNativeControls: boolean;
    autoPlayAfterSelection: boolean;
    stopOnSentenceChange: boolean;
    seekPreview: boolean;
    autoScrollTranscript: boolean;
    startPaddingMs: number;
    endPaddingMs: number;
    fadeInMs: 0 | 50 | 100 | 200;
    fadeOutMs: 0 | 50 | 100 | 200;
  };
  accessibility: {
    reduceMotion: boolean;
    highContrast: boolean;
    largeText: boolean;
    strongFocus: boolean;
    keyboardNavigation: boolean;
    screenReaderLabels: boolean;
    dyslexiaFont: boolean;
    soundFeedback: boolean;
    colorVisionMode: "default" | "red-green" | "blue-yellow" | "monochrome";
  };
  performance: {
    profile: "speed" | "balanced" | "accuracy";
    lowPowerMode: boolean;
    selectedModel: "tiny" | "base" | "small" | "medium";
  };
  privacy: {
    retainFileNames: boolean;
    retainUrls: boolean;
    retainRecentFiles: boolean;
    diagnosticLogs: boolean;
  };
  backup: {
    autoBackup: "off" | "daily" | "weekly" | "monthly";
    retentionCount: 3 | 5 | 10;
    lastBackupAt?: string;
  };
};

export const preferencesStorageKey = "ielts-listening-user-preferences-v1";

export const defaultUserPreferences: UserPreferences = {
  appearance: {
    language: "en",
    mode: "system",
    theme: "glacier",
    accent: "blue",
    customAccent: "#315bea",
    backgroundMode: "static",
    dynamicStyle: "gradient-drift",
    motionIntensity: "subtle",
    glassIntensity: "medium",
    blurIntensity: "medium",
    noiseIntensity: "off",
    density: "comfortable"
  },
  practice: {
    defaultMode: "shadowing",
    playbackMode: "sentence-loop",
    loopCount: 1,
    replayIntervalSeconds: 0,
    playbackRate: 1,
    autoFocusAnswer: true,
    autoPlaySentence: false,
    autoNext: false,
    autoPlayNext: false,
    showAnswerAfterSubmit: true,
    saveAllAttempts: true,
    preserveBestScore: true,
    confirmResetSentence: true,
    resumeLastSession: true
  },
  transcript: {
    visibility: "reveal-after-submit",
    showTranslation: false,
    wordHighlight: true,
    followAudio: true,
    fadeInactive: true,
    keepCurrentCentered: true,
    textSize: "medium",
    lineSpacing: "normal",
    currentSentencePosition: "center"
  },
  cloze: {
    style: "keyword",
    wordBankDifficulty: "easy",
    strictness: "standard",
    caseSensitive: false,
    strictPlural: true,
    strictPunctuation: false,
    spellingTolerance: true,
    contractionsEquivalent: true,
    firstLetterHint: true,
    revealWordHint: true,
    revealSentenceHint: true,
    maxHintsPerSentence: 3
  },
  audio: {
    volume: 1,
    playbackRate: 1,
    useNativeControls: false,
    autoPlayAfterSelection: false,
    stopOnSentenceChange: true,
    seekPreview: true,
    autoScrollTranscript: true,
    startPaddingMs: 0,
    endPaddingMs: 0,
    fadeInMs: 0,
    fadeOutMs: 0
  },
  accessibility: {
    reduceMotion: false,
    highContrast: false,
    largeText: false,
    strongFocus: true,
    keyboardNavigation: true,
    screenReaderLabels: true,
    dyslexiaFont: false,
    soundFeedback: false,
    colorVisionMode: "default"
  },
  performance: { profile: "balanced", lowPowerMode: false, selectedModel: "base" },
  privacy: { retainFileNames: true, retainUrls: false, retainRecentFiles: true, diagnosticLogs: true },
  backup: { autoBackup: "off", retentionCount: 5 }
};

export function normalizeUserPreferences(raw?: Partial<UserPreferences>): UserPreferences {
  return {
    appearance: { ...defaultUserPreferences.appearance, ...(raw?.appearance ?? {}) },
    practice: { ...defaultUserPreferences.practice, ...(raw?.practice ?? {}) },
    transcript: { ...defaultUserPreferences.transcript, ...(raw?.transcript ?? {}) },
    cloze: { ...defaultUserPreferences.cloze, ...(raw?.cloze ?? {}) },
    audio: { ...defaultUserPreferences.audio, ...(raw?.audio ?? {}) },
    accessibility: { ...defaultUserPreferences.accessibility, ...(raw?.accessibility ?? {}) },
    performance: { ...defaultUserPreferences.performance, ...(raw?.performance ?? {}) },
    privacy: { ...defaultUserPreferences.privacy, ...(raw?.privacy ?? {}) },
    backup: { ...defaultUserPreferences.backup, ...(raw?.backup ?? {}) }
  };
}

export function loadUserPreferences(): UserPreferences {
  if (typeof window === "undefined") return defaultUserPreferences;
  try {
    const raw = window.localStorage.getItem(preferencesStorageKey);
    return raw ? normalizeUserPreferences(JSON.parse(raw) as Partial<UserPreferences>) : defaultUserPreferences;
  } catch {
    return defaultUserPreferences;
  }
}

const accentColors: Record<Exclude<AccentPreset, "custom">, string> = {
  blue: "#315bea",
  purple: "#7c4dff",
  green: "#168a5b",
  orange: "#c75a16",
  red: "#c83a4c"
};

const themeTokens: Record<ThemePreset, { background: string; lightSurface: string; darkSurface: string }> = {
  glacier: { background: "radial-gradient(circle at 76% 14%, rgba(43,196,241,.68), transparent 26%), linear-gradient(135deg,#1269b2 0%,#04a9d6 44%,#123b78 100%)", lightSurface: "rgba(244,249,253,.89)", darkSurface: "rgba(16,29,43,.91)" },
  arctic: { background: "radial-gradient(circle at 70% 18%,rgba(176,222,245,.72),transparent 30%),linear-gradient(140deg,#d7e8f3,#9bbbd0 52%,#527b9b)", lightSurface: "rgba(251,253,255,.92)", darkSurface: "rgba(24,35,45,.92)" },
  midnight: { background: "radial-gradient(circle at 72% 18%,rgba(65,89,167,.48),transparent 30%),linear-gradient(145deg,#080d1d,#152348 55%,#070b14)", lightSurface: "rgba(238,243,252,.9)", darkSurface: "rgba(15,20,38,.93)" },
  lavender: { background: "radial-gradient(circle at 72% 18%,rgba(205,166,255,.52),transparent 30%),linear-gradient(140deg,#7868b8,#c1a7e9 50%,#536aaf)", lightSurface: "rgba(250,247,255,.9)", darkSurface: "rgba(34,27,53,.92)" },
  mint: { background: "radial-gradient(circle at 68% 18%,rgba(164,255,222,.58),transparent 30%),linear-gradient(140deg,#247f83,#65cdb2 52%,#285b77)", lightSurface: "rgba(245,253,250,.9)", darkSurface: "rgba(18,42,41,.92)" },
  "warm-sand": { background: "radial-gradient(circle at 72% 18%,rgba(255,218,169,.55),transparent 30%),linear-gradient(140deg,#a66257,#d89c78 48%,#596d8d)", lightSurface: "rgba(255,250,244,.91)", darkSurface: "rgba(48,33,31,.92)" },
  graphite: { background: "radial-gradient(circle at 72% 18%,rgba(148,167,184,.34),transparent 30%),linear-gradient(145deg,#2c3945,#566675 50%,#1c2833)", lightSurface: "rgba(246,249,251,.9)", darkSurface: "rgba(25,31,37,.93)" }
};

function accentForeground(color: string) {
  const value = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : "315bea";
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.48 ? "#102033" : "#ffffff";
}

type PreferencesContextValue = {
  preferences: UserPreferences;
  resolvedTheme: "light" | "dark";
  updateSection: <K extends keyof UserPreferences>(section: K, patch: Partial<UserPreferences[K]>) => void;
  replacePreferences: (preferences: UserPreferences) => void;
  resetPreferences: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultUserPreferences);
  const [systemDark, setSystemDark] = useState(false);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const [systemHighContrast, setSystemHighContrast] = useState(false);

  useEffect(() => setPreferences(loadUserPreferences()), []);

  useEffect(() => {
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const contrastQuery = window.matchMedia("(prefers-contrast: more)");
    const sync = () => {
      setSystemDark(darkQuery.matches);
      setSystemReduceMotion(motionQuery.matches);
      setSystemHighContrast(contrastQuery.matches);
    };
    sync();
    darkQuery.addEventListener("change", sync);
    motionQuery.addEventListener("change", sync);
    contrastQuery.addEventListener("change", sync);
    return () => {
      darkQuery.removeEventListener("change", sync);
      motionQuery.removeEventListener("change", sync);
      contrastQuery.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const syncVisibility = () => { document.documentElement.dataset.pageVisible = String(!document.hidden); };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  const resolvedTheme = preferences.appearance.mode === "system" ? (systemDark ? "dark" : "light") : preferences.appearance.mode;

  useEffect(() => {
    const root = document.documentElement;
    const accent = preferences.appearance.accent === "custom" ? preferences.appearance.customAccent : accentColors[preferences.appearance.accent];
    const tokens = themeTokens[preferences.appearance.theme];
    const reduceMotion = preferences.accessibility.reduceMotion || systemReduceMotion || preferences.performance.lowPowerMode;
    const surfaceOpacity = preferences.appearance.glassIntensity === "low" ? 0.76 : preferences.appearance.glassIntensity === "high" ? 0.95 : 0.88;
    const baseSurface = resolvedTheme === "dark" ? tokens.darkSurface : tokens.lightSurface;
    root.dataset.resolvedTheme = resolvedTheme;
    root.lang = preferences.appearance.language;
    root.dataset.themePreset = preferences.appearance.theme;
    root.dataset.backgroundMode = reduceMotion || preferences.appearance.dynamicStyle === "off" ? "static" : preferences.appearance.backgroundMode;
    root.dataset.backgroundStyle = preferences.appearance.dynamicStyle;
    root.dataset.motionIntensity = preferences.appearance.motionIntensity;
    root.dataset.density = preferences.appearance.density;
    root.dataset.reduceMotion = String(reduceMotion);
    root.dataset.highContrast = String(preferences.accessibility.highContrast || systemHighContrast);
    root.dataset.strongFocus = String(preferences.accessibility.strongFocus);
    root.dataset.largeText = String(preferences.accessibility.largeText);
    root.dataset.dyslexiaFont = String(preferences.accessibility.dyslexiaFont);
    root.dataset.colorVision = preferences.accessibility.colorVisionMode;
    root.dataset.noise = preferences.appearance.noiseIntensity;
    root.dataset.transcriptSize = preferences.transcript.textSize;
    root.dataset.lineSpacing = preferences.transcript.lineSpacing;
    root.dataset.sentencePosition = preferences.transcript.currentSentencePosition;
    root.dataset.fadeInactive = String(preferences.transcript.fadeInactive);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-foreground", accentForeground(accent));
    root.style.setProperty("--accent-soft", `color-mix(in srgb, ${accent} 16%, transparent)`);
    root.style.setProperty("--app-background", tokens.background);
    root.style.setProperty("--surface-main", baseSurface.replace(/,\s*[\d.]+\)$/, `,${surfaceOpacity})`));
    root.style.setProperty("--glass-blur", preferences.appearance.blurIntensity === "low" ? "16px" : preferences.appearance.blurIntensity === "high" ? "38px" : "28px");
    root.style.setProperty("--surface-opacity", String(surfaceOpacity));
    root.style.setProperty("--noise-opacity", preferences.appearance.noiseIntensity === "off" ? "0" : preferences.appearance.noiseIntensity === "visible" ? "0.1" : "0.045");
  }, [preferences, resolvedTheme, systemHighContrast, systemReduceMotion]);

  const persist = useCallback((next: UserPreferences) => {
    setPreferences(next);
    window.localStorage.setItem(preferencesStorageKey, JSON.stringify(next));
  }, []);

  const updateSection = useCallback(<K extends keyof UserPreferences>(section: K, patch: Partial<UserPreferences[K]>) => {
    setPreferences((current) => {
      const next = { ...current, [section]: { ...current[section], ...patch } } as UserPreferences;
      window.localStorage.setItem(preferencesStorageKey, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => persist(defaultUserPreferences), [persist]);
  const value = useMemo(() => ({ preferences, resolvedTheme, updateSection, replacePreferences: persist, resetPreferences }), [persist, preferences, resetPreferences, resolvedTheme, updateSection]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useUserPreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("useUserPreferences must be used inside UserPreferencesProvider");
  return value;
}
