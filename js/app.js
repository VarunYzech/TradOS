import { loadConfig, fetchStockData, getStockCurrency } from './api.js';
import { computeAll, getRecommendation, predictDirection } from './analysis.js';
import { renderChart, updateChart, setChartInterval, setChartCurrency } from './chart.js';
import { calculateProfitLoss, assessRisk, calculateQuantity } from './calculator.js';
import { fetchLiveCommodityPrices, fetchGoldHistory, fetchGoldHistoryInterval, fetchSilverHistory, getMetalIntervals, getCommodityPrices, getGoldKaratRates, getGoldHistory, getGoldKaratList, getFuelPrices, getFuelCities, getRahuKaalLive, getRahuKaalCities, getMuhuratLive, fetchExchangeRate, getExchangeRate } from './utility.js';
import { createReminder, deleteReminder, getAllReminders, isLocalStorageAvailable } from './reminder.js';
import { STOCK_CATEGORIES, TIME_INTERVALS, searchStocks, getStocksByCategory } from './stocks-data.js';

const FALLBACK_CONFIG = {
  apiKey: '',
  symbol: 'RELIANCE.NSE',
  interval: '1min',
  maWindow: 5,
  volatilityThreshold: 2.0,
  refreshInterval: 60000
};

/** Auto-refresh interval ID, managed by startAutoRefresh/stopAutoRefresh */
let autoRefreshIntervalId = null;

/** Application config loaded during initApp */
let appConfig = null;

/** Current Chart.js instance for the stock chart */
let chartInstance = null;

/** Current currency for stock price display: 'USD' or 'INR' */
let currentCurrency = 'USD';

/**
 * Set the application config (used by initApp and tests).
 * @param {Object} config
 */
export function setAppConfig(config) {
  appConfig = config;
}

/**
 * Get the current application config.
 * @returns {Object|null}
 */
export function getAppConfig() {
  return appConfig;
}

/**
 * Reset the chart instance (used for testing).
 */
export function _resetChartInstance() {
  chartInstance = null;
}

/**
 * Get the current currency ('USD' or 'INR').
 * @returns {string}
 */
export function getCurrentCurrency() {
  return currentCurrency;
}

/**
 * Wire the logo to navigate home on click.
 */
export function setupLogoHome() {
  const logo = document.getElementById('logo-home');
  if (logo) {
    logo.addEventListener('click', () => navigateTo('section-home'));
  }
}

/**
 * Set up the light/dark theme toggle.
 */
export function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    btn.textContent = isLight ? '☀️' : '🌙';
  });
}

/**
 * Set up the currency toggle button in the header.
 * Switches between USD and INR display, re-renders stocks section.
 */
export function setupCurrencyToggle() {
  const btn = document.getElementById('currency-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    currentCurrency = currentCurrency === 'USD' ? 'INR' : 'USD';
    btn.textContent = currentCurrency === 'USD' ? '$ USD' : '₹ INR';
    setChartCurrency(currentCurrency);
    // Re-render stocks if currently visible
    const stocksSection = document.getElementById('section-stocks');
    if (stocksSection && stocksSection.classList.contains('active')) {
      chartInstance = null;
      const canvas = document.getElementById('priceChart');
      if (canvas && canvas.parentElement) canvas.parentElement.innerHTML = '<canvas id="priceChart"></canvas>';
      stopAutoRefresh();
      startAutoRefresh();
    }
  });
}

/**
 * Show a toast notification.
 * @param {string} message - text to display
 * @param {string} type - 'success' | 'error' | 'info'
 * @param {number} [duration=3000] - display time in ms
 */
export function showToast(message, type, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, duration);
}

/**
 * Set up click handlers on the 5 navigation tabs.
 * Each tab calls navigateTo() with the corresponding section id.
 */
export function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const sectionId = tab.getAttribute('data-section');
      if (sectionId) {
        navigateTo(sectionId);
      }
    });
  });
}

/**
 * Switch visible section. Hides all sections, shows the target.
 * Starts/stops auto-refresh when entering/leaving Stocks.
 * @param {string} sectionId - one of 'section-home', 'section-stocks', 'section-calculator', 'section-utilities', 'section-reminders'
 */
