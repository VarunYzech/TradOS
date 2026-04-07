import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FC_CONFIG } from '../setup.js';
import { getRecommendation } from '../../js/analysis.js';

// Property 5: For any score 0-6, getRecommendation returns correct action/emoji/confidence
describe('Property 5: Decision Engine maps score to correct action/emoji/confidence', () => {
  it('should return STRONG BUY with 🟢 for scores >= 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 6 }),
        (score) => {
          const result = getRecommendation(score);
          expect(result.action).toBe('STRONG BUY');
          expect(result.emoji).toBe('🟢');
          expect(result.confidence).toBeCloseTo((score / 6) * 100, 5);
        }
      ),
      FC_CONFIG
    );
  });

  it('should return BUY with 🟡 for scores 3-4', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 4 }),
        (score) => {
          const result = getRecommendation(score);
          expect(result.action).toBe('BUY');
          expect(result.emoji).toBe('🟡');
          expect(result.confidence).toBeCloseTo((score / 6) * 100, 5);
        }
      ),
      FC_CONFIG
    );
  });

  it('should return WAIT / SELL with 🔴 for scores 0-2', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        (score) => {
          const result = getRecommendation(score);
          expect(result.action).toBe('WAIT / SELL');
          expect(result.emoji).toBe('🔴');
          expect(result.confidence).toBeCloseTo((score / 6) * 100, 5);
        }
      ),
      FC_CONFIG
    );
  });

  it('should always return confidence = score/6 * 100 for any score 0-6', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        (score) => {
          const result = getRecommendation(score);
          expect(result.confidence).toBeCloseTo((score / 6) * 100, 5);
          expect(['STRONG BUY', 'BUY', 'WAIT / SELL']).toContain(result.action);
          expect(['🟢', '🟡', '🔴']).toContain(result.emoji);
        }
      ),
      FC_CONFIG
    );
  });
});
