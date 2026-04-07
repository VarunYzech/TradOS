import { describe, it, expect } from 'vitest';
import { computeMovingAverage, computeMomentum, computeVolatility, computeSignalScore, computeAll, getRecommendation, predictDirection } from '../../js/analysis.js';

describe('computeMovingAverage', () => {
  it('returns the arithmetic mean of the last N prices', () => {
    const prices = [10, 20, 30, 40, 50];
    // Last 3: [30, 40, 50] → mean = 40
    expect(computeMovingAverage(prices, 3)).toBe(40);
  });

  it('returns the mean of all prices when window equals array length', () => {
    const prices = [10, 20, 30];
    // Mean = 20
    expect(computeMovingAverage(prices, 3)).toBe(20);
  });

  it('returns null when prices.length < window', () => {
    expect(computeMovingAverage([10, 20], 5)).toBeNull();
  });

  it('returns null for an empty prices array', () => {
    expect(computeMovingAverage([], 3)).toBeNull();
  });

  it('returns the single price when window is 1', () => {
    expect(computeMovingAverage([10, 20, 30], 1)).toBe(30);
  });

  it('handles decimal prices correctly', () => {
    const prices = [1.5, 2.5, 3.5];
    // Last 2: [2.5, 3.5] → mean = 3.0
    expect(computeMovingAverage(prices, 2)).toBe(3.0);
  });

  it('returns null for window of 0', () => {
    expect(computeMovingAverage([10, 20], 0)).toBeNull();
  });

  it('returns null for negative window', () => {
    expect(computeMovingAverage([10, 20], -1)).toBeNull();
  });
});

