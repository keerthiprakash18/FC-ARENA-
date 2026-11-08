import { describe, expect, it } from 'vitest';
import {
  detectScore,
  matchParticipant,
  normalizedConfidence,
  parseOcrResult,
} from './ocr-parser.js';
import type { OcrParticipantCandidate } from './ocr.types.js';

const alpha: OcrParticipantCandidate = {
  userId: 'alpha',
  fullName: 'Alpha Player',
  inGameName: 'Alpha',
};
const beta: OcrParticipantCandidate = {
  userId: 'beta',
  fullName: 'Beta Player',
  inGameName: 'Beta',
};
const lines = (...text: string[]) => text.map((text) => ({ text }));

describe('scoreboard extraction', () => {
  it.each([
    '2-1',
    '2 – 1',
    '2 — 1',
    '2:1',
    '2 1',
    'Alpha 2 - 1 Beta',
    'Alpha 2 1 Beta',
    'Final score 2:01',
  ])('recognizes %s', (text) => {
    expect(detectScore(lines(text), 0.95)).toMatchObject({
      homeScore: 2,
      awayScore: 1,
    });
  });

  it('ignores clocks, dates, statistics and penalty shootouts before the final score', () => {
    expect(
      detectScore(
        lines(
          '12:10',
          'Kick off 2:5 PM',
          '20-10-2026',
          'Shots 12-10',
          'Penalties 5-4',
          'Aggregate 6-4',
          'Final score 2-1',
        ),
        0.9,
      ),
    ).toMatchObject({ homeScore: 2, awayScore: 1, confidence: 0.9 });
  });

  it.each([
    '09:25',
    '2:01',
    '2026-10-31',
    '12.10.2026',
    'Shots 4-3',
    '31-2',
    '92-15',
    'Nothing readable',
  ])('does not invent a score from %s', (text) => {
    expect(detectScore(lines(text), 0.99)).toMatchObject({
      homeScore: null,
      awayScore: null,
      confidence: 0,
    });
  });

  it('requires review when two plausible scoreboards disagree', () => {
    expect(detectScore(lines('2-1', '3-1'), 0.95).confidence).toBeLessThan(0.5);
  });

  it('uses score-line confidence rather than unrelated text confidence', () => {
    expect(
      detectScore([{ text: '2-1', confidence: 0.25 }], 0.99).confidence,
    ).toBe(0.25);
  });

  it('prefers isolated final-header digits over badge numbers in another pass', () => {
    const parsed = parseOcrResult({
      text: 'Alpha 1-4 Beta', confidence: 0.95,
      alternatives: [{
        text: '', confidence: 0.9,
        lines: [{ text: 'Alpha Beta', confidence: 0.9 },
          { text: '1 - 0', confidence: 0.9, source: 'scoreboard' }],
      }],
    }, [alpha], [beta]);
    expect(parsed.score).toMatchObject({ homeScore: 1, awayScore: 0, confidence: 0.9 });
  });
});

