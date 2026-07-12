import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("../node_modules/typescript");
const source = readFileSync(new URL("../lib/clozeModel.ts", import.meta.url), "utf8");
const compiled = typescript.transpileModule(source, {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2020 }
}).outputText;
const runtimeModule = { exports: {} };
new Function("module", "exports", compiled)(runtimeModule, runtimeModule.exports);
const {
  availableWordBankTokens,
  blankSentence,
  buildWordBank,
  isCompleteTokenOrder,
  orderedWordBankTokens,
  placeWordBankToken,
  removeWordBankToken,
  reshuffleAvailableTokenOrder,
  shuffledTokenOrder
} = runtimeModule.exports;

function state() {
  return {
    blankAnswers: {},
    tokenOrder: [],
    selectedTokenIds: {},
    attemptId: "attempt-1",
    mistakes: [],
    hintsUsed: 0,
    attemptCount: 0,
    attempts: []
  };
}

const sentences = [
  { id: "s1", text: "The information that they shared that day was useful." },
  { id: "s2", text: "Can I ask you where you heard about World Tours?" },
  { id: "s3", text: "The booking office confirms every reservation promptly." }
];

test("word bank is scoped to the active sentence", () => {
  const sets = sentences.map((sentence, index) => blankSentence(sentence, index, 1));
  const bank = buildWordBank(sets, 1, 1);
  const answers = new Set(sets[1].blanks.map((blank) => blank.answer));
  assert.ok(bank.length > 0);
  assert.ok(bank.every((token) => answers.has(token.text)));
  assert.ok(bank.every((token) => token.id.startsWith("s2-word-")));
});

test("selecting a token consumes it and removing restores it", () => {
  const sets = sentences.map((sentence, index) => blankSentence(sentence, index, 1));
  const bank = buildWordBank(sets, 1, 1);
  const blank = sets[1].blanks[0];
  const token = bank.find((item) => item.sourceWordIndex === blank.tokenIndex);
  assert.ok(token);

  const filled = placeWordBankToken(state(), blank.id, token);
  assert.equal(filled.blankAnswers[blank.id], token.text);
  assert.ok(!availableWordBankTokens(bank, filled).some((item) => item.id === token.id));

  const cleared = removeWordBankToken(filled, blank.id);
  assert.equal(cleared.blankAnswers[blank.id], undefined);
  assert.ok(availableWordBankTokens(bank, cleared).some((item) => item.id === token.id));
});

test("repeated answer words retain unique token IDs", () => {
  const repeated = blankSentence(sentences[0], 0, 3);
  const bank = buildWordBank([repeated], 0, 3);
  const thatTokens = bank.filter((token) => token.text.toLowerCase() === "that");
  assert.equal(thatTokens.length, 2);
  assert.notEqual(thatTokens[0].id, thatTokens[1].id);
});

test("medium and hard banks cap contextual distractors", () => {
  const mediumSets = sentences.map((sentence, index) => blankSentence(sentence, index, 2));
  const hardSets = sentences.map((sentence, index) => blankSentence(sentence, index, 3));
  assert.ok(buildWordBank(mediumSets, 1, 2).filter((token) => token.distractor).length <= 2);
  assert.ok(buildWordBank(hardSets, 1, 3).filter((token) => token.distractor).length <= 5);
});

test("Fisher-Yates order is stable when stored and does not expose answer order", () => {
  const sets = sentences.map((sentence, index) => blankSentence(sentence, index, 3));
  const bank = buildWordBank(sets, 1, 1);
  const order = shuffledTokenOrder(bank, () => 0.21);
  const original = bank.map((token) => token.id);
  assert.equal(order.length, original.length);
  if (order.length >= 3) assert.notDeepEqual(order, original);
  assert.deepEqual(orderedWordBankTokens(bank, order).map((token) => token.id), order);
});

test("returned token keeps its stored shuffled position", () => {
  const sets = sentences.map((sentence, index) => blankSentence(sentence, index, 3));
  const bank = buildWordBank(sets, 1, 1);
  const tokenOrder = shuffledTokenOrder(bank, () => 0.37);
  const initial = { ...state(), tokenOrder };
  const blank = sets[1].blanks[0];
  const token = bank.find((item) => item.sourceWordIndex === blank.tokenIndex);
  assert.ok(token);
  const filled = placeWordBankToken(initial, blank.id, token);
  const cleared = removeWordBankToken(filled, blank.id);
  assert.deepEqual(availableWordBankTokens(bank, cleared).map((item) => item.id), tokenOrder);
  const reshuffled = reshuffleAvailableTokenOrder(bank, filled, () => 0.14);
  assert.equal(reshuffled.indexOf(token.id), tokenOrder.indexOf(token.id));
});

test("a changed token collection invalidates the stored order", () => {
  const sets = sentences.map((sentence, index) => blankSentence(sentence, index, 3));
  const easyBank = buildWordBank(sets, 1, 1);
  const mediumBank = buildWordBank(sets, 1, 2);
  const easyOrder = shuffledTokenOrder(easyBank, () => 0.31);
  assert.equal(isCompleteTokenOrder(easyBank, easyOrder), true);
  assert.equal(isCompleteTokenOrder(mediumBank, easyOrder), false);
});
