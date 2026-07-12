import type { ClozeDifficulty, ClozeSentenceState, Sentence } from "./sessionStore";

export type Blank = {
  id: string;
  sentenceId: string;
  tokenIndex: number;
  answer: string;
  label: string;
};

export type ClozeSet = {
  sentence: Sentence;
  tokens: string[];
  blanks: Blank[];
};

export type WordBankToken = {
  id: string;
  text: string;
  sourceWordIndex: number;
  distractor: boolean;
};

export function tokenize(text: string) {
  return text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*|\s+|[^A-Za-z0-9\s]+/g) ?? [];
}

export function isWord(token: string) {
  return /^[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*$/.test(token);
}

export function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

function hashValue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function shouldBlank(token: string, tokenIndex: number, sentenceId: string, difficulty: ClozeDifficulty) {
  if (!isWord(token)) return false;
  if (/^\d/.test(token)) return true;
  const sample = hashValue(`${sentenceId}:${tokenIndex}:${token.toLowerCase()}`) % 100;
  if (difficulty === 1) return token.length >= 5 && sample < 30;
  if (difficulty === 2) return token.length >= 3 && sample < 52;
  return true;
}

export function blankSentence(sentence: Sentence, sentenceIndex: number, difficulty: ClozeDifficulty): ClozeSet {
  const tokens = tokenize(sentence.text);
  let wordIndexes = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token, index }) => shouldBlank(token, index, sentence.id, difficulty));

  if (!wordIndexes.length) {
    const fallback = tokens
      .map((token, index) => ({ token, index }))
      .filter(({ token }) => isWord(token))
      .sort((left, right) => right.token.length - left.token.length)[0];
    if (fallback) wordIndexes = [fallback];
  }

  return {
    sentence,
    tokens,
    blanks: wordIndexes.map((item, blankIndex) => ({
      id: `${sentence.id}-blank-${item.index}`,
      sentenceId: sentence.id,
      tokenIndex: item.index,
      answer: item.token,
      label: `${sentenceIndex + 1}.${blankIndex + 1}`
    }))
  };
}

export function activeWordIndex(sentence: Sentence, currentTime: number) {
  if (sentence.words?.length) return sentence.words.findIndex((word) => currentTime >= word.start && currentTime <= word.end);
  return -1;
}

export function buildWordBank(clozeSet: ClozeSet[], activeIndex: number, difficulty: ClozeDifficulty): WordBankToken[] {
  const item = clozeSet[activeIndex];
  if (!item) return [];

  const answerTokens: WordBankToken[] = item.blanks.map((blank) => ({
    id: `${blank.sentenceId}-word-${blank.tokenIndex}`,
    text: blank.answer,
    sourceWordIndex: blank.tokenIndex,
    distractor: false
  }));
  const answerText = new Set(answerTokens.map((token) => normalized(token.text)));
  const distractorLimit = difficulty === 1 ? 0 : difficulty === 2 ? 2 : 5;
  const candidates: WordBankToken[] = [];
  const seen = new Set<string>();
  const averageLength = answerTokens.length
    ? answerTokens.reduce((sum, token) => sum + token.text.length, 0) / answerTokens.length
    : 5;

  for (let sentenceIndex = Math.max(0, activeIndex - 2); sentenceIndex <= Math.min(clozeSet.length - 1, activeIndex + 2); sentenceIndex += 1) {
    if (sentenceIndex === activeIndex) continue;
    const context = clozeSet[sentenceIndex];
    context.tokens.forEach((token, tokenIndex) => {
      const key = normalized(token);
      if (!isWord(token) || token.length < 3 || answerText.has(key) || seen.has(key)) return;
      seen.add(key);
      candidates.push({
        id: `${context.sentence.id}-distractor-${tokenIndex}`,
        text: token,
        sourceWordIndex: tokenIndex,
        distractor: true
      });
    });
  }

  const distractors = candidates
    .sort((left, right) => {
      const lengthDifference = Math.abs(left.text.length - averageLength) - Math.abs(right.text.length - averageLength);
      return lengthDifference || hashValue(left.id) - hashValue(right.id);
    })
    .slice(0, distractorLimit);

  return [...answerTokens, ...distractors];
}

export function shuffleTokens<T>(tokens: T[], random: () => number = Math.random): T[] {
  const result = [...tokens];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function shuffledTokenOrder(tokens: WordBankToken[], random: () => number = Math.random) {
  const original = tokens.map((token) => token.id);
  let shuffled = shuffleTokens(original, random);
  for (let retry = 0; retry < 4 && original.length >= 3 && shuffled.every((id, index) => id === original[index]); retry += 1) {
    shuffled = shuffleTokens(original, random);
  }
  return shuffled;
}

export function orderedWordBankTokens(tokens: WordBankToken[], tokenOrder: string[]) {
  if (!tokenOrder.length) return tokens;
  const byId = new Map(tokens.map((token) => [token.id, token]));
  const ordered = tokenOrder.map((id) => byId.get(id)).filter((token): token is WordBankToken => Boolean(token));
  const known = new Set(ordered.map((token) => token.id));
  return [...ordered, ...tokens.filter((token) => !known.has(token.id))];
}

export function isCompleteTokenOrder(tokens: WordBankToken[], tokenOrder: string[]) {
  if (tokens.length !== tokenOrder.length) return false;
  const tokenIds = new Set(tokens.map((token) => token.id));
  return tokenOrder.every((tokenId) => tokenIds.has(tokenId));
}

export function reshuffleAvailableTokenOrder(tokens: WordBankToken[], state: ClozeSentenceState, random: () => number = Math.random) {
  const currentOrder = orderedWordBankTokens(tokens, state.tokenOrder).map((token) => token.id);
  const used = new Set(Object.values(state.selectedTokenIds));
  const available = shuffleTokens(currentOrder.filter((id) => !used.has(id)), random);
  let cursor = 0;
  return currentOrder.map((id) => used.has(id) ? id : available[cursor++]);
}

export function placeWordBankToken(state: ClozeSentenceState, blankId: string, token: WordBankToken) {
  const occupiedBy = Object.entries(state.selectedTokenIds).find(([, tokenId]) => tokenId === token.id)?.[0];
  if (occupiedBy && occupiedBy !== blankId) return state;
  return {
    ...state,
    blankAnswers: { ...state.blankAnswers, [blankId]: token.text },
    selectedTokenIds: { ...state.selectedTokenIds, [blankId]: token.id }
  };
}

export function removeWordBankToken(state: ClozeSentenceState, blankId: string) {
  const blankAnswers = { ...state.blankAnswers };
  const selectedTokenIds = { ...state.selectedTokenIds };
  delete blankAnswers[blankId];
  delete selectedTokenIds[blankId];
  return { ...state, blankAnswers, selectedTokenIds };
}

export function availableWordBankTokens(tokens: WordBankToken[], state: ClozeSentenceState) {
  const used = new Set(Object.values(state.selectedTokenIds));
  return orderedWordBankTokens(tokens, state.tokenOrder).filter((token) => !used.has(token.id));
}