export function navigateTo(sectionId) {
  const sections = document.querySelectorAll('.section');
  const tabs = document.querySelectorAll('.nav-tab');

  // Determine if we're leaving the stocks section
  const currentlyActive = document.querySelector('.section.active');
  const leavingStocks = currentlyActive && currentlyActive.id === 'section-stocks' && sectionId !== 'section-stocks';

  // Hide all sections
  sections.forEach(section => {
    section.setAttribute('hidden', '');
    section.classList.remove('active');
  });

  // Show target section
  const target = document.getElementById(sectionId);
  if (target) {
    target.removeAttribute('hidden');
    target.classList.add('active');
  }

  // Update nav tab active state
  tabs.forEach(tab => {
    if (tab.getAttribute('data-section') === sectionId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Auto-refresh lifecycle: start when entering Stocks, stop when leaving
  if (sectionId === 'section-stocks') {
    startAutoRefresh();
  } else if (leavingStocks) {
    stopAutoRefresh();
  }
}

/**
 * Fetch data, run analysis pipeline, update UI.
 * Called on initial Stocks load and every 60s auto-refresh.
 */
export async function refreshStockData() {
  const config = appConfig || {};
  const symbol = config.symbol || 'RELIANCE.NSE';
  const interval = config.interval || '1min';
  const apiKey = config.apiKey;
  const maWindow = config.maWindow || 5;
  const volThreshold = config.volatilityThreshold || 2.0;

  // If no API key configured, show message in stocks section and return
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    const analysisEl = document.getElementById('analysis-results');
    if (analysisEl) {
      analysisEl.innerHTML = '<h2>📊 Analysis Results</h2><p class="placeholder-text">API key is missing. Please configure your API key in /data/config.json.</p>';
    }
    return;
  }

  const prices = await fetchStockData(symbol, interval, apiKey);

  if (!prices || prices.length === 0) {
    return;
  }

  // Run analysis pipeline
  const analysisConfig = { maWindow, volThreshold };
  const analysis = computeAll(prices, analysisConfig);
  const recommendation = getRecommendation(analysis.signalScore.score);
  const trend = analysis.movingAverage != null && prices[prices.length - 1] > analysis.movingAverage;
  const momentum = analysis.momentum != null ? analysis.momentum : 0;
  const prediction = predictDirection(trend, momentum);

  // Build MA values array for chart (rolling MA for each point)
  const maValues = prices.map((_, i) => {
    if (i + 1 < maWindow) return null;
    const slice = prices.slice(i + 1 - maWindow, i + 1);
    return slice.reduce((a, b) => a + b, 0) / maWindow;
  });

  // Currency conversion — only convert if stock currency differs from display currency
  const exchangeRate = getExchangeRate();
  const stockCurrency = getStockCurrency(); // 'USD' for US stocks, 'INR' for BSE/NSE
  let displayMultiplier = 1;
  let currencySymbol = '$';

  if (currentCurrency === 'INR') {
    currencySymbol = '₹';
    if (stockCurrency === 'USD') {
      displayMultiplier = exchangeRate; // Convert USD → INR
    }
    // If stock is already INR (BSE/NSE), no conversion needed
  } else {
    currencySymbol = '$';
    if (stockCurrency === 'INR') {
      displayMultiplier = 1 / exchangeRate; // Convert INR → USD
    }
    // If stock is already USD, no conversion needed
  }

  // Convert prices for display (chart + analysis use same converted values)
  const displayPrices = prices.map(p => p * displayMultiplier);
  const displayMAValues = maValues.map(v => v != null ? v * displayMultiplier : null);

  // Update analysis results DOM
  const currentPrice = displayPrices[displayPrices.length - 1];
  const prevPrice = displayPrices.length > 1 ? displayPrices[displayPrices.length - 2] : currentPrice;
  const priceChange = currentPrice - prevPrice;
  const priceChangePercent = prevPrice ? ((priceChange / prevPrice) * 100) : 0;
  const priceColor = priceChange >= 0 ? '#2ecc71' : '#e74c3c';
  const priceArrow = priceChange >= 0 ? '▲' : '▼';
  const displayMA = analysis.movingAverage != null ? (analysis.movingAverage * displayMultiplier).toFixed(2) : null;

  const analysisEl = document.getElementById('analysis-results');
  if (analysisEl) {
    analysisEl.innerHTML = `<h2>📊 Analysis</h2>
      <div class="analysis-price">
        <span class="analysis-current-price">${currencySymbol}${currentPrice.toFixed(2)}</span>
        <span class="analysis-change" style="color:${priceColor}">${priceArrow} ${currencySymbol}${Math.abs(priceChange).toFixed(2)} (${Math.abs(priceChangePercent).toFixed(2)}%)</span>
      </div>
      <div class="analysis-grid">
        <div class="analysis-item"><span class="analysis-label">Moving Avg (${maWindow})</span><span class="analysis-value">${displayMA != null ? currencySymbol + displayMA : 'N/A'}</span></div>
        <div class="analysis-item"><span class="analysis-label">Momentum</span><span class="analysis-value">${analysis.momentum != null ? (analysis.momentum * 100).toFixed(1) + '%' : 'N/A'}</span></div>
        <div class="analysis-item"><span class="analysis-label">Volatility</span><span class="analysis-value">${analysis.volatility != null ? analysis.volatility.value.toFixed(2) + '% ' + analysis.volatility.classification : 'N/A'}</span></div>
        <div class="analysis-item"><span class="analysis-label">Signal Score</span><span class="analysis-value">${analysis.signalScore.score} / 6</span></div>
      </div>`;
  }

  // Update decision display DOM
  const decisionEl = document.getElementById('decision-display');
  if (decisionEl) {
    const r = recommendation;
    const confWidth = Math.round(r.confidence);
    decisionEl.innerHTML = `<div class="decision-card" style="border-left:4px solid ${r.color || '#4f8cff'}">
      <div class="decision-header"><span class="decision-emoji">${r.emoji}</span><span class="decision-action" style="color:${r.color || '#fff'}">${r.action}</span></div>
      <div class="confidence-bar"><div class="confidence-fill" style="width:${confWidth}%;background:${r.color || '#4f8cff'}"></div></div>
      <p class="confidence-text">Confidence: ${r.confidence.toFixed(1)}%</p>
      <p class="decision-reason">${r.reason}</p>
      <div class="decision-action-box"><p class="decision-action-detail">💡 ${r.actionDetail || ''}</p></div>
    </div>`;
  }

  // Update prediction display DOM
  const predictionEl = document.getElementById('prediction-display');
  if (predictionEl) {
    const p = prediction;
    const pColor = p.direction === 'UP' ? '#2ecc71' : '#e74c3c';
    predictionEl.innerHTML = `<div class="prediction-card">
      <div class="prediction-header"><span class="prediction-emoji">${p.emoji}</span><span class="prediction-direction" style="color:${pColor}">Price likely going ${p.direction}</span></div>
      <p class="prediction-confidence">Confidence: ${p.confidence.toFixed(1)}%</p>
      <p class="prediction-note">${p.direction === 'UP' ? 'Trend and momentum suggest upward movement. Good time to hold or enter.' : 'Downward pressure detected. Consider waiting or protecting positions.'}</p>
    </div>`;
  }

  // Update or render chart (use converted prices)
  if (chartInstance) {
    updateChart(chartInstance, displayPrices, displayMAValues);
  } else {
    chartInstance = renderChart('priceChart', displayPrices, displayMAValues);
  }

  showToast('Stock data updated', 'success');
}

/**
 * Start the 60-second auto-refresh interval for stock data.
 * Calls refreshStockData immediately, then every 60s.
 */
export function startAutoRefresh() {
  // Prevent duplicate intervals
  if (autoRefreshIntervalId !== null) return;
  refreshStockData();
  autoRefreshIntervalId = setInterval(refreshStockData, 60000);
}

/**
 * Stop the auto-refresh interval.
 */
export function stopAutoRefresh() {
  if (autoRefreshIntervalId !== null) {
    clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = null;
  }
}

/**
 * Set up stock categories, autocomplete, and load button.
 */
export function setupStockSymbolSelector() {
  const input = document.getElementById('stock-symbol-input');
  const btn = document.getElementById('stock-symbol-btn');
  const symbolDisplay = document.getElementById('current-symbol');
  const dropdown = document.getElementById('autocomplete-dropdown');
  const categoriesEl = document.getElementById('stock-categories');

  if (!input || !btn) return;

  const config = appConfig || {};
  const currentSymbol = config.symbol || 'AAPL';
  input.value = currentSymbol;
  if (symbolDisplay) symbolDisplay.textContent = `Currently showing: ${currentSymbol}`;

  // ── Render category pills ──
  if (categoriesEl) {
    STOCK_CATEGORIES.forEach(cat => {
      const pill = document.createElement('button');
      pill.className = 'category-pill';
      pill.textContent = cat.label;
      pill.addEventListener('click', () => {
        // Toggle active
        categoriesEl.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        // Show stocks in dropdown
        showDropdownStocks(getStocksByCategory(cat.id));
      });
      categoriesEl.appendChild(pill);
    });
  }

  // ── Autocomplete on typing ──
  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length === 0) {
      hideDropdown();
      return;
    }
    const results = searchStocks(q, 8);
    if (results.length > 0) {
      showDropdownStocks(results);
    } else {
      hideDropdown();
    }
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length > 0) {
      const results = searchStocks(input.value.trim(), 8);
      if (results.length > 0) showDropdownStocks(results);
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrapper') && !e.target.closest('.category-pill')) {
      hideDropdown();
    }
  });

  function showDropdownStocks(stocks) {
    if (!dropdown) return;
    dropdown.innerHTML = stocks.map(s =>
      `<div class="autocomplete-item" data-symbol="${s.symbol}">
        <span class="ac-symbol">${s.symbol}</span>
        <span class="ac-name">${s.name}</span>
      </div>`
    ).join('');
    dropdown.removeAttribute('hidden');

    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.dataset.symbol;
        hideDropdown();
        loadSymbol();
      });
    });
  }

  function hideDropdown() {
    if (dropdown) dropdown.setAttribute('hidden', '');
  }

  function loadSymbol() {
    const symbol = input.value.trim().toUpperCase();
    if (!symbol) {
      showToast('Please enter a stock symbol', 'error');
      return;
    }
    if (appConfig) appConfig.symbol = symbol;
    if (symbolDisplay) symbolDisplay.textContent = `Currently showing: ${symbol}`;
    hideDropdown();

    // Clear active category
    if (categoriesEl) categoriesEl.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));

    // Reset chart
    chartInstance = null;
    const canvas = document.getElementById('priceChart');
    if (canvas) {
      const parent = canvas.parentElement;
      if (parent) parent.innerHTML = '<canvas id="priceChart"></canvas>';
    }

    stopAutoRefresh();
    startAutoRefresh();
    showToast(`Loading ${symbol}...`, 'info');
  }

  btn.addEventListener('click', loadSymbol);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); loadSymbol(); }
  });

  // ── Time Interval Tabs ──
  const intervalTabsEl = document.getElementById('interval-tabs');
  if (intervalTabsEl) {
    const currentInterval = (appConfig && appConfig.interval) || '1min';
    TIME_INTERVALS.forEach(iv => {
      const tab = document.createElement('button');
      tab.className = 'interval-tab' + (iv.id === currentInterval ? ' active' : '');
      tab.textContent = iv.label;
      tab.title = iv.desc;
      tab.addEventListener('click', () => {
        intervalTabsEl.querySelectorAll('.interval-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (appConfig) appConfig.interval = iv.id;
        setChartInterval(iv.id);
        // Reload with new interval
        chartInstance = null;
        const cvs = document.getElementById('priceChart');
        if (cvs && cvs.parentElement) cvs.parentElement.innerHTML = '<canvas id="priceChart"></canvas>';
        stopAutoRefresh();
        startAutoRefresh();
        showToast(`Interval: ${iv.desc}`, 'info');
      });
      intervalTabsEl.appendChild(tab);
    });
  }
}

