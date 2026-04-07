import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FC_CONFIG } from '../setup.js';
import { predictDirection } from '../../js/analysis.js';

// Property 6: For any boolean trend and momentum [0,1], predictDirection returns valid direction with matching emoji
describe('Property 6: Prediction Engine returns valid direction with matching emoji', () => {
  it('should return UP with ⬆️ when trend is true and momentum > 0.5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 100 }).map(n => n / 100),
        (momentum) => {
          const result = predictDirection(true, momentum);
          expect(result.direction).toBe('UP');
          expect(result.emoji).toBe('⬆️');
          expect(result.confidence).toBeCloseTo(momentum * 100, 5);
        }
      ),
      FC_CONFIG
    );
  });

  it('should return DOWN with ⬇️ when trend is false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }).map(n => n / 100),
        (momentum) => {
          const result = predictDirection(false, momentum);
          expect(result.direction).toBe('DOWN');
          expect(result.emoji).toBe('⬇️');
          expect(result.confidence).toBeCloseTo((1 - momentum) * 100, 5);
        }
      ),
      FC_CONFIG
    );
  });

  it('should return DOWN with ⬇️ when trend is true but momentum <= 0.5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }).map(n => n / 100),
        (momentum) => {
          const result = predictDirection(true, momentum);
          expect(result.direction).toBe('DOWN');
          expect(result.emoji).toBe('⬇️');
          expect(result.confidence).toBeCloseTo((1 - momentum) * 100, 5);
        }
      ),
      FC_CONFIG
    );
  });

  it('should always return a valid direction and emoji for any boolean/momentum combo', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 0, max: 100 }).map(n => n / 100),
        (trend, momentum) => {
          const result = predictDirection(trend, momentum);
          expect(['UP', 'DOWN']).toContain(result.direction);
          if (result.direction === 'UP') {
            expect(result.emoji).toBe('⬆️');
          } else {
            expect(result.emoji).toBe('⬇️');
          }
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(100);
        }
      ),
      FC_CONFIG
    );
  });
});
