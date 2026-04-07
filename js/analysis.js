/**
 * Compute the arithmetic mean of the last `window` closing prices.
 * @param {number[]} prices - array of closing prices (oldest first)
 * @param {number} window - number of recent prices to average
 * @returns {number|null} The moving average value, or null if prices.length < window.
 */
export function computeMovingAverage(prices, window) {
  if (!Array.isArray(prices) || prices.length < window || window <= 0) {
    return null;
  }

  const slice = prices.slice(-window);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / window;
}

/**
 * Compute momentum as ratio of upward movements to total movements
 * over the last N candles.
 * @param {number[]} prices - array of closing prices
 * @param {number} window - number of candles to evaluate
 * @returns {number|null} Momentum ratio between 0.0 and 1.0, or null if insufficient data.
 */
export function computeMomentum(prices, window) {
  if (!Array.isArray(prices) || prices.length < window || window < 2) {
    return null;
  }

  const slice = prices.slice(-window);
  let upCount = 0;
  const totalMovements = slice.length - 1;

  for (let i = 1; i < slice.length; i++) {
    if (slice[i] > slice[i - 1]) {
      upCount++;
    }
  }

  return upCount / totalMovements;
}

/**
 * Compute volatility as percentage of price fluctuation over last N candles.
 * @param {number[]} prices - array of closing prices
 * @param {number} window - number of candles to evaluate
 * @param {number} threshold - percentage threshold for Low/High classification
 * @returns {{ value: number, classification: 'Low' | 'High' }|null} Volatility info, or null if insufficient data.
 */
export function computeVolatility(prices, window, threshold) {
  if (!Array.isArray(prices) || prices.length < window || window < 1) {
    return null;
  }

  const slice = prices.slice(-window);
  const min = Math.min(...slice);
  const max = Math.max(...slice);
  const value = ((max - min) / min) * 100;
  const classification = value < threshold ? 'Low' : 'High';

  return { value, classification };
}

/**
 * Compute the composite Signal Score (0–6).
 * Components:
 *   +2 if current price > MA
 *   +2 if momentum > 0.5 (trending upward)
 *   +1 if last 3 candles are all rising
 *   +1 if volatility is classified as Low
 * @param {number[]} prices - array of closing prices
 * @param {{ maWindow: number, volThreshold: number }} config
 * @returns {{ score: number, components: object }}
 */
export function computeSignalScore(prices, config) {
  let score = 0;
  let priceAboveMA = false;
  let priceAboveMAScore = 0;
  let momentumUp = false;
  let momentumScore = 0;
  let last3Rising = false;
  let last3RisingScore = 0;
  let lowVolatility = false;
  let lowVolatilityScore = 0;

  const ma = computeMovingAverage(prices, config.maWindow);
  const momentum = computeMomentum(prices, config.maWindow);
  const volatility = computeVolatility(prices, config.maWindow, config.volThreshold);
  const currentPrice = prices[prices.length - 1];

  // Component 1: Price above MA (+2)
  if (ma != null && currentPrice > ma) {
    score += 2;
    priceAboveMA = true;
    priceAboveMAScore = 2;
  }

  // Component 2: Momentum trending upward (+2)
  if (momentum != null && momentum > 0.5) {
    score += 2;
    momentumUp = true;
    momentumScore = 2;
  }

  // Component 3: Last 3 candles rising (+1)
  if (prices.length >= 3) {
    const last3 = prices.slice(-3);
    if (last3[0] < last3[1] && last3[1] < last3[2]) {
      score += 1;
      last3Rising = true;
      last3RisingScore = 1;
    }
  }

  // Component 4: Low volatility (+1)
  if (volatility != null && volatility.classification === 'Low') {
    score += 1;
    lowVolatility = true;
    lowVolatilityScore = 1;
  }

  return {
    score,
    components: {
      priceAboveMA,
      priceAboveMAScore,
      momentumUp,
      momentumScore,
      last3Rising,
      last3RisingScore,
      lowVolatility,
      lowVolatilityScore
    }
  };
}

/**
 * Run the full analysis pipeline.
 * @param {number[]} prices - array of closing prices
 * @param {{ maWindow: number, volThreshold: number }} config - analysis configuration
 * @returns {{ movingAverage: number|null, momentum: number|null, volatility: { value: number, classification: string }|null, signalScore: { score: number, components: object } }}
 */
export function computeAll(prices, config) {
  const movingAverage = computeMovingAverage(prices, config.maWindow);
  const momentum = computeMomentum(prices, config.maWindow);
  const volatility = computeVolatility(prices, config.maWindow, config.volThreshold);
  const signalScore = computeSignalScore(prices, config);

  return {
    movingAverage,
    momentum,
    volatility,
    signalScore
  };
}

/**
 * Map a Signal Score to a trading recommendation.
 * @param {number} signalScore - integer 0–6
 * @returns {{ action: string, confidence: number, reason: string, emoji: string }}
 *   action: 'STRONG BUY' | 'BUY' | 'WAIT / SELL'
 *   confidence: signalScore / 6 * 100 (percentage)
 *   emoji: '🟢' | '🟡' | '🔴'
 */
export function getRecommendation(signalScore) {
  const confidence = (signalScore / 6) * 100;

  if (signalScore >= 5) {
    return {
      action: 'STRONG BUY',
      confidence,
      reason: 'Multiple strong bullish indicators aligned. Price is above moving average with strong upward momentum and low volatility. This is a high-conviction entry point — consider buying now.',
      emoji: '🟢',
      actionDetail: 'BUY NOW — Strong entry signal. Set a stop-loss 2-3% below current price to manage risk.',
      color: '#2ecc71'
    };
  }

  if (signalScore >= 3) {
    return {
      action: 'BUY',
      confidence,
      reason: 'Moderate bullish signals detected. Some indicators are positive but not all conditions are ideal. The trend shows potential but with mixed signals.',
      emoji: '🟡',
      actionDetail: 'CONSIDER BUYING — Wait for a small dip for better entry, or buy a smaller position. Use a tighter stop-loss.',
      color: '#f1c40f'
    };
  }

  return {
    action: 'WAIT / SELL',
    confidence,
    reason: 'Bearish or weak signals dominate. Price is below moving average, momentum is declining, or volatility is high. The risk of further decline is elevated.',
    emoji: '🔴',
    actionDetail: 'DO NOT BUY — If holding, consider setting a stop-loss or taking profits. Wait for bullish signals before entering.',
    color: '#e74c3c'
  };
}

/**
 * Predict price direction based on trend and momentum.
 * @param {boolean} trend - whether the price is above MA
 * @param {number} momentum - momentum ratio (0–1)
 * @returns {{ direction: 'UP' | 'DOWN', confidence: number, emoji: string }}
 *   direction: 'UP' when trend is true and momentum > 0.5, otherwise 'DOWN'
 *   emoji: '⬆️' for UP, '⬇️' for DOWN
 *   confidence: momentum * 100 for UP, (1 - momentum) * 100 for DOWN
 */
export function predictDirection(trend, momentum) {
  if (trend && momentum > 0.5) {
    return {
      direction: 'UP',
      confidence: momentum * 100,
      emoji: '⬆️'
    };
  }

  return {
    direction: 'DOWN',
    confidence: (1 - momentum) * 100,
    emoji: '⬇️'
  };
}