/**
 * Initialize the application: load config, set up navigation, render Home.
 * Called on DOMContentLoaded.
 */
export async function initApp() {
  // Load config with fallback
  let config = await loadConfig();
  if (config) {
    setAppConfig(config);
  } else {
    setAppConfig({ ...FALLBACK_CONFIG });
    showToast('Failed to load config, using defaults', 'error');
  }

  // Fetch live exchange rate for currency toggle
  await fetchExchangeRate();

  // Set current date in header
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  setupNavigation();
  setupCurrencyToggle();
  setupThemeToggle();
  setupLogoHome();
  renderHome();
  renderUtilities();
  renderCalculator();
  renderReminders();
  setupStockSymbolSelector();
}

/**
 * Render the Home section with disclaimer card and summary info.
 * The Home section HTML is already in index.html, so this ensures the date is displayed.
 */
export async function renderHome() {
  // Set date
  const dateEl = document.getElementById('current-date');
  if (dateEl && !dateEl.textContent) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Populate hero stats with live prices
  const config = appConfig || {};
  const goldEl = document.getElementById('home-gold-price');
  const silverEl = document.getElementById('home-silver-price');
  const stockEl = document.getElementById('home-stock-symbol');

  if (stockEl) stockEl.textContent = config.symbol || 'AAPL';

  try {
    const prices = await fetchLiveCommodityPrices();
    if (goldEl) goldEl.textContent = '₹' + prices.gold.pricePerGram.toLocaleString('en-IN');
    if (silverEl) silverEl.textContent = '₹' + prices.silver.pricePerKg.toLocaleString('en-IN');
  } catch (e) {
    if (goldEl) goldEl.textContent = '--';
    if (silverEl) silverEl.textContent = '--';
  }

  // Wire feature cards to navigate
  document.querySelectorAll('.feature-card[data-nav]').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.getAttribute('data-nav');
      if (target) navigateTo(target);
    });
  });
}

