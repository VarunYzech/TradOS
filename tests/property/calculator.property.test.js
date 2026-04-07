import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FC_CONFIG } from '../setup.js';
import {
  calculateQuantity,
  calculateProfitLoss,
  validateTradeInput
} from '../../js/calculator.js';

const posFloat = fc.integer({ min: 1, max: 1000000 }).map(n => n / 100);

// Property 7: calculateQuantity is floor division
describe('Property 7: calculateQuantity is floor(capital / buyPrice)', () => {
  it('should return Math.floor(capital / buyPrice) for positive inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 10000000 }).map(n => n / 100),
        fc.integer({ min: 1, max: 1000000 }).map(n => n / 100),
        (capital, buyPrice) => {
          const result = calculateQuantity(capital, buyPrice);
          expect(result).toBe(Math.floor(capital / buyPrice));
        }
      ),
      FC_CONFIG
    );
  });

  it('should always return a non-negative integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000000 }).map(n => n / 100),
        fc.integer({ min: 1, max: 1000000 }).map(n => n / 100),
        (capital, buyPrice) => {
          const result = calculateQuantity(capital, buyPrice);
          expect(Number.isInteger(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(0);
        }
      ),
      FC_CONFIG
    );
  });
});

// Property 8: calculateProfitLoss formulas are correct
describe('Property 8: calculateProfitLoss computes correct profit, loss, and ratio', () => {
  it('should compute profit = (target - buy) * qty, loss = (buy - stopLoss) * qty', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }).map(n => n / 100),
        fc.integer({ min: 1, max: 99 }).map(n => n / 100),
        fc.integer({ min: 1, max: 99 }).map(n => n / 100),
        fc.integer({ min: 1, max: 10000 }),
        (buyPrice, targetFrac, stopFrac, quantity) => {
          const targetPrice = buyPrice + buyPrice * targetFrac;
          const stopLoss = buyPrice - buyPrice * stopFrac;
          const input = { buyPrice, targetPrice, stopLoss, quantity };
          const result = calculateProfitLoss(input);
          expect(result.errors).toBeUndefined();
          const expectedProfit = (targetPrice - buyPrice) * quantity;
          const expectedLoss = (buyPrice - stopLoss) * quantity;
          expect(result.profit).toBeCloseTo(expectedProfit, 2);
          expect(result.loss).toBeCloseTo(expectedLoss, 2);
          expect(result.riskRewardRatio).toBeCloseTo(expectedLoss / expectedProfit, 5);
        }
      ),
      FC_CONFIG
    );
  });

  it('should auto-calculate quantity from capital when quantity is not provided', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }).map(n => n / 100),
        fc.integer({ min: 1, max: 99 }).map(n => n / 100),
        fc.integer({ min: 1, max: 99 }).map(n => n / 100),
        fc.integer({ min: 10000, max: 100000000 }).map(n => n / 100),
        (buyPrice, targetFrac, stopFrac, capital) => {
          const targetPrice = buyPrice + buyPrice * targetFrac;
          const stopLoss = buyPrice - buyPrice * stopFrac;
          const input = { buyPrice, targetPrice, stopLoss, capital };
          const result = calculateProfitLoss(input);
          if (!result.errors) {
            expect(result.quantity).toBe(Math.floor(capital / buyPrice));
          }
        }
      ),
      FC_CONFIG
    );
  });
});

// Property 9: validateTradeInput rejects invalid inputs
describe('Property 9: validateTradeInput rejects invalid inputs', () => {
  it('should reject when target <= buyPrice', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }).map(n => n / 100),
        fc.integer({ min: 0, max: 100 }).map(n => n / 100),
        fc.integer({ min: 1, max: 1000 }),
        (buyPrice, frac, quantity) => {
          const targetPrice = buyPrice * frac; // target <= buyPrice
          const stopLoss = buyPrice * 0.5;
          const errors = validateTradeInput({ buyPrice, targetPrice, stopLoss, quantity });
          expect(errors).toContain('Target price must be greater than buy price');
        }
      ),
      FC_CONFIG
    );
  });

  it('should reject when stopLoss >= buyPrice', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }).map(n => n / 100),
        fc.integer({ min: 100, max: 200 }).map(n => n / 100),
        fc.integer({ min: 1, max: 1000 }),
        (buyPrice, multiplier, quantity) => {
          const targetPrice = buyPrice * 1.5;
          const stopLoss = buyPrice * multiplier; // stopLoss >= buyPrice
          const errors = validateTradeInput({ buyPrice, targetPrice, stopLoss, quantity });
          expect(errors).toContain('Stop-loss must be less than buy price');
        }
      ),
      FC_CONFIG
    );
  });

  it('should reject when neither capital nor quantity is positive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }).map(n => n / 100),
        (buyPrice) => {
          const targetPrice = buyPrice * 1.5;
          const stopLoss = buyPrice * 0.5;
          const errors = validateTradeInput({ buyPrice, targetPrice, stopLoss });
          expect(errors).toContain('Capital or quantity must be positive');
        }
      ),
      FC_CONFIG
    );
  });

  it('should return empty errors for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }).map(n => n / 100),
        fc.integer({ min: 1, max: 99 }).map(n => n / 100),
        fc.integer({ min: 1, max: 99 }).map(n => n / 100),
        fc.integer({ min: 1, max: 10000 }),
        (buyPrice, targetFrac, stopFrac, quantity) => {
          const targetPrice = buyPrice + buyPrice * targetFrac;
          const stopLoss = buyPrice - buyPrice * stopFrac;
          const errors = validateTradeInput({ buyPrice, targetPrice, stopLoss, quantity });
          expect(errors).toEqual([]);
        }
      ),
      FC_CONFIG
    );
  });
});
