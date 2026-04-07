/** Module-level cache for last successful closing prices */
let cachedData = null;
let cachedStockCurrency = 'USD';

/**
 * Load and parse /data/config.json.
 * @returns {Promise<Object|null>} Config object or null if loading fails.
 */
export async function loadConfig() {
  try {
    const response = await fetch('/data/config.json');
    if (!response.ok) {
      return null;
    }
    const config = await response.json();
    return config;
  } catch (e) {
    return null;
  }
}

/**
 * Extract closing prices from the Twelve Data API response payload.
 * @param {Object} responseData - raw JSON response from the API
 * @returns {number[]} Array of closing price numbers, ordered oldest to newest.
 */
export function extractClosingPrices(responseData) {
  if (!responseData || !Array.isArray(responseData.values) || responseData.values.length === 0) {
    return [];
  }
  // Twelve Data returns values newest-first, so reverse for oldest-first
  return responseData.values
    .slice()
    .reverse()
    .map(item => parseFloat(item.close));
}

/**
 * Get the last successfully fetched data (cache).
 * @returns {number[]|null} Cached closing prices array or null.
 */
export function getCachedData() {
  return cachedData;
}

/**
 * Get the currency of the last fetched stock.
 * @returns {string} 'USD', 'INR', etc.
 */
export function getStockCurrency() {
  return cachedStockCurrency;
}

/**
 * Show or hide the loading spinner element.
 * @param {boolean} visible - whether to show the spinner
 */
function setSpinnerVisible(visible) {
  const spinner = typeof document !== 'undefined' ? document.getElementById('loading-spinner') : null;
  if (spinner) {
    spinner.style.display = visible ? 'flex' : 'none';
  }
}

/**
 * Show a simple error toast via DOM. Falls back silently if DOM not available.
 * @param {string} message - error message to display
 */
function showErrorToast(message) {
  const container = typeof document !== 'undefined' ? document.getElementById('toast-container') : null;
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast error';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3000);
}

/**
 * Fetch time-series data from Twelve Data API.
 * Shows loading spinner during fetch. On error, shows toast and returns cached data.
 * @param {string} [symbol='RELIANCE.NSE'] - stock symbol
 * @param {string} [interval='1min'] - data interval
 * @param {string} apiKey - Twelve Data API key
 * @returns {Promise<number[]|null>} Array of closing prices (oldest first), or null on failure with no cache.
 */
export async function fetchStockData(symbol = 'RELIANCE.NSE', interval = '1min', apiKey) {
  setSpinnerVisible(true);
  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&apikey=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    const data = await response.json();
    if (data.status === 'error' || !data.values) {
      throw new Error(data.message || 'Invalid API response');
    }
    // Extract currency from API meta (e.g., "USD" for US stocks, "INR" for BSE/NSE)
    if (data.meta && data.meta.currency) {
      cachedStockCurrency = data.meta.currency;
    }
    const prices = extractClosingPrices(data);
    cachedData = prices;
    return prices;
  } catch (e) {
    showErrorToast(e.message || 'Failed to fetch stock data');
    return cachedData;
  } finally {
    setSpinnerVisible(false);
  }
}