/**
 * Render the Stocks section with chart, analysis results, decision, prediction display.
 * Delegates to refreshStockData which handles the full pipeline.
 * @param {Object} [data] - optional pre-computed analysis data to render directly
 */
export function renderStocks(data) {
  if (!data) {
    refreshStockData();
    return;
  }

  const config = appConfig || {};
  const maWindow = config.maWindow || 5;

  // Render analysis results
  const analysisEl = document.getElementById('analysis-results');
  if (analysisEl && data.analysis) {
    const a = data.analysis;
    analysisEl.innerHTML = `<h2>📊 Analysis Results</h2>
      <p><strong>Moving Average (${maWindow}):</strong> ${a.movingAverage != null ? a.movingAverage.toFixed(2) : 'N/A'}</p>
      <p><strong>Momentum:</strong> ${a.momentum != null ? (a.momentum * 100).toFixed(1) + '%' : 'N/A'}</p>
      <p><strong>Volatility:</strong> ${a.volatility != null ? a.volatility.value.toFixed(2) + '% (' + a.volatility.classification + ')' : 'N/A'}</p>
      <p><strong>Signal Score:</strong> ${a.signalScore.score} / 6</p>`;
  }

  // Render decision
  const decisionEl = document.getElementById('decision-display');
  if (decisionEl && data.recommendation) {
    const r = data.recommendation;
    decisionEl.innerHTML = `<h2>🎯 Trading Decision</h2>
      <p><strong>${r.emoji} ${r.action}</strong></p>
      <p>Confidence: ${r.confidence.toFixed(1)}%</p>
      <p>${r.reason}</p>`;
  }

  // Render prediction
  const predictionEl = document.getElementById('prediction-display');
  if (predictionEl && data.prediction) {
    const p = data.prediction;
    predictionEl.innerHTML = `<h2>🔮 Price Prediction</h2>
      <p><strong>${p.emoji} ${p.direction}</strong></p>
      <p>Confidence: ${p.confidence.toFixed(1)}%</p>`;
  }
}

/**
 * Render the Calculator section: wire input change events to live recalculation,
 * display profit/loss and risk results.
 */
