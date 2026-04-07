import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FC_CONFIG } from '../setup.js';
import { assessRisk } from '../../js/calculator.js';

// Property 10: assessRisk classification matches thresholds
describe('Property 10: Risk classification matches thresholds', () => {
  it('should classify as Low (green) when riskRewardRatio <= 0.5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }).map(n => n / 100),
        fc.integer({ min: 0, max: 10000000 }).map(n => n / 100),
        fc.integer({ min: 100, max: 100000000 }).map(n => n / 100),
        (ratio, loss, capital) => {
          const result = assessRisk(ratio, loss, capital);
          expect(result.riskLevel).toBe('Low');
          expect(result.color).toBe('green');
          expect(result.maxLoss).toBe(loss);
          expect(result.safeCapital).toBeCloseTo(capital * (1 - ratio * 0.1), 5);
        }
      ),
      FC_CONFIG
    );
  });

  it('should classify as Medium (yellow) when 0.5 < riskRewardRatio <= 1.0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 100 }).map(n => n / 100),
        fc.integer({ min: 0, max: 10000000 }).map(n => n / 100),
        fc.integer({ min: 100, max: 100000000 }).map(n => n / 100),
        (ratio, loss, capital) => {
          const result = assessRisk(ratio, loss, capital);
          expect(result.riskLevel).toBe('Medium');
          expect(result.color).toBe('yellow');
          expect(result.maxLoss).toBe(loss);
          expect(result.safeCapital).toBeCloseTo(capital * (1 - ratio * 0.1), 5);
        }
      ),
      FC_CONFIG
    );
  });

  it('should classify as High (red) when riskRewardRatio > 1.0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 101, max: 10000 }).map(n => n / 100),
        fc.integer({ min: 0, max: 10000000 }).map(n => n / 100),
        fc.integer({ min: 100, max: 100000000 }).map(n => n / 100),
        (ratio, loss, capital) => {
          const result = assessRisk(ratio, loss, capital);
          expect(result.riskLevel).toBe('High');
          expect(result.color).toBe('red');
          expect(result.maxLoss).toBe(loss);
          expect(result.safeCapital).toBeCloseTo(capital * (1 - ratio * 0.1), 5);
        }
      ),
      FC_CONFIG
    );
  });

  it('should always return one of Low/Medium/High for any non-negative ratio', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }).map(n => n / 100),
        fc.integer({ min: 0, max: 10000000 }).map(n => n / 100),
        fc.integer({ min: 100, max: 100000000 }).map(n => n / 100),
        (ratio, loss, capital) => {
          const result = assessRisk(ratio, loss, capital);
          expect(['Low', 'Medium', 'High']).toContain(result.riskLevel);
          expect(['green', 'yellow', 'red']).toContain(result.color);
        }
      ),
      FC_CONFIG
    );
  });
});
