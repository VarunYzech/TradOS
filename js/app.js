import { loadConfig, fetchStockData } from './api.js';
import { computeAll, getRecommendation, predictDirection } from './analysis.js';
import { renderChart, updateChart } from './chart.js';
import { calculateProfitLoss, assessRisk, calculateQuantity } from './calculator.js';
import { getCommodityPrices, getGoldKaratRates, getGoldHistory, getFuelPrices, getFuelCities, getRahuKaal, getRahuKaalCities, getMuhurat } from './utility.js';
import { createReminder, deleteReminder, getAllReminders, isLocalStorageAvailable } from './reminder.js';

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

  // Update analysis results DOM
  const analysisEl = document.getElementById('analysis-results');
  if (analysisEl) {
    analysisEl.innerHTML = `<h2>📊 Analysis Results</h2>
      <p><strong>Moving Average (${maWindow}):</strong> ${analysis.movingAverage != null ? analysis.movingAverage.toFixed(2) : 'N/A'}</p>
      <p><strong>Momentum:</strong> ${analysis.momentum != null ? (analysis.momentum * 100).toFixed(1) + '%' : 'N/A'}</p>
      <p><strong>Volatility:</strong> ${analysis.volatility != null ? analysis.volatility.value.toFixed(2) + '% (' + analysis.volatility.classification + ')' : 'N/A'}</p>
      <p><strong>Signal Score:</strong> ${analysis.signalScore.score} / 6</p>`;
  }

  // Update decision display DOM
  const decisionEl = document.getElementById('decision-display');
  if (decisionEl) {
    decisionEl.innerHTML = `<h2>🎯 Trading Decision</h2>
      <p><strong>${recommendation.emoji} ${recommendation.action}</strong></p>
      <p>Confidence: ${recommendation.confidence.toFixed(1)}%</p>
      <p>${recommendation.reason}</p>`;
  }

  // Update prediction display DOM
  const predictionEl = document.getElementById('prediction-display');
  if (predictionEl) {
    predictionEl.innerHTML = `<h2>🔮 Price Prediction</h2>
      <p><strong>${prediction.emoji} ${prediction.direction}</strong></p>
      <p>Confidence: ${prediction.confidence.toFixed(1)}%</p>`;
  }

  // Update or render chart
  if (chartInstance) {
    updateChart(chartInstance, prices, maValues);
  } else {
    chartInstance = renderChart('priceChart', prices, maValues);
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
  renderHome();
  renderUtilities();
  renderCalculator();
  renderReminders();
}

/**
 * Render the Home section with disclaimer card and summary info.
 * The Home section HTML is already in index.html, so this ensures the date is displayed.
 */
export function renderHome() {
  const dateEl = document.getElementById('current-date');
  if (dateEl && !dateEl.textContent) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
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
export function renderUtilities() {
  // ── Gold & Silver summary (clickable) ──
  const commodities = getCommodityPrices();
  const commodityEl = document.getElementById('commodity-prices');
  if (commodityEl) {
    commodityEl.innerHTML = `<h2>🥇 Gold &amp; Silver Prices</h2>
      <p><strong>Gold (24K):</strong> ₹${commodities.gold.pricePerGram.toLocaleString('en-IN')} / gram</p>
      <p><strong>Silver:</strong> ₹${commodities.silver.pricePerKg.toLocaleString('en-IN')} / kg</p>
      <p class="placeholder-text" style="margin-top:8px;cursor:pointer;color:var(--color-primary);">👆 Tap for karat rates &amp; history</p>`;
    commodityEl.style.cursor = 'pointer';
    commodityEl.addEventListener('click', () => {
      const detail = document.getElementById('gold-detail');
      if (detail) { detail.removeAttribute('hidden'); renderGoldDetail(); }
      commodityEl.setAttribute('hidden', '');
    });
  }

  // Gold detail close button
  const closeBtn = document.getElementById('gold-detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const detail = document.getElementById('gold-detail');
      if (detail) detail.setAttribute('hidden', '');
      if (commodityEl) commodityEl.removeAttribute('hidden');
    });
  }

  // ── Fuel Prices with city selector ──
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

  // ── Rahu Kaal with city selector ──
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

  // ── Muhurat with date picker ──
  const muhuratDate = document.getElementById('muhurat-date-select');
  if (muhuratDate) {
    muhuratDate.value = new Date().toISOString().split('T')[0];
    muhuratDate.addEventListener('change', () => renderMuhuratData(muhuratDate.value));
    renderMuhuratData(muhuratDate.value);
  }
}

/** Gold detail: karat table + history chart */
let goldChartInstance = null;
function renderGoldDetail() {
  const ratesEl = document.getElementById('gold-karat-rates');
  if (ratesEl) {
    const rates = getGoldKaratRates();
    ratesEl.innerHTML = `<table class="karat-table">
      <thead><tr><th>Karat</th><th>₹/gram</th><th>₹/10g</th></tr></thead>
      <tbody>${rates.map(r => `<tr><td>${r.label}</td><td>₹${r.pricePerGram.toLocaleString('en-IN')}</td><td>₹${r.pricePer10Gram.toLocaleString('en-IN')}</td></tr>`).join('')}</tbody>
    </table>`;
  }
  // History chart
  const history = getGoldHistory();
  const canvas = document.getElementById('goldHistoryChart');
  if (canvas && typeof Chart !== 'undefined') {
    if (goldChartInstance) goldChartInstance.destroy();
    goldChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: history.map(h => h.date.slice(5)),
        datasets: [{
          label: 'Gold 24K (₹/g)',
          data: history.map(h => h.price),
          borderColor: '#f1c40f',
          backgroundColor: 'rgba(241,196,15,0.1)',
          tension: 0.3, fill: true
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }
}

function renderFuelData(city) {
  const el = document.getElementById('fuel-data');
  if (!el) return;
  const fuel = getFuelPrices(city);
  el.innerHTML = `<p><strong>Petrol:</strong> ₹${fuel.petrol.toFixed(2)} / litre</p>
    <p><strong>Diesel:</strong> ₹${fuel.diesel.toFixed(2)} / litre</p>`;
}

function renderRahuData(city) {
  const el = document.getElementById('rahu-data');
  if (!el) return;
  const rk = getRahuKaal(new Date(), city);
  el.innerHTML = `<p><strong>Start:</strong> ${rk.start}</p><p><strong>End:</strong> ${rk.end}</p>`;
}

function renderMuhuratData(dateStr) {
  const el = document.getElementById('muhurat-data');
  if (!el) return;
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const m = getMuhurat(d);
  el.innerHTML = `<p><strong>Day:</strong> ${m.dayName}</p>
    <p><strong>Start:</strong> ${m.start}</p><p><strong>End:</strong> ${m.end}</p>`;
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
