/**
 * Auto-calculate quantity from capital and buy price.
 * @param {number} capital - total capital in INR
 * @param {number} buyPrice - price per share in INR
 * @returns {number} floor(capital / buyPrice)
 */
export function calculateQuantity(capital, buyPrice) {
  return Math.floor(capital / buyPrice);
}

/**
 * Validate trade inputs.
 * - target must be > buyPrice
 * - stopLoss must be < buyPrice
 * - capital or quantity must be positive
 * @param {TradeInput} input - trade input fields { buyPrice, targetPrice, stopLoss, capital?, quantity? }
 * @returns {string[]} Array of validation error messages, empty if valid.
 */
export function validateTradeInput(input) {
  const errors = [];
  const { buyPrice, targetPrice, stopLoss, capital, quantity } = input;

  if (targetPrice <= buyPrice) {
    errors.push('Target price must be greater than buy price');
  }

  if (stopLoss >= buyPrice) {
    errors.push('Stop-loss must be less than buy price');
  }

  const hasPositiveCapital = capital !== undefined && capital !== null && capital > 0;
  const hasPositiveQuantity = quantity !== undefined && quantity !== null && quantity > 0;

  if (!hasPositiveCapital && !hasPositiveQuantity) {
    errors.push('Capital or quantity must be positive');
  }

  return errors;
}

/**
 * Calculate profit, loss, and risk/reward ratio.
 * @param {{ buyPrice: number, targetPrice: number, stopLoss: number, capital?: number, quantity?: number }} input
 * @returns {{ quantity: number, profit: number, loss: number, riskRewardRatio: number } | { errors: string[] }}
 */
export function calculateProfitLoss(input) {
  const errors = validateTradeInput(input);
  if (errors.length > 0) {
    return { errors };
  }

  let quantity = input.quantity;
  if ((quantity === undefined || quantity === null) && input.capital > 0) {
    quantity = calculateQuantity(input.capital, input.buyPrice);
  }

  const profit = (input.targetPrice - input.buyPrice) * quantity;
  const loss = (input.buyPrice - input.stopLoss) * quantity;
  const riskRewardRatio = loss / profit;

  return { quantity, profit, loss, riskRewardRatio };
}

/**
 * Assess trade risk based on risk/reward ratio.
 * @param {number} riskRewardRatio - loss / profit ratio
 * @param {number} loss - maximum loss in INR
 * @param {number} capital - user's capital in INR
 * @returns {{ riskLevel: 'Low'|'Medium'|'High', maxLoss: number, safeCapital: number, color: string }}
 */
export function assessRisk(riskRewardRatio, loss, capital) {
  let riskLevel;
  let color;

  if (riskRewardRatio <= 0.5) {
    riskLevel = 'Low';
    color = 'green';
  } else if (riskRewardRatio <= 1.0) {
    riskLevel = 'Medium';
    color = 'yellow';
  } else {
    riskLevel = 'High';
    color = 'red';
  }

  const maxLoss = loss;
  const safeCapital = capital * (1 - riskRewardRatio * 0.1);

  return { riskLevel, maxLoss, safeCapital, color };
}
