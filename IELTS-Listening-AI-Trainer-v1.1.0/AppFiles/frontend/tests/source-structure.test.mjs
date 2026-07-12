import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the application mounts exactly one status-light component", () => {
  const layout = read("../app/layout.tsx");
  const practice = read("../app/practice/page.tsx");
  assert.equal((layout.match(/<PracticeStatusLights\s*\/>/g) ?? []).length, 1);
  assert.equal((practice.match(/PracticeStatusLights/g) ?? []).length, 0);
});

test("practice uses a viewport shell and intentional workspaces", () => {
  const styles = read("../app/globals.css");
  const practice = read("../app/practice/page.tsx");
  assert.match(styles, /body\.practice-route[\s\S]*height:\s*100dvh/);
  assert.match(styles, /body\.practice-route[\s\S]*overflow:\s*hidden/);
  assert.match(practice, /practice-workspace/);
});

test("shadowing separates viewed, audio, and practice sentence interactions", () => {
  const practice = read("../app/practice/page.tsx");
  assert.match(practice, /viewedSentenceIndex/);
  assert.match(practice, /data-sentence-index/);
  assert.match(practice, /onScroll=\{trackViewedSentence\}/);
  assert.match(practice, /onClick=\{\(\) => onSelect\(index\)\}/);
  assert.doesNotMatch(practice, /onScroll=\{[^}]*setCurrentSentenceIndex/);
});

test("one shared real audio element drives practice", () => {
  const player = read("../components/SentencePlayer.tsx");
  const practice = read("../app/practice/page.tsx");
  assert.equal((player.match(/<audio\b/g) ?? []).length, 1);
  assert.equal((practice.match(/<SentencePlayer\b/g) ?? []).length, 1);
  assert.match(player, /audio\.currentTime\s*=\s*nextTime/);
  assert.match(player, /audio\.playbackRate\s*=\s*playbackRate/);
});

test("keyboard playback toggling is separate from selection autoplay", () => {
  const player = read("../components/SentencePlayer.tsx");
  const practice = read("../app/practice/page.tsx");
  assert.match(player, /togglePlaybackRequest/);
  assert.match(player, /if \(!playingRef\.current\) void togglePlay\(\)/);
  assert.match(practice, /event\.code === "Space"[\s\S]*setTogglePlaybackRequest/);
  assert.doesNotMatch(practice, /event\.code === "Space"[\s\S]{0,160}setAutoPlayRequest/);
});

test("keyboard sentence navigation respects mode completion rules", () => {
  const practice = read("../app/practice/page.tsx");
  assert.match(practice, /const canMoveNext =/);
  assert.match(practice, /const canAdvanceWithShortcut =/);
  assert.match(practice, /event\.key === "Enter" && canAdvanceWithShortcut && canMoveNext/);
  assert.match(practice, /event\.key === "ArrowRight" && canMoveNext/);
});

test("transcript reading is a canonical practice mode using the shared timeline", () => {
  const practice = read("../app/practice/page.tsx");
  const store = read("../lib/practiceStore.tsx");
  const session = read("../lib/sessionStore.ts");
  assert.match(session, /practiceMode:\s*"shadowing" \| "cloze" \| "reading"/);
  assert.match(store, /startReading/);
  assert.match(practice, /mode === "shadowing" \|\| mode === "reading"/);
  assert.equal((practice.match(/<SentencePlayer\b/g) ?? []).length, 1);
  assert.equal((practice.match(/<TranscriptTimeline\b/g) ?? []).length, 1);
});

test("transcription completion preserves canonical session preferences", () => {
  const store = read("../lib/practiceStore.tsx");
  assert.match(store, /practiceMode:\s*current\.practiceMode/);
  assert.match(store, /practiceSettings:\s*current\.practiceSettings/);
  assert.match(store, /id:\s*current\.id/);
});

test("session database writes are coalesced and serialized", () => {
  const session = read("../lib/sessionStore.ts");
  assert.match(session, /pendingSessionRecord/);
  assert.match(session, /while \(pendingSessionRecord\)/);
  assert.match(session, /scheduleSessionRecord\(persisted\)/);
  assert.doesNotMatch(session, /void saveSessionRecord\(persisted\)/);
});

test("full Cloze respects attempt history preferences and records help usage", () => {
  const store = read("../lib/practiceStore.tsx");
  assert.match(store, /sentenceId: "full-cloze"/);
  assert.match(store, /preferences\.practice\.saveAllAttempts[\s\S]*item\.sentenceId !== "full-cloze"/);
  assert.match(store, /hintUsage: session\.hintHistory\.length/);
});

test("interface language is canonical, persistent, and used by every primary surface", () => {
  const preferences = read("../lib/userPreferences.tsx");
  const translations = read("../lib/i18n.ts");
  const settings = read("../app/settings/page.tsx");
  assert.match(preferences, /language: "en" \| "zh-CN"/);
  assert.match(preferences, /root\.lang = preferences\.appearance\.language/);
  assert.match(translations, /"Upload": "上传"/);
  assert.match(settings, /label="Interface Language"/);
  [
    "../components/TopNavigation.tsx",
    "../components/PracticeStatusLights.tsx",
    "../components/AudioUploader.tsx",
    "../components/UrlImporter.tsx",
    "../components/SentencePlayer.tsx",
    "../components/ClozeEngine.tsx",
    "../app/page.tsx",
    "../app/practice/page.tsx",
    "../app/analysis/page.tsx",
    "../app/settings/page.tsx"
  ].forEach((path) => assert.match(read(path), /useI18n/, `${path} must use the canonical interface language`));
});

test("required release commands and documents are present", () => {
  const required = [
    "../../../setup.command",
    "../../../start.command",
    "../../../stop.command",
    "../../../doctor.command",
    "../../../scripts/download-models.command",
    "../../../README.md",
    "../../../docs/INSTALLATION.md",
    "../../../docs/ARCHITECTURE.md",
    "../../../docs/PRIVACY.md",
    "../../../docs/TROUBLESHOOTING.md",
    "../../../docs/REGRESSION.md",
    "../../../CONTRIBUTING.md",
    "../../../SECURITY.md",
    "../../../.github/workflows/ci.yml",
    "../../../.github/workflows/release.yml",
    "../../../.gitattributes",
    "../../../scripts/build-release.command",
    "../../../CHANGELOG.md",
    "../../../.env.example",
    "../../../LICENSE"
  ];
  required.forEach((path) => assert.ok(read(path).trim().length > 0, `${path} should not be empty`));
  const stop = read("../../../stop.command");
  assert.match(stop, /belongs_to_project/);
  assert.match(stop, /lsof -a -p/);
  assert.doesNotMatch(stop, /pkill|killall/);
});

test("no backend source contains a silent sample transcript", () => {
  const api = read("../../backend/app/services/transcription.py");
  assert.doesNotMatch(api, /mock transcript|sample transcript|demo transcript/i);
  assert.match(api, /Local Whisper transcription failed/);
});
