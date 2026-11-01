import type {
  OcrParticipantCandidate,
  OcrRawExtraction,
  OcrTextLine,
} from './ocr.types.js';

export function normalizedConfidence(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleUpperCase()
    .replace(/[^\p{L}\p{M}\p{N}]/gu, '');
}

function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + Number(left[i - 1] !== right[j - 1]),
      );
    }
    previous = current;
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

export function matchParticipant(
  lines: OcrTextLine[],
  candidates: OcrParticipantCandidate[],
  ocrConfidence: number,
) {
  const matches = candidates
    .map((candidate) => {
      let best = {
        userId: candidate.userId as string | null,
        detectedText: null as string | null,
        confidence: 0,
        lineIndex: -1,
        offset: -1,
        x: null as number | null,
      };
      for (const alias of [candidate.inGameName, candidate.fullName]) {
        if (!alias) continue;
        const target = normalizeName(alias);
        if (!target) continue;
        lines.forEach((line, lineIndex) => {
          const tokens = [...line.text.matchAll(/[\p{L}\p{M}\p{N}_]+/gu)];
          const tokenCount = Math.max(1, alias.split(/\s+/).length);
          for (let start = 0; start < tokens.length; start++) {
            for (
              let count = 1;
              count <= tokenCount + 1 && start + count <= tokens.length;
              count++
            ) {
              const offset = tokens[start].index;
              const last = tokens[start + count - 1];
              const detectedText = line.text.slice(
                offset,
                last.index + last[0].length,
              );
              const normalized = normalizeName(detectedText);
              // Short names require an exact token, never a substring in another name.
              const score =
                target.length < 4
                  ? Number(target === normalized)
                  : similarity(target, normalized);
              if (score < 0.75) continue;
              const confidence =
                score * normalizedConfidence(line.confidence ?? ocrConfidence);
              if (confidence > best.confidence) {
                best = {
                  userId: candidate.userId,
                  detectedText,
                  confidence,
                  lineIndex,
                  offset,
                  x: line.bbox
                    ? line.bbox.x0 +
                      (offset / Math.max(1, line.text.length)) *
                        (line.bbox.x1 - line.bbox.x0)
                    : null,
                };
              }
            }
          }
        });
      }
      return best;
    })
    .sort((a, b) => b.confidence - a.confidence);
  const best = matches[0] ?? {
    userId: null,
    detectedText: null,
    confidence: 0,
    lineIndex: -1,
    offset: -1,
    x: null,
  };
  if (
    best.confidence < 0.5 ||
    (matches[1] && best.confidence - matches[1].confidence < 0.1)
  ) {
    return { ...best, userId: null };
  }
  return best;
}

const statisticLabel =
  /\b(shots?|possession|passes|passing|tackles?|saves?|fouls?|corners?|offsides?|accuracy|expected|xg|penalt(?:y|ies)|aggregate)\b/i;
const scoreLabel = /\b(final(?:\s+score)?|full[ -]?time|result|score|ft)\b/i;