describe('participant matching and fixture orientation', () => {
  it('finds both participants on one line and reverses screenshot sides to match the fixture', () => {
    const parsed = parseOcrResult(
      { text: 'Beta 4-2 Alpha', confidence: 0.95 },
      [alpha],
      [beta],
    );
    expect(parsed.home.userId).toBe('alpha');
    expect(parsed.away.userId).toBe('beta');
    expect(parsed.score).toMatchObject({
      homeScore: 2,
      awayScore: 4,
      confidence: 0.95,
    });
  });

  it('handles widely spaced digits without a separator', () => {
    const parsed = parseOcrResult(
      { text: 'Alpha 2 1 Beta', confidence: 0.95 },
      [alpha],
      [beta],
    );
    expect(parsed.score).toMatchObject({ homeScore: 2, awayScore: 1 });
    expect(parsed.score.confidence).toBeGreaterThan(0.5);
  });

  it('uses positioned names above the scoreboard', () => {
    const parsed = parseOcrResult(
      {
        text: '',
        confidence: 0.95,
        lines: [
          { text: 'Beta', bbox: { x0: 10, x1: 100, y0: 10, y1: 30 } },
          { text: 'Alpha', bbox: { x0: 400, x1: 500, y0: 15, y1: 35 } },
          { text: '4 2', bbox: { x0: 200, x1: 300, y0: 50, y1: 90 } },
        ],
      },
      [alpha],
      [beta],
    );
    expect(parsed.score).toMatchObject({ homeScore: 2, awayScore: 4 });
    expect(parsed.score.confidence).toBeGreaterThan(0.5);
  });

  it('does not infer left/right order from text reading order on separate lines', () => {
    expect(
      parseOcrResult(
        { text: 'Beta\nAlpha\n4-2', confidence: 0.95 },
        [alpha],
        [beta],
      ).score.confidence,
    ).toBeLessThan(0.5);
  });

  it('uses geometry when badge fragments add extra rows between the names and goals', () => {
    const parsed = parseOcrResult({ text: '', confidence: 0.9, lines: [
      { text: 'Beta', bbox: { x0: 100, x1: 200, y0: 40, y1: 70 } },
      { text: 'Alpha', bbox: { x0: 600, x1: 700, y0: 40, y1: 70 } },
      ...lines('badge', 'badge', 'badge', 'badge', 'badge'),
      { text: '2 - 0', confidence: 0.9, source: 'scoreboard', bbox: { x0: 300, x1: 500, y0: 90, y1: 150 } },
    ] }, [alpha], [beta]);
    expect(parsed.score).toMatchObject({ homeScore: 0, awayScore: 2, confidence: 0.9 });
  });

  it('keeps uncertain sides and missing participants below the autofill threshold', () => {
    expect(
      parseOcrResult(
        { text: 'Final score 2-1', confidence: 0.99 },
        [alpha],
        [beta],
      ).score.confidence,
    ).toBeLessThan(0.5);
  });

  it('supports registered full names as well as game handles', () => {
    expect(
      matchParticipant(
        lines('John Smith'),
        [{ ...alpha, fullName: 'John Smith' }],
        0.95,
      ).userId,
    ).toBe('alpha');
  });

  it('uses the matched name confidence and position instead of an unreadable badge on the same row', () => {
    const matched = matchParticipant([{
      text: '??? Alpha Beta', confidence: 0,
      bbox: { x0: 0, y0: 10, x1: 600, y1: 100 },
      words: [
        { text: '???', offset: 0, confidence: 0, bbox: { x0: 0, y0: 10, x1: 80, y1: 100 } },
        { text: 'Alpha', offset: 4, confidence: 0.95, bbox: { x0: 100, y0: 20, x1: 200, y1: 45 } },
        { text: 'Beta', offset: 10, confidence: 0.96, bbox: { x0: 400, y0: 20, x1: 500, y1: 45 } },
      ],
    }], [alpha], 0.1);
    expect(matched).toMatchObject({ userId: 'alpha', confidence: 0.95, x: 150 });
  });

  it('supports Unicode participant names', () => {
    expect(
      matchParticipant(
        lines('தமிழ் வீரன்'),
        [{ ...alpha, inGameName: 'தமிழ் வீரன்' }],
        0.95,
      ).userId,
    ).toBe('alpha');
  });

  it('accepts small OCR spelling errors without matching short substrings', () => {
    expect(matchParticipant(lines('A1pha'), [alpha], 0.95).userId).toBe(
      'alpha',
    );
    expect(
      matchParticipant(
        lines('Arena'),
        [{ ...alpha, fullName: 'ZZZ', inGameName: 'A' }],
        0.95,
      ).userId,
    ).toBeNull();
  });

  it('does not raise low OCR confidence to the matching threshold', () => {
    expect(matchParticipant(lines('Alpha'), [alpha], 0.1).userId).toBeNull();
  });

  it('leaves ambiguous teammates unmatched', () => {
    expect(
      matchParticipant(
        lines('Alpha'),
        [alpha, { ...alpha, userId: 'other' }],
        0.95,
      ).userId,
    ).toBeNull();
  });

  it('chooses the readable pass and abstains when passes disagree', () => {
    const good = { text: 'Alpha 2-1 Beta', confidence: 0.95 };
    expect(
      parseOcrResult(
        { text: 'garbage', confidence: 0.1, alternatives: [good] },
        [alpha],
        [beta],
      ).score,
    ).toMatchObject({ homeScore: 2, awayScore: 1, confidence: 0.95 });
    expect(
      parseOcrResult(
        {
          ...good,
          alternatives: [{ text: 'Alpha 3-1 Beta', confidence: 0.9 }],
        },
        [alpha],
        [beta],
      ).score.confidence,
    ).toBeLessThan(0.5);
  });

  it.each([NaN, Infinity, -1])('bounds invalid confidence %s', (value) => {
    expect(normalizedConfidence(value)).toBe(0);
  });
});