export function renderCalculator() {
  const buyPriceEl = document.getElementById('calc-buy-price');
  const targetEl = document.getElementById('calc-target');
  const stopLossEl = document.getElementById('calc-stop-loss');
  const capitalEl = document.getElementById('calc-capital');
  const quantityEl = document.getElementById('calc-quantity');
  const resultsEl = document.getElementById('calc-results');

  if (!buyPriceEl || !targetEl || !stopLossEl || !capitalEl || !quantityEl || !resultsEl) {
    return;
  }

  function recalculate() {
    const buyPrice = parseFloat(buyPriceEl.value);
    const targetPrice = parseFloat(targetEl.value);
    const stopLoss = parseFloat(stopLossEl.value);
    const capital = parseFloat(capitalEl.value);
    const quantity = parseFloat(quantityEl.value);

    // Need at least buy price to start
    if (isNaN(buyPrice) || buyPrice <= 0) {
      resultsEl.innerHTML = '<h2>📋 Results</h2><p class="placeholder-text">Enter trade details above to see results.</p>';
      return;
    }

    // Auto-calculate quantity from capital if capital is provided and quantity is empty
    if (!isNaN(capital) && capital > 0 && (isNaN(quantity) || quantity <= 0)) {
      const autoQty = calculateQuantity(capital, buyPrice);
      quantityEl.value = autoQty;
    }

    // Build input object
    const input = { buyPrice, targetPrice, stopLoss };
    if (!isNaN(capital) && capital > 0) input.capital = capital;
    const currentQty = parseFloat(quantityEl.value);
    if (!isNaN(currentQty) && currentQty > 0) input.quantity = currentQty;

    // Validate and calculate
    const result = calculateProfitLoss(input);

    if (result.errors) {
      resultsEl.innerHTML = `<h2>📋 Results</h2>
        <div class="validation-errors">
          ${result.errors.map(e => `<p class="error-text">⚠️ ${e}</p>`).join('')}
        </div>`;
      return;
    }

    // Assess risk
    const effectiveCapital = (!isNaN(capital) && capital > 0) ? capital : result.quantity * buyPrice;
    const risk = assessRisk(result.riskRewardRatio, result.loss, effectiveCapital);

    resultsEl.innerHTML = `<h2>📋 Results</h2>
      <div class="calc-result-grid">
        <p><strong>Quantity:</strong> ${result.quantity} shares</p>
        <p><strong>Potential Profit:</strong> <span class="profit-text">₹${result.profit.toFixed(2)}</span></p>
        <p><strong>Potential Loss:</strong> <span class="loss-text">₹${result.loss.toFixed(2)}</span></p>
        <p><strong>Risk:Reward Ratio:</strong> ${result.riskRewardRatio.toFixed(2)}</p>
      </div>
      <div class="risk-assessment">
        <h3>Risk Assessment</h3>
        <p><strong>Risk Level:</strong> <span class="risk-indicator" style="color: ${risk.color};">${risk.riskLevel}</span></p>
        <p><strong>Max Loss:</strong> ₹${risk.maxLoss.toFixed(2)}</p>
        <p><strong>Safe Capital:</strong> ₹${risk.safeCapital.toFixed(2)}</p>
      </div>`;
  }

  // Wire input event listeners for live recalculation
  [buyPriceEl, targetEl, stopLossEl, capitalEl, quantityEl].forEach(el => {
    el.addEventListener('input', recalculate);
  });
}

/**
 * Render the Utilities section with interactive controls.
 */
