import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("../node_modules/typescript");
const source = readFileSync(new URL("../lib/status.ts", import.meta.url), "utf8");
const compiled = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2020 } }).outputText;
const runtimeModule = { exports: {} };
new Function("module", "exports", compiled)(runtimeModule, runtimeModule.exports);
const { statusLightColor } = runtimeModule.exports;

test("practice status lights follow score thresholds", () => {
  assert.equal(statusLightColor("RESULT", 85), "green");
  assert.equal(statusLightColor("RESULT", 55), "yellow");
  assert.equal(statusLightColor("RESULT", 25), "red");
});

test("checking is dim and real activities use the requested colors", () => {
  assert.equal(statusLightColor("EVALUATING"), null);
  assert.equal(statusLightColor("LISTENING"), "yellow");
  assert.equal(statusLightColor("ANSWERING"), "green");
  assert.equal(statusLightColor("ERROR"), "red");
  assert.equal(statusLightColor("IDLE"), null);
});
