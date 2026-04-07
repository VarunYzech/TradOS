import { describe, it, expect } from 'vitest';
import { calculateQuantity, validateTradeInput, calculateProfitLoss, assessRisk } from '../../js/calculator.js';

describe('calculateQuantity', () => {
  it('returns floor of capital divided by buyPrice', () => {
    expect(calculateQuantity(10000, 150)).toBe(66);
  });

  it('returns 0 when capital is less than buyPrice', () => {
    expect(calculateQuantity(50, 150)).toBe(0);
  });

  it('returns exact division when evenly divisible', () => {
    expect(calculateQuantity(1000, 100)).toBe(10);
  });

  it('floors down fractional results', () => {
    expect(calculateQuantity(999, 100)).toBe(9);
  });
});

describe('validateTradeInput', () => {
  it('returns empty array for valid inputs with capital', () => {
    const errors = validateTradeInput({
      buyPrice: 100,
      targetPrice: 120,
      stopLoss: 90,
      capital: 10000,
    });
    expect(errors).toEqual([]);
  });

  it('returns empty array for valid inputs with quantity', () => {
    const errors = validateTradeInput({
      buyPrice: 100,
      targetPrice: 120,
      stopLoss: 90,
      quantity: 50,
    });
    expect(errors).toEqual([]);
  });

  it('returns error when target price equals buy price', () => {
    const errors = validateTradeInput({
      buyPrice: 100,
      targetPrice: 100,
      stopLoss: 90,
      capital: 10000,
    });
    expect(errors).toContain('Target price must be greater than buy price');
  });

  it('returns error when target price is less than buy price', () => {
    const errors = validateTradeInput({
      buyPrice: 100,
      targetPrice: 80,
      stopLoss: 90,
      capital: 10000,
    });
    expect(errors).toContain('Target price must be greater than buy price');
  });

  it('returns error when stop-loss equals buy price', () => {
    const errors = validateTradeInput({
      buyPrice: 100,
      targetPrice: 120,
      stopLoss: 100,
      capital: 10000,
    });
    expect(errors).toContain('Stop-loss must be less than buy price');
  });

  it('returns error when stop-loss is greater than buy price', () => {
    const errors = validateTradeInput({
      buyPrice: 100,
      targetPrice: 120,
      stopLoss: 110,
      capital: 10000,
    });
    expect(errors).toContain('Stop-loss must be less than buy price');
  });

  it('returns error when neither capital nor quantity is positive', () => {
    const errors = validateTradeInput({
      buyPrice: 100,
      targetPrice: 120,
      stopLoss: 90,
    });
    expect(errors).toContain('Capital or quantity must be positive');
  });

  it('returns multiple errors for multiple invalid fields', () => {
    const errors = validateTradeInput({
      buyPrice: 100,
      targetPrice: 80,
      stopLoss: 110,
    });
    expect(errors.length).toBe(3);
  });
});

describe('calculateProfitLoss', () => {
  it('computes profit, loss, and R:R with explicit quantity', () => {
    const result = calculateProfitLoss({
      buyPrice: 100,
      targetPrice: 120,
      stopLoss: 90,
      quantity: 10,
    });
    expect(result.quantity).toBe(10);
    expect(result.profit).toBe(200);   // (120 - 100) * 10
    expect(result.loss).toBe(100);     // (100 - 90) * 10
    expect(result.riskRewardRatio).toBe(0.5); // 100 / 200
  });

  it('auto-calculates quantity from capital when quantity not provided', () => {
    const result = calculateProfitLoss({
      buyPrice: 100,
      targetPrice: 150,
      stopLoss: 80,
      capital: 10000,
    });
    expect(result.quantity).toBe(100); // floor(10000 / 100)
    expect(result.profit).toBe(5000); // (150 - 100) * 100
    expect(result.loss).toBe(2000);   // (100 - 80) * 100
    expect(result.riskRewardRatio).toBeCloseTo(0.4); // 2000 / 5000
  });

  it('returns validation errors for invalid input', () => {
    const result = calculateProfitLoss({
      buyPrice: 100,
      targetPrice: 80,
      stopLoss: 110,
    });
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('uses provided quantity even when capital is also given', () => {
    const result = calculateProfitLoss({
      buyPrice: 200,
      targetPrice: 250,
      stopLoss: 180,
      capital: 50000,
      quantity: 50,
    });
    expect(result.quantity).toBe(50);
    expect(result.profit).toBe(2500);  // (250 - 200) * 50
    expect(result.loss).toBe(1000);    // (200 - 180) * 50
    expect(result.riskRewardRatio).toBe(0.4);
  });
});

describe('assessRisk', () => {
  it('returns Low risk with green for ratio <= 0.5', () => {
    const result = assessRisk(0.4, 1000, 50000);
    expect(result.riskLevel).toBe('Low');
    expect(result.color).toBe('green');
  });

  it('returns Low risk at exact 0.5 boundary', () => {
    const result = assessRisk(0.5, 500, 10000);
    expect(result.riskLevel).toBe('Low');
    expect(result.color).toBe('green');
  });

  it('returns Medium risk with yellow for ratio > 0.5 and <= 1.0', () => {
    const result = assessRisk(0.8, 2000, 30000);
    expect(result.riskLevel).toBe('Medium');
    expect(result.color).toBe('yellow');
  });

  it('returns Medium risk at exact 1.0 boundary', () => {
    const result = assessRisk(1.0, 3000, 20000);
    expect(result.riskLevel).toBe('Medium');
    expect(result.color).toBe('yellow');
  });

  it('returns High risk with red for ratio > 1.0', () => {
    const result = assessRisk(1.5, 5000, 40000);
    expect(result.riskLevel).toBe('High');
    expect(result.color).toBe('red');
  });

  it('sets maxLoss equal to the loss parameter', () => {
    const result = assessRisk(0.3, 1234, 50000);
    expect(result.maxLoss).toBe(1234);
  });

  it('computes safeCapital correctly', () => {
    // safeCapital = capital * (1 - riskRewardRatio * 0.1)
    // = 50000 * (1 - 0.4 * 0.1) = 50000 * 0.96 = 48000
    const result = assessRisk(0.4, 1000, 50000);
    expect(result.safeCapital).toBe(48000);
  });
});
