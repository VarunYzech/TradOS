import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FC_CONFIG } from '../setup.js';
import { extractClosingPrices } from '../../js/api.js';

const posFloat = fc.integer({ min: 1, max: 10000000 }).map(n => n / 100);

// Property 18: extractClosingPrices produces correct values
describe('Property 18: extractClosingPrices produces correct values', () => {
  it('should reverse the values array and parse close prices as floats', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 1, maxLength: 100 }),
        (closePrices) => {
          const responseData = {
            values: closePrices.map(p => ({ close: p.toString() }))
          };
          const result = extractClosingPrices(responseData);
          expect(result.length).toBe(closePrices.length);
          for (let i = 0; i < result.length; i++) {
            expect(result[i]).toBeCloseTo(closePrices[closePrices.length - 1 - i], 5);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('should return empty array for null/undefined/missing values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, {}, { values: [] }, { values: null }),
        (responseData) => {
          const result = extractClosingPrices(responseData);
          expect(result).toEqual([]);
        }
      ),
      FC_CONFIG
    );
  });

  it('should produce an array of numbers (not strings)', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 1, maxLength: 50 }),
        (closePrices) => {
          const responseData = {
            values: closePrices.map(p => ({ close: p.toString() }))
          };
          const result = extractClosingPrices(responseData);
          result.forEach(val => {
            expect(typeof val).toBe('number');
            expect(Number.isNaN(val)).toBe(false);
          });
        }
      ),
      FC_CONFIG
    );
  });
});

// Property 19: API error preserves cached data
describe('Property 19: API error preserves cached data', () => {
  it('extractClosingPrices should not mutate the input response data', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 1, maxLength: 50 }),
        (closePrices) => {
          const values = closePrices.map(p => ({ close: p.toString() }));
          const responseData = { values: [...values] };
          const originalLength = responseData.values.length;

          extractClosingPrices(responseData);

          expect(responseData.values.length).toBe(originalLength);
          responseData.values.forEach((v, i) => {
            expect(v.close).toBe(values[i].close);
          });
        }
      ),
      FC_CONFIG
    );
  });

  it('should produce the same result when called twice with the same input', () => {
    fc.assert(
      fc.property(
        fc.array(posFloat, { minLength: 1, maxLength: 50 }),
        (closePrices) => {
          const responseData = {
            values: closePrices.map(p => ({ close: p.toString() }))
          };
          const result1 = extractClosingPrices(responseData);
          const result2 = extractClosingPrices(responseData);
          expect(result1).toEqual(result2);
        }
      ),
      FC_CONFIG
    );
  });
});