export async function renderUtilities() {
  // ── Gold & Silver: fetch live prices first ──
  const commodityEl = document.getElementById('commodity-prices');
  if (commodityEl) {
    commodityEl.innerHTML = `<h2>🥇 Gold &amp; Silver Prices</h2><p class="placeholder-text">Fetching live prices...</p>`;
  }

  const liveData = await fetchLiveCommodityPrices();

  if (commodityEl) {
    const liveTag = liveData.live
      ? `<span class="live-badge">● LIVE</span>`
      : `<span class="stale-badge">● Cached</span>`;
    const timeStr = liveData.updatedAt
      ? new Date(liveData.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '';

    commodityEl.innerHTML = `<h2>🥇 Gold &amp; Silver Prices ${liveTag}</h2>
      <div class="commodity-grid">
        <div class="commodity-item"><span class="commodity-label">Gold (24K)</span><span class="commodity-value">₹${liveData.gold.pricePerGram.toLocaleString('en-IN')}/g</span></div>
        <div class="commodity-item"><span class="commodity-label">Silver</span><span class="commodity-value">₹${liveData.silver.pricePerKg.toLocaleString('en-IN')}/kg</span></div>
      </div>
      ${timeStr ? `<p class="update-time">Updated: ${timeStr}</p>` : ''}
      <div class="commodity-actions">
        <button class="btn btn-sm btn-primary" id="open-gold-detail">🥇 Gold Detail</button>
        <button class="btn btn-sm" id="open-silver-detail" style="background:var(--color-surface-alt);color:var(--color-text);border:1px solid var(--color-border);">🥈 Silver Detail</button>
      </div>`;

    document.getElementById('open-gold-detail')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const detail = document.getElementById('gold-detail');
      if (detail) { detail.removeAttribute('hidden'); renderGoldDetail('24K'); }
      commodityEl.setAttribute('hidden', '');
    });
    document.getElementById('open-silver-detail')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const detail = document.getElementById('silver-detail');
      if (detail) { detail.removeAttribute('hidden'); renderSilverDetail(); }
      commodityEl.setAttribute('hidden', '');
    });
  }

  // Gold detail close
  const closeBtn = document.getElementById('gold-detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('gold-detail')?.setAttribute('hidden', '');
      commodityEl?.removeAttribute('hidden');
    });
  }

  // Silver detail close
  const silverCloseBtn = document.getElementById('silver-detail-close');
  if (silverCloseBtn) {
    silverCloseBtn.addEventListener('click', () => {
      document.getElementById('silver-detail')?.setAttribute('hidden', '');
      commodityEl?.removeAttribute('hidden');
    });
  }

  // ── Karat tabs ──
  const karatTabsEl = document.getElementById('karat-tabs');
  if (karatTabsEl) {
    getGoldKaratList().forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'karat-tab' + (k === '24K' ? ' active' : '');
      btn.textContent = k;
      btn.addEventListener('click', () => {
        karatTabsEl.querySelectorAll('.karat-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderGoldDetail(k);
      });
      karatTabsEl.appendChild(btn);
    });
  }

  // ── Gold Interval Tabs ──
  const goldIntervalEl = document.getElementById('gold-interval-tabs');
  if (goldIntervalEl) {
    getMetalIntervals().forEach(iv => {
      const tab = document.createElement('button');
      tab.className = 'interval-tab' + (iv.id === '1day' ? ' active' : '');
      tab.textContent = iv.label;
      tab.title = iv.desc;
      tab.addEventListener('click', () => {
        goldIntervalEl.querySelectorAll('.interval-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentGoldInterval = iv.id;
        renderGoldHistoryChart(selectedKarat);
      });
      goldIntervalEl.appendChild(tab);
    });
  }

  // ── Silver Interval Tabs ──
  const silverIntervalEl = document.getElementById('silver-interval-tabs');
  if (silverIntervalEl) {
    getMetalIntervals().forEach(iv => {
      const tab = document.createElement('button');
      tab.className = 'interval-tab' + (iv.id === '1day' ? ' active' : '');
      tab.textContent = iv.label;
      tab.title = iv.desc;
      tab.addEventListener('click', () => {
        silverIntervalEl.querySelectorAll('.interval-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentSilverInterval = iv.id;
        renderSilverHistoryChart();
      });
      silverIntervalEl.appendChild(tab);
    });
  }

  // ── Fuel Prices ──
  const fuelSelect = document.getElementById('fuel-city-select');
  if (fuelSelect) {
    getFuelCities().forEach(city => {
      const opt = document.createElement('option');
      opt.value = city; opt.textContent = city;
      if (city === 'Mumbai') opt.selected = true;
      fuelSelect.appendChild(opt);
    });
    fuelSelect.addEventListener('change', () => renderFuelData(fuelSelect.value));
    renderFuelData('Mumbai');
  }

  // ── Rahu Kaal ──
  const rahuSelect = document.getElementById('rahu-city-select');
  if (rahuSelect) {
    getRahuKaalCities().forEach(city => {
      const opt = document.createElement('option');
      opt.value = city; opt.textContent = city;
      if (city === 'Mumbai') opt.selected = true;
      rahuSelect.appendChild(opt);
    });
    rahuSelect.addEventListener('change', () => renderRahuData(rahuSelect.value));
    renderRahuData('Mumbai');
  }

  // ── Muhurat with city + visual calendar ──
  const muhuratCitySelect = document.getElementById('muhurat-city-select');
  if (muhuratCitySelect) {
    getRahuKaalCities().forEach(city => {
      const opt = document.createElement('option');
      opt.value = city; opt.textContent = city;
      if (city === 'Mumbai') opt.selected = true;
      muhuratCitySelect.appendChild(opt);
    });
    muhuratCitySelect.addEventListener('change', () => renderMuhuratData());
  }
  renderMiniCalendar(new Date());
  renderMuhuratData();
}

/** Gold detail: karat table + live history chart */
let goldChartInstance = null;
let silverChartInstance = null;
let selectedKarat = '24K';
let currentGoldInterval = '1day';
let currentSilverInterval = '1day';

function renderGoldDetail(karat) {
  selectedKarat = karat || '24K';
  const ratesEl = document.getElementById('gold-karat-rates');
  if (ratesEl) {
    const rates = getGoldKaratRates();
    ratesEl.innerHTML = `<table class="karat-table">
      <thead><tr><th>Karat</th><th>₹/gram</th><th>₹/10g</th></tr></thead>
      <tbody>${rates.map(r => `<tr class="${r.karat === selectedKarat ? 'karat-row-active' : ''}"><td>${r.label}</td><td>₹${r.pricePerGram.toLocaleString('en-IN')}</td><td>₹${r.pricePer10Gram.toLocaleString('en-IN')}</td></tr>`).join('')}</tbody>
    </table>
    <p class="update-time" style="margin-top:10px;">Prices from live market via gold-api.com</p>`;
  }
  renderGoldHistoryChart(selectedKarat);
}

async function renderGoldHistoryChart(karat) {
  const statusEl = document.getElementById('gold-chart-status');
  if (statusEl) statusEl.textContent = 'Loading history...';

  const config = appConfig || {};
  const apiKey = config.apiKey;
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    if (statusEl) statusEl.textContent = 'API key needed for history chart';
    return;
  }

  const history = await fetchGoldHistoryInterval(apiKey, karat, currentGoldInterval);
  const canvas = document.getElementById('goldHistoryChart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (!history.live || history.prices.length === 0) {
    if (statusEl) statusEl.textContent = 'Could not load history data';
    return;
  }

  const colors = { '24K': '#f1c40f', '22K': '#e67e22', '18K': '#e74c3c', '14K': '#9b59b6' };
  const color = colors[karat] || '#f1c40f';

  if (goldChartInstance) goldChartInstance.destroy();
  goldChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: history.dates,
      datasets: [{
        label: `Gold ${karat} (₹/g)`,
        data: history.prices,
        borderColor: color, backgroundColor: color + '1a',
        tension: 0.3, fill: true, pointRadius: 2, pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true, labels: { color: '#e4e6ed' } } },
      scales: {
        x: { ticks: { color: '#8b8fa3', maxRotation: 45, autoSkip: true, maxTicksLimit: 10 }, grid: { color: '#2e324020' } },
        y: { title: { display: true, text: '₹/gram', color: '#8b8fa3', font: { size: 10 } }, ticks: { color: '#8b8fa3' }, grid: { color: '#2e324040' } }
      }
    }
  });

  if (statusEl) statusEl.innerHTML = 'Live data from Twelve Data API <span class="live-badge">● LIVE</span>';
}

