export type ScoreResult = {
  score: number;
  mistakes: string[];
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const words = (value: string) => normalize(value).split(" ").filter(Boolean);

export function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[a.length][b.length];
}

export function bandEstimate(score: number) {
  if (score >= 90) return 9;
  if (score >= 82) return 8;
  if (score >= 74) return 7;
  if (score >= 64) return 6;
  if (score >= 52) return 5;
  if (score >= 40) return 4;
  if (score >= 28) return 3;
  if (score >= 16) return 2;
  return 1;
}

export function scoreAnswer(target: string, answer: string): ScoreResult {
  const cleanTarget = normalize(target);
  const cleanAnswer = normalize(answer);
  if (!cleanAnswer) {
    return { score: 0, mistakes: ["vocabulary"] };
  }

  const distance = levenshtein(cleanTarget, cleanAnswer);
  const longest = Math.max(cleanTarget.length, cleanAnswer.length, 1);
  const similarity = Math.max(0, 1 - distance / longest);

  const targetWords = words(target).filter((word) => word.length > 3);
  const answerWords = new Set(words(answer));
  const matched = targetWords.filter((word) => answerWords.has(word)).length;
  const keywordMatch = targetWords.length ? matched / targetWords.length : similarity;
  const score = Math.round(Math.min(100, Math.max(0, similarity * 70 + keywordMatch * 30)));

  const mistakes = new Set<string>();
  if (/\d/.test(target) && !/\d/.test(answer)) mistakes.add("numbers");
  if (score < 84 && similarity > keywordMatch) mistakes.add("vocabulary");
  if (score < 90 && Math.abs(words(target).length - words(answer).length) > 2) mistakes.add("grammar");
  if (score < 92 && distance > 0) mistakes.add("spelling");

  return { score, mistakes: Array.from(mistakes) };
}
