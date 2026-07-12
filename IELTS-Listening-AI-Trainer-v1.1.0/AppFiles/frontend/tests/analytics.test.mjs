import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("../node_modules/typescript");
const source = readFileSync(new URL("../lib/sessionStore.ts", import.meta.url), "utf8");
const compiled = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 } }).outputText;
const runtimeModule = { exports: {} };
const dependency = (name) => name === "./scoring"
  ? { bandEstimate: (score) => Math.max(1, Math.min(9, Math.round(score / 10))) }
  : { clearSessionRecords() {}, loadCurrentSessionRecord() {}, saveSessionRecord() {} };
new Function("module", "exports", "require", compiled)(runtimeModule, runtimeModule.exports, dependency);
const { attemptMetrics, recommendation } = runtimeModule.exports;

const attempt = (id, sentenceId, score, createdAt, mistakes = []) => ({ id, sentenceId, mode: "shadowing", answer: "answer", score, mistakes, createdAt });

test("analysis calculates first, latest, and best attempts from real records", () => {
  const session = {
    answers: [
      attempt("a1", "session-a:s1", 40, "2026-01-01T00:00:00Z"),
      attempt("a2", "session-a:s1", 80, "2026-01-02T00:00:00Z"),
      attempt("b1", "session-b:s1", 60, "2026-01-03T00:00:00Z"),
      attempt("b2", "session-b:s1", 50, "2026-01-04T00:00:00Z")
    ]
  };
  const metrics = attemptMetrics(session);
  assert.equal(metrics.practisedSentences, 2);
  assert.equal(metrics.firstAverage, 50);
  assert.equal(metrics.bestAverage, 70);
  assert.equal(metrics.latestAverage, 65);
  assert.deepEqual(metrics.trend, [40, 80, 60, 50]);
});

test("recommendations follow the most frequent stored mistake category", () => {
  const session = { answers: [attempt("a", "s1", 45, "2026-01-01T00:00:00Z", ["spelling"]), attempt("b", "s2", 50, "2026-01-02T00:00:00Z", ["numbers"])] };
  assert.equal(recommendation(session), "Focus on numbers and dates");
});