function renderGoldChart(karat) { renderGoldDetail(karat); }

function renderSilverDetail() {
  const infoEl = document.getElementById('silver-price-info');
  if (infoEl) {
    const prices = getCommodityPrices();
    const perGram = Math.round(prices.silver.pricePerKg / 1000);
    const per10g = Math.round(prices.silver.pricePerKg / 100);
    const per100g = Math.round(prices.silver.pricePerKg / 10);
    infoEl.innerHTML = `<table class="karat-table">
      <thead><tr><th>Unit</th><th>Price (₹)</th></tr></thead>
      <tbody>
        <tr><td>Per gram</td><td>₹${perGram.toLocaleString('en-IN')}</td></tr>
        <tr><td>Per 10 grams</td><td>₹${per10g.toLocaleString('en-IN')}</td></tr>
        <tr><td>Per 100 grams</td><td>₹${per100g.toLocaleString('en-IN')}</td></tr>
        <tr class="karat-row-active"><td>Per kg</td><td>₹${prices.silver.pricePerKg.toLocaleString('en-IN')}</td></tr>
      </tbody>
    </table>
    <p class="update-time" style="margin-top:10px;">Live price from gold-api.com <span class="live-badge">● LIVE</span></p>`;
  }
  renderSilverHistoryChart();
}

async function renderSilverHistoryChart() {
  const statusEl = document.getElementById('silver-chart-status');
  if (statusEl) statusEl.textContent = 'Loading history...';

  const config = appConfig || {};
  const apiKey = config.apiKey;
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    if (statusEl) statusEl.textContent = 'API key needed for history chart';
    return;
  }

  const history = await fetchSilverHistory(apiKey, currentSilverInterval);
  const canvas = document.getElementById('silverHistoryChart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (!history.live || history.prices.length === 0) {
    if (statusEl) {
      statusEl.innerHTML = `<span style="color:var(--color-warning)">⚠️ ${history.reason || 'Silver history (XAG/USD) requires Twelve Data paid plan.'}</span><br>
        <span>Live price shown above is from gold-api.com (free). Upgrade Twelve Data to Grow plan for historical charts.</span>`;
    }
    // Hide the empty canvas
    canvas.style.display = 'none';
    return;
  }

  canvas.style.display = '';
  if (silverChartInstance) silverChartInstance.destroy();
  silverChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: history.dates,
      datasets: [{
        label: 'Silver (₹/kg)',
        data: history.prices,
        borderColor: '#95a5a6', backgroundColor: 'rgba(149,165,166,0.1)',
        tension: 0.3, fill: true, pointRadius: 2, pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true, labels: { color: '#e4e6ed' } } },
      scales: {
        x: { ticks: { color: '#8b8fa3', maxRotation: 45, autoSkip: true, maxTicksLimit: 10 }, grid: { color: '#2e324020' } },
        y: { title: { display: true, text: '₹/kg', color: '#8b8fa3', font: { size: 10 } }, ticks: { color: '#8b8fa3' }, grid: { color: '#2e324040' } }
      }
    }
  });

  if (statusEl) statusEl.innerHTML = 'Live data from Twelve Data API <span class="live-badge">● LIVE</span>';
}

function renderFuelData(city) {
  const el = document.getElementById('fuel-data');
  if (!el) return;
  const fuel = getFuelPrices(city);
  el.innerHTML = `<div class="fuel-grid">
    <div class="fuel-item"><span class="fuel-icon">⛽</span><span class="fuel-label">Petrol</span><span class="fuel-value">₹${fuel.petrol.toFixed(2)}/L</span></div>
    <div class="fuel-item"><span class="fuel-icon">🛢️</span><span class="fuel-label">Diesel</span><span class="fuel-value">₹${fuel.diesel.toFixed(2)}/L</span></div>
  </div>
  <p class="update-time">Source: IOCL published rates (no free live API available)</p>`;
}

