import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FC_CONFIG } from '../setup.js';
import { prepareData, MAX_POINTS, MIN_POINTS } from '../../js/chart.js';

const posFloat = fc.integer({ min: 1, max: 1000000 }).map(n => n / 100);

// Property 20: Chart data point count bounded between MIN_POINTS (2) and MAX_POINTS (50)
describe('Property 20: Chart data point count bounded between 2 and 50', () => {
  it('should produce slicedPrices with length = min(prices.length, MAX_POINTS)', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 1, maxLength: 200 }),
        (prices) => {
          const { slicedPrices, labels } = prepareData(prices, [], '1min');
          const expectedCount = Math.min(prices.length, MAX_POINTS);
          expect(slicedPrices.length).toBe(expectedCount);
          expect(labels.length).toBe(expectedCount);
          expect(slicedPrices.length).toBeLessThanOrEqual(MAX_POINTS);
        }
      ),
      FC_CONFIG
    );
  });

  it('should slice from the end of the prices array (most recent data)', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 2, maxLength: 200 }),
        (prices) => {
          const { slicedPrices } = prepareData(prices, [], '1min');
          const count = Math.min(prices.length, MAX_POINTS);
          const expected = prices.slice(-count);
          expect(slicedPrices).toEqual(expected);
        }
      ),
      FC_CONFIG
    );
  });

  it('should also slice MA values to the same length', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 2, maxLength: 200 }),
        (prices) => {
          const maValues = prices.map((_, i) => i > 0 ? (prices[i] + prices[i - 1]) / 2 : null);
          const { slicedPrices, slicedMA } = prepareData(prices, maValues, '1min');
          expect(slicedMA.length).toBe(slicedPrices.length);
        }
      ),
      FC_CONFIG
    );
  });

  it('should generate correct label format based on interval', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 2, maxLength: 50 }),
        fc.constantFrom('1min', '5min', '15min', '1h', '1day', '1week', '1month'),
        (prices, interval) => {
          const { labels } = prepareData(prices, [], interval);
          expect(labels.length).toBe(Math.min(prices.length, MAX_POINTS));
          labels.forEach(label => {
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
          });
        }
      ),
      FC_CONFIG
    );
  });
});