export function detectScore(lines: OcrTextLine[], ocrConfidence: number) {
  const candidates: Array<{
    homeScore: number;
    awayScore: number;
    confidence: number;
    rank: number;
    lineIndex: number;
  }> = [];
  lines.forEach((line, lineIndex) => {
    const text = line.text
      .normalize('NFKC')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .trim();
    if (
      statisticLabel.test(text) ||
      /\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/.test(text)
    )
      return;
    const labelled = scoreLabel.test(text);
    const pattern =
      /(?<![\p{L}\p{N}:.-])(\d{1,2})\s*([-:])\s*(\d{1,2})(?![\p{L}\p{N}:.-])/gu;
    const separated = [...text.matchAll(pattern)];
    const spaced = [
      ...text.matchAll(
        /(?<![\p{L}\p{N}:.-])(\d{1,2})\s+(\d{1,2})(?![\p{L}\p{N}:.-])/gu,
      ),
    ];
    const matches = separated.map((match) => ({
      left: match[1],
      right: match[3],
      separator: match[2],
      text: match[0],
    }));
    for (const match of spaced)
      matches.push({
        left: match[1],
        right: match[2],
        separator: ' ',
        text: match[0],
      });
    for (const match of matches) {
      const homeScore = Number(match.left),
        awayScore = Number(match.right);
      if (homeScore > 30 || awayScore > 30) continue;
      // Clock readings and dates must never win over a scoreboard.
      if (
        match.separator === ':' &&
        !labelled &&
        (match.right.length === 2 ||
          /\b(time|kick[ -]?off|am|pm)\b/i.test(text))
      )
        continue;
      const standalone = text === match.text.trim();
      const rank =
        (labelled ? 3 : standalone ? 2 : 1) +
        (match.separator === ' ' ? -0.5 : 0);
      candidates.push({
        homeScore,
        awayScore,
        lineIndex,
        rank,
        confidence:
          normalizedConfidence(line.confidence ?? ocrConfidence) *
          (match.separator === ' ' ? 0.8 : 1),
      });
    }
  });
  candidates.sort((a, b) => b.rank - a.rank || b.confidence - a.confidence);
  const best = candidates[0];
  if (!best)
    return { homeScore: null, awayScore: null, confidence: 0, lineIndex: -1 };
  const conflicting = candidates.some(
    (candidate) =>
      candidate.rank >= best.rank - 0.5 &&
      (candidate.homeScore !== best.homeScore ||
        candidate.awayScore !== best.awayScore),
  );
  return {
    ...best,
    confidence: conflicting ? Math.min(0.49, best.confidence) : best.confidence,
  };
}

export function parseOcrResult(
  raw: OcrRawExtraction,
  homeCandidates: OcrParticipantCandidate[],
  awayCandidates: OcrParticipantCandidate[],
) {
  const results = [raw, ...(raw.alternatives ?? [])].map((variant) => {
    const lines = variant.lines?.length
      ? variant.lines
      : variant.text
          .split(/\r?\n/)
          .map((text) => ({ text: text.trim() }))
          .filter((line) => line.text);
    const home = matchParticipant(lines, homeCandidates, variant.confidence);
    const away = matchParticipant(lines, awayCandidates, variant.confidence);
    const score = { ...detectScore(lines, variant.confidence) };
    const bothMatched =
      home.userId &&
      away.userId &&
      home.userId !== away.userId &&
      (home.lineIndex !== away.lineIndex || home.offset !== away.offset);
    let orientationKnown = false;
    if (bothMatched) {
      const sameLine = home.lineIndex === away.lineIndex;
      const nearScore =
        Math.abs(home.lineIndex - score.lineIndex) <= 3 &&
        Math.abs(away.lineIndex - score.lineIndex) <= 3;
      const useCoordinates =
        home.x !== null && away.x !== null && Math.abs(home.x - away.x) > 20;
      orientationKnown = nearScore && (sameLine || useCoordinates);
      if (
        orientationKnown &&
        (sameLine ? home.offset > away.offset : home.x! > away.x!)
      ) {
        [score.homeScore, score.awayScore] = [score.awayScore, score.homeScore];
      }
    }
    if (!orientationKnown) score.confidence = Math.min(0.49, score.confidence);
    return { raw: variant, home, away, score };
  });
  results.sort(
    (a, b) =>
      Number(b.score.homeScore !== null) - Number(a.score.homeScore !== null) ||
      b.score.confidence - a.score.confidence ||
      b.home.confidence +
        b.away.confidence -
        (a.home.confidence + a.away.confidence),
  );
  const best = results[0];
  if (
    results.some(
      (result) =>
        result !== best &&
        result.score.confidence >= 0.5 &&
        (result.score.homeScore !== best.score.homeScore ||
          result.score.awayScore !== best.score.awayScore),
    )
  ) {
    best.score.confidence = Math.min(0.49, best.score.confidence);
  }
  return best;
}