async function renderRahuData(city) {
  const el = document.getElementById('rahu-data');
  if (!el) return;
  el.innerHTML = '<p class="placeholder-text">Fetching live sunrise data...</p>';
  const rk = await getRahuKaalLive(new Date(), city);
  const liveTag = rk.live ? '<span class="live-badge">● LIVE</span>' : '';
  el.innerHTML = `<div class="time-display"><span class="time-label">Start</span><span class="time-value">${rk.start}</span></div>
    <div class="time-display"><span class="time-label">End</span><span class="time-value">${rk.end}</span></div>
    <p class="update-time">Based on actual sunrise/sunset for ${city} ${liveTag}</p>`;
}

let muhuratSelectedDate = new Date();
let muhuratCalendarMonth = new Date();

function renderMiniCalendar(viewDate) {
  const container = document.getElementById('muhurat-calendar');
  if (!container) return;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  let html = `<div class="cal-header">
    <button class="cal-nav" id="cal-prev">◀</button>
    <span class="cal-title">${monthNames[month]} ${year}</span>
    <button class="cal-nav" id="cal-next">▶</button>
  </div>
  <div class="cal-grid">
    <div class="cal-day-name">Su</div><div class="cal-day-name">Mo</div><div class="cal-day-name">Tu</div>
    <div class="cal-day-name">We</div><div class="cal-day-name">Th</div><div class="cal-day-name">Fr</div><div class="cal-day-name">Sa</div>`;

  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const thisDate = new Date(year, month, d);
    const isToday = thisDate.toDateString() === today.toDateString();
    const isSelected = thisDate.toDateString() === muhuratSelectedDate.toDateString();
    let cls = 'cal-day';
    if (isToday) cls += ' cal-today';
    if (isSelected) cls += ' cal-selected';
    html += `<div class="${cls}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}">${d}</div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  // Wire events
  container.querySelectorAll('.cal-day:not(.empty)').forEach(el => {
    el.addEventListener('click', () => {
      muhuratSelectedDate = new Date(el.dataset.date + 'T00:00:00');
      renderMiniCalendar(viewDate);
      renderMuhuratData();
    });
  });

  const prevBtn = container.querySelector('#cal-prev');
  const nextBtn = container.querySelector('#cal-next');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    muhuratCalendarMonth = new Date(year, month - 1, 1);
    renderMiniCalendar(muhuratCalendarMonth);
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    muhuratCalendarMonth = new Date(year, month + 1, 1);
    renderMiniCalendar(muhuratCalendarMonth);
  });
}

async function renderMuhuratData() {
  const el = document.getElementById('muhurat-data');
  if (!el) return;
  const cityInput = document.getElementById('muhurat-city-select');
  const city = cityInput ? cityInput.value : 'Mumbai';

  el.innerHTML = '<p class="placeholder-text">Fetching live sunrise data...</p>';
  const m = await getMuhuratLive(muhuratSelectedDate, city);
  const liveTag = m.live ? '<span class="live-badge">● LIVE</span>' : '';
  el.innerHTML = `<div class="time-display"><span class="time-label">Day</span><span class="time-value">${m.dayName}</span></div>
    <div class="time-display"><span class="time-label">Start</span><span class="time-value">${m.start}</span></div>
    <div class="time-display"><span class="time-label">End</span><span class="time-value">${m.end}</span></div>
    <p class="update-time">Based on actual sunrise/sunset for ${city} ${liveTag}</p>`;
}

/**
 * Render the Reminders section: load and display reminders, wire create/delete handlers.
 * Shows an info toast if localStorage is unavailable.
 */
export function renderReminders() {
  if (!isLocalStorageAvailable()) {
    showToast('localStorage is unavailable. Reminders cannot be saved.', 'info');
  }

  const listEl = document.getElementById('reminder-list');
  const addBtn = document.getElementById('reminder-add-btn');
  const titleInput = document.getElementById('reminder-title');
  const datetimeInput = document.getElementById('reminder-datetime');

  if (!listEl) return;

  function renderList() {
    const reminders = getAllReminders();
    if (reminders.length === 0) {
      listEl.innerHTML = '<p class="placeholder-text">No reminders yet. Add one above.</p>';
      return;
    }
    listEl.innerHTML = reminders.map(r => {
      const dt = new Date(r.dateTime);
      const formatted = isNaN(dt.getTime()) ? r.dateTime : dt.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      return `<div class="reminder-item">
  <div class="reminder-info">
    <div class="reminder-title">${r.title}</div>
    <div class="reminder-datetime">${formatted}</div>
  </div>
  <button class="reminder-delete-btn" data-id="${r.id}">Delete</button>
</div>`;
    }).join('');

    // Wire delete buttons
    listEl.querySelectorAll('.reminder-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const deleted = deleteReminder(id);
        if (deleted) {
          showToast('Reminder deleted', 'success');
        } else {
          showToast('Failed to delete reminder', 'error');
        }
        renderList();
      });
    });
  }

  // Wire add button
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const title = titleInput ? titleInput.value.trim() : '';
      const dateTime = datetimeInput ? datetimeInput.value : '';

      if (!title || !dateTime) {
        showToast('Please enter both title and date/time', 'error');
        return;
      }

      createReminder(title, dateTime);
      showToast('Reminder added', 'success');

      if (titleInput) titleInput.value = '';
      if (datetimeInput) datetimeInput.value = '';

      renderList();
    });
  }

  renderList();
}

// Register DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', initApp);