describe('computeMomentum', () => {
  it('returns 1.0 for a strictly increasing sequence', () => {
    // [10, 20, 30, 40, 50] with window 5 → 4 upward out of 4 movements
    expect(computeMomentum([10, 20, 30, 40, 50], 5)).toBe(1.0);
  });

  it('returns 0.0 for a strictly decreasing sequence', () => {
    // [50, 40, 30, 20, 10] with window 5 → 0 upward out of 4 movements
    expect(computeMomentum([50, 40, 30, 20, 10], 5)).toBe(0.0);
  });

  it('returns correct ratio for mixed movements', () => {
    // [10, 20, 15, 25] with window 4 → up, down, up → 2/3
    expect(computeMomentum([10, 20, 15, 25], 4)).toBeCloseTo(2 / 3);
  });

  it('uses only the last N prices when array is longer', () => {
    // prices = [100, 200, 10, 20, 15], window = 3 → last 3: [10, 20, 15] → 1 up, 1 down → 0.5
    expect(computeMomentum([100, 200, 10, 20, 15], 3)).toBe(0.5);
  });

  it('returns null when prices.length < window', () => {
    expect(computeMomentum([10, 20], 5)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(computeMomentum([], 3)).toBeNull();
  });

  it('returns null when window < 2', () => {
    expect(computeMomentum([10, 20, 30], 1)).toBeNull();
    expect(computeMomentum([10, 20, 30], 0)).toBeNull();
    expect(computeMomentum([10, 20, 30], -1)).toBeNull();
  });

  it('returns 0.0 for flat prices (no upward movements)', () => {
    // [5, 5, 5] with window 3 → 0 upward out of 2 movements
    expect(computeMomentum([5, 5, 5], 3)).toBe(0.0);
  });

  it('returns correct ratio with window of 2', () => {
    // [10, 20] → 1 upward out of 1 movement → 1.0
    expect(computeMomentum([10, 20], 2)).toBe(1.0);
    // [20, 10] → 0 upward out of 1 movement → 0.0
    expect(computeMomentum([20, 10], 2)).toBe(0.0);
  });
});

describe('computeVolatility', () => {
  it('computes volatility as ((max - min) / min) * 100', () => {
    // prices [10, 20, 15], window 3 → max=20, min=10 → (20-10)/10*100 = 100
    const result = computeVolatility([10, 20, 15], 3, 50);
    expect(result.value).toBe(100);
    expect(result.classification).toBe('High');
  });

  it('classifies as "Low" when value is below threshold', () => {
    // prices [100, 101], window 2 → max=101, min=100 → (1/100)*100 = 1.0
    const result = computeVolatility([100, 101], 2, 2.0);
    expect(result.value).toBe(1.0);
    expect(result.classification).toBe('Low');
  });

  it('classifies as "High" when value equals threshold', () => {
    // prices [100, 102], window 2 → max=102, min=100 → (2/100)*100 = 2.0
    const result = computeVolatility([100, 102], 2, 2.0);
    expect(result.value).toBe(2.0);
    expect(result.classification).toBe('High');
  });

  it('uses only the last N prices when array is longer', () => {
    // prices [1, 2, 100, 101], window 2 → last 2: [100, 101] → (1/100)*100 = 1.0
    const result = computeVolatility([1, 2, 100, 101], 2, 5);
    expect(result.value).toBe(1.0);
    expect(result.classification).toBe('Low');
  });

  it('returns null when prices.length < window', () => {
    expect(computeVolatility([10, 20], 5, 2.0)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(computeVolatility([], 3, 2.0)).toBeNull();
  });

  it('returns null when window < 1', () => {
    expect(computeVolatility([10, 20], 0, 2.0)).toBeNull();
    expect(computeVolatility([10, 20], -1, 2.0)).toBeNull();
  });

  it('returns 0 volatility for flat prices', () => {
    // All same price → max=min → (0/min)*100 = 0
    const result = computeVolatility([50, 50, 50], 3, 2.0);
    expect(result.value).toBe(0);
    expect(result.classification).toBe('Low');
  });

  it('handles window of 1 (single price, zero volatility)', () => {
    const result = computeVolatility([42], 1, 2.0);
    expect(result.value).toBe(0);
    expect(result.classification).toBe('Low');
  });
});

describe('computeSignalScore', () => {
  const config = { maWindow: 3, volThreshold: 5.0 };

  it('returns max score 6 when all components are true', () => {
    // Strictly rising, price above MA, high momentum, low volatility
    // prices: [100, 101, 102] window=3 → MA=101, currentPrice=102 > 101 → +2
    // momentum: 2 up / 2 total = 1.0 > 0.5 → +2
    // last3 rising: 100 < 101 < 102 → +1
    // volatility: (102-100)/100*100 = 2.0 < 5.0 → Low → +1
    const prices = [100, 101, 102];
    const result = computeSignalScore(prices, config);
    expect(result.score).toBe(6);
    expect(result.components.priceAboveMA).toBe(true);
    expect(result.components.priceAboveMAScore).toBe(2);
    expect(result.components.momentumUp).toBe(true);
    expect(result.components.momentumScore).toBe(2);
    expect(result.components.last3Rising).toBe(true);
    expect(result.components.last3RisingScore).toBe(1);
    expect(result.components.lowVolatility).toBe(true);
    expect(result.components.lowVolatilityScore).toBe(1);
  });

  it('returns score 0 when no components are true', () => {
    // Strictly decreasing: [102, 101, 100] window=3
    // MA = 101, currentPrice = 100 <= 101 → no +2
    // momentum: 0 up / 2 total = 0.0 <= 0.5 → no +2
    // last3 rising: 102 > 101 → false → no +1
    // volatility: (102-100)/100*100 = 2.0 < 5.0 → Low → +1
    // Actually volatility is Low here, so score = 1. Let's use high volatility threshold.
    const prices = [102, 101, 100];
    const highVolConfig = { maWindow: 3, volThreshold: 0.5 };
    const result = computeSignalScore(prices, highVolConfig);
    expect(result.score).toBe(0);
    expect(result.components.priceAboveMA).toBe(false);
    expect(result.components.momentumUp).toBe(false);
    expect(result.components.last3Rising).toBe(false);
    expect(result.components.lowVolatility).toBe(false);
  });

  it('score equals sum of component scores', () => {
    const prices = [100, 101, 102];
    const result = computeSignalScore(prices, config);
    const sum = result.components.priceAboveMAScore
      + result.components.momentumScore
      + result.components.last3RisingScore
      + result.components.lowVolatilityScore;
    expect(result.score).toBe(sum);
  });

  it('score is in range [0, 6]', () => {
    const prices = [50, 55, 48, 60, 62];
    const result = computeSignalScore(prices, config);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(6);
  });

  it('handles prices with fewer than 3 elements (no last3Rising)', () => {
    const prices = [10, 20];
    const smallConfig = { maWindow: 2, volThreshold: 50 };
    const result = computeSignalScore(prices, smallConfig);
    expect(result.components.last3Rising).toBe(false);
    expect(result.components.last3RisingScore).toBe(0);
  });

  it('component scores are correct values (0|2 for price/momentum, 0|1 for rising/volatility)', () => {
    const prices = [100, 101, 102];
    const result = computeSignalScore(prices, config);
    expect([0, 2]).toContain(result.components.priceAboveMAScore);
    expect([0, 2]).toContain(result.components.momentumScore);
    expect([0, 1]).toContain(result.components.last3RisingScore);
    expect([0, 1]).toContain(result.components.lowVolatilityScore);
  });
});

describe('computeAll', () => {
  const config = { maWindow: 3, volThreshold: 5.0 };

  it('returns an AnalysisResult with all four fields', () => {
    const prices = [100, 101, 102];
    const result = computeAll(prices, config);
    expect(result).toHaveProperty('movingAverage');
    expect(result).toHaveProperty('momentum');
    expect(result).toHaveProperty('volatility');
    expect(result).toHaveProperty('signalScore');
  });

  it('movingAverage matches computeMovingAverage output', () => {
    const prices = [10, 20, 30, 40, 50];
    const result = computeAll(prices, config);
    expect(result.movingAverage).toBe(computeMovingAverage(prices, config.maWindow));
  });

  it('momentum matches computeMomentum output', () => {
    const prices = [10, 20, 30, 40, 50];
    const result = computeAll(prices, config);
    expect(result.momentum).toBe(computeMomentum(prices, config.maWindow));
  });

  it('volatility matches computeVolatility output', () => {
    const prices = [10, 20, 30, 40, 50];
    const result = computeAll(prices, config);
    expect(result.volatility).toEqual(computeVolatility(prices, config.maWindow, config.volThreshold));
  });

  it('signalScore matches computeSignalScore output', () => {
    const prices = [100, 101, 102];
    const result = computeAll(prices, config);
    expect(result.signalScore).toEqual(computeSignalScore(prices, config));
  });

  it('returns null for MA and momentum when insufficient data', () => {
    const prices = [10];
    const result = computeAll(prices, config);
    expect(result.movingAverage).toBeNull();
    expect(result.momentum).toBeNull();
  });

  it('works with a full bullish dataset (all components active)', () => {
    const prices = [100, 101, 102];
    const result = computeAll(prices, config);
    expect(result.movingAverage).toBe(101);
    expect(result.momentum).toBe(1.0);
    expect(result.volatility.classification).toBe('Low');
    expect(result.signalScore.score).toBe(6);
  });
});

describe('getRecommendation', () => {
  it('returns STRONG BUY with 🟢 for score 5', () => {
    const result = getRecommendation(5);
    expect(result.action).toBe('STRONG BUY');
    expect(result.emoji).toBe('🟢');
    expect(result.confidence).toBeCloseTo((5 / 6) * 100);
    expect(result.reason).toBeTruthy();
  });

  it('returns STRONG BUY with 🟢 for score 6', () => {
    const result = getRecommendation(6);
    expect(result.action).toBe('STRONG BUY');
    expect(result.emoji).toBe('🟢');
    expect(result.confidence).toBeCloseTo(100);
  });

  it('returns BUY with 🟡 for score 3', () => {
    const result = getRecommendation(3);
    expect(result.action).toBe('BUY');
    expect(result.emoji).toBe('🟡');
    expect(result.confidence).toBeCloseTo((3 / 6) * 100);
    expect(result.reason).toBeTruthy();
  });

  it('returns BUY with 🟡 for score 4', () => {
    const result = getRecommendation(4);
    expect(result.action).toBe('BUY');
    expect(result.emoji).toBe('🟡');
    expect(result.confidence).toBeCloseTo((4 / 6) * 100);
  });

  it('returns WAIT / SELL with 🔴 for score 2', () => {
    const result = getRecommendation(2);
    expect(result.action).toBe('WAIT / SELL');
    expect(result.emoji).toBe('🔴');
    expect(result.confidence).toBeCloseTo((2 / 6) * 100);
    expect(result.reason).toBeTruthy();
  });

  it('returns WAIT / SELL with 🔴 for score 0', () => {
    const result = getRecommendation(0);
    expect(result.action).toBe('WAIT / SELL');
    expect(result.emoji).toBe('🔴');
    expect(result.confidence).toBe(0);
  });

  it('returns WAIT / SELL with 🔴 for score 1', () => {
    const result = getRecommendation(1);
    expect(result.action).toBe('WAIT / SELL');
    expect(result.emoji).toBe('🔴');
    expect(result.confidence).toBeCloseTo((1 / 6) * 100);
  });

  it('confidence equals (score / 6) * 100 for all valid scores', () => {
    for (let score = 0; score <= 6; score++) {
      const result = getRecommendation(score);
      expect(result.confidence).toBeCloseTo((score / 6) * 100);
    }
  });

  it('returns an object with action, confidence, reason, and emoji', () => {
    const result = getRecommendation(3);
    expect(result).toHaveProperty('action');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('emoji');
  });

  it('reason is a non-empty string for all score levels', () => {
    for (let score = 0; score <= 6; score++) {
      const result = getRecommendation(score);
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('predictDirection', () => {
  it('returns UP with ⬆️ when trend is true and momentum > 0.5', () => {
    const result = predictDirection(true, 0.8);
    expect(result.direction).toBe('UP');
    expect(result.emoji).toBe('⬆️');
    expect(result.confidence).toBeCloseTo(80);
  });

  it('returns DOWN with ⬇️ when trend is false', () => {
    const result = predictDirection(false, 0.8);
    expect(result.direction).toBe('DOWN');
    expect(result.emoji).toBe('⬇️');
    expect(result.confidence).toBeCloseTo(20);
  });

  it('returns DOWN with ⬇️ when momentum is exactly 0.5 (not > 0.5)', () => {
    const result = predictDirection(true, 0.5);
    expect(result.direction).toBe('DOWN');
    expect(result.emoji).toBe('⬇️');
    expect(result.confidence).toBeCloseTo(50);
  });

  it('returns DOWN when trend is false even with high momentum', () => {
    const result = predictDirection(false, 1.0);
    expect(result.direction).toBe('DOWN');
    expect(result.emoji).toBe('⬇️');
    expect(result.confidence).toBeCloseTo(0);
  });

  it('returns UP with 100% confidence when trend is true and momentum is 1.0', () => {
    const result = predictDirection(true, 1.0);
    expect(result.direction).toBe('UP');
    expect(result.confidence).toBeCloseTo(100);
  });

  it('returns DOWN with 100% confidence when trend is false and momentum is 0', () => {
    const result = predictDirection(false, 0);
    expect(result.direction).toBe('DOWN');
    expect(result.confidence).toBeCloseTo(100);
  });

  it('confidence is bounded between 0 and 100', () => {
    const up = predictDirection(true, 0.75);
    expect(up.confidence).toBeGreaterThanOrEqual(0);
    expect(up.confidence).toBeLessThanOrEqual(100);

    const down = predictDirection(false, 0.25);
    expect(down.confidence).toBeGreaterThanOrEqual(0);
    expect(down.confidence).toBeLessThanOrEqual(100);
  });
});
