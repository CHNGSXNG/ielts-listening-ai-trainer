import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("../node_modules/typescript");
const source = readFileSync(new URL("../lib/audioTimeline.ts", import.meta.url), "utf8");
const compiled = typescript.transpileModule(source, {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2020 }
}).outputText;
const runtimeModule = { exports: {} };
new Function("module", "exports", "require", compiled)(runtimeModule, runtimeModule.exports, () => ({}));
const { computeClipBounds } = runtimeModule.exports;

const timeline = [
  { id: "s1", text: "One.", start: 2, end: 4 },
  { id: "s2", text: "Two.", start: 4.2, end: 6 },
  { id: "s3", text: "Three.", start: 6.3, end: 8 }
];

test("clip padding never bleeds into the next sentence", () => {
  const bounds = computeClipBounds({ timeline, startTime: 2, endTime: 4, duration: 9, startPaddingMs: 300, endPaddingMs: 300, playWholeAudio: false });
  assert.equal(bounds.start, 1.7);
  assert.ok(bounds.end < timeline[1].start);
  assert.ok(Math.abs(bounds.end - 4.188) < 0.000001);
});

test("start padding never overlaps the previous sentence", () => {
  const bounds = computeClipBounds({ timeline, startTime: 4.2, endTime: 6, duration: 9, startPaddingMs: 300, endPaddingMs: 0, playWholeAudio: false });
  assert.equal(bounds.start, 4.012);
  assert.equal(bounds.end, 6);
});

test("invalid sentence timing is rejected", () => {
  const bounds = computeClipBounds({ timeline, startTime: 4, endTime: 3, duration: 9, startPaddingMs: 0, endPaddingMs: 0, playWholeAudio: false });
  assert.equal(Number.isNaN(bounds.start), true);
  assert.equal(Number.isNaN(bounds.end), true);
});
