import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FC_CONFIG } from '../setup.js';
import {
  computeMovingAverage,
  computeMomentum,
  computeVolatility,
  computeSignalScore
} from '../../js/analysis.js';

const posFloat = fc.integer({ min: 1, max: 1000000 }).map(n => n / 100); // 0.01 to 10000

// Property 1: computeMovingAverage returns arithmetic mean of last N prices
describe('Property 1: Moving Average is arithmetic mean of last N prices', () => {
  it('should equal the arithmetic mean of the last `window` prices', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 2, maxLength: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (prices, windowRaw) => {
          const window = Math.min(windowRaw, prices.length);
          const result = computeMovingAverage(prices, window);
          const slice = prices.slice(-window);
          const expectedMean = slice.reduce((a, b) => a + b, 0) / window;
          expect(result).not.toBeNull();
          expect(result).toBeCloseTo(expectedMean, 5);
        }
      ),
      FC_CONFIG
    );
  });

  it('should return null when prices.length < window', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 1, maxLength: 10 }),
        (prices) => {
          const window = prices.length + 1;
          expect(computeMovingAverage(prices, window)).toBeNull();
        }
      ),
      FC_CONFIG
    );
  });
});

// Property 2: computeMomentum returns value in [0, 1]
describe('Property 2: Momentum is always in [0, 1]', () => {
  it('should return a value between 0 and 1 inclusive for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 2, maxLength: 100 }),
        (prices) => {
          const window = prices.length;
          const result = computeMomentum(prices, window);
          if (result !== null) {
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThanOrEqual(1);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('should compute upward movements / total movements', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 3, maxLength: 50 }),
        (prices) => {
          const window = prices.length;
          const result = computeMomentum(prices, window);
          let upCount = 0;
          for (let i = 1; i < prices.length; i++) {
            if (prices[i] > prices[i - 1]) upCount++;
          }
          const expected = upCount / (prices.length - 1);
          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      FC_CONFIG
    );
  });
});

// Property 3: computeVolatility classification matches threshold
describe('Property 3: Volatility classification matches threshold', () => {
  it('should classify as Low when value < threshold, High otherwise', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 2, maxLength: 100 }),
        fc.integer({ min: 1, max: 5000 }).map(n => n / 100),
        (prices, threshold) => {
          const window = prices.length;
          const result = computeVolatility(prices, window, threshold);
          if (result !== null) {
            const slice = prices.slice(-window);
            const min = Math.min(...slice);
            const max = Math.max(...slice);
            const expectedValue = ((max - min) / min) * 100;
            expect(result.value).toBeCloseTo(expectedValue, 5);
            if (result.value < threshold) {
              expect(result.classification).toBe('Low');
            } else {
              expect(result.classification).toBe('High');
            }
          }
        }
      ),
      FC_CONFIG
    );
  });
});

// Property 4: computeSignalScore equals sum of components and is in [0, 6]
describe('Property 4: Signal Score is sum of components and in [0, 6]', () => {
  it('should produce a score in [0, 6] that equals the sum of component scores', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 5, maxLength: 100 }),
        fc.integer({ min: 2, max: 20 }),
        fc.integer({ min: 1, max: 5000 }).map(n => n / 100),
        (prices, maWindowRaw, volThreshold) => {
          const maWindow = Math.min(maWindowRaw, prices.length);
          const config = { maWindow, volThreshold };
          const result = computeSignalScore(prices, config);
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(6);
          const componentSum =
            result.components.priceAboveMAScore +
            result.components.momentumScore +
            result.components.last3RisingScore +
            result.components.lowVolatilityScore;
          expect(result.score).toBe(componentSum);
        }
      ),
      FC_CONFIG
    );
  });
});
