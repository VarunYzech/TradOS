import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initApp,
  renderHome,
  renderStocks,
  renderCalculator,
  renderUtilities,
  renderReminders,
  setAppConfig,
  getAppConfig,
  showToast
} from '../../js/app.js';

/**
 * Helper: create a minimal DOM matching index.html structure for app rendering tests.
 */
function createDOM() {
  document.body.innerHTML = `
    <header>
      <span id="current-date"></span>
    </header>
    <div id="toast-container"></div>
    <div id="loading-spinner" hidden></div>
    <section id="section-home" class="section active">
      <div class="hero-card"><div id="home-gold-price">--</div><div id="home-silver-price">--</div><div id="home-stock-symbol">--</div></div>
      <div class="feature-grid"><div class="feature-card" data-nav="section-stocks">Stocks</div><div class="feature-card" data-nav="section-utilities">Utilities</div></div>
      <div class="card disclaimer-card"><p>Disclaimer</p></div>
    </section>
    <section id="section-stocks" class="section" hidden>
      <div id="analysis-results"><h2>Analysis Results</h2><p class="placeholder-text">Placeholder</p></div>
      <div id="decision-display"><h2>Trading Decision</h2><p class="placeholder-text">Placeholder</p></div>
      <div id="prediction-display"><h2>Price Prediction</h2><p class="placeholder-text">Placeholder</p></div>
    </section>
    <section id="section-calculator" class="section" hidden>
      <form class="calc-form">
        <input type="number" id="calc-buy-price" />
        <input type="number" id="calc-target" />
        <input type="number" id="calc-stop-loss" />
        <input type="number" id="calc-capital" />
        <input type="number" id="calc-quantity" />
      </form>
      <div id="calc-results"><h2>Results</h2><p class="placeholder-text">Enter trade details.</p></div>
    </section>
    <section id="section-utilities" class="section" hidden>
      <div id="commodity-prices" class="card card-clickable"><h2>Gold &amp; Silver Prices</h2><p class="placeholder-text">Loading...</p></div>
      <div id="gold-detail" class="card" hidden>
        <div class="gold-detail-header"><h2>Gold Detail</h2><button id="gold-detail-close">Close</button></div>
        <div class="karat-tabs" id="karat-tabs"></div>
        <div id="gold-karat-rates"></div>
        <div class="gold-chart-section"><h3>History</h3><div class="metal-interval-tabs" id="gold-interval-tabs"></div><div id="gold-chart-status"></div><div class="chart-container"><canvas id="goldHistoryChart"></canvas></div></div>
      </div>
      <div id="silver-detail" class="card" hidden>
        <div class="gold-detail-header"><h2>Silver Detail</h2><button id="silver-detail-close">Close</button></div>
        <div id="silver-price-info"></div>
        <div class="gold-chart-section"><div class="metal-interval-tabs" id="silver-interval-tabs"></div><div id="silver-chart-status"></div><div class="chart-container"><canvas id="silverHistoryChart"></canvas></div></div>
      </div>
      <div id="fuel-prices" class="card"><h2>Fuel Prices</h2>
        <select id="fuel-city-select"></select>
        <div id="fuel-data"><p class="placeholder-text">Loading...</p></div>
      </div>
      <div id="rahu-kaal" class="card"><h2>Rahu Kaal</h2>
        <select id="rahu-city-select"></select>
        <div id="rahu-data"><p class="placeholder-text">Loading...</p></div>
      </div>
      <div id="muhurat" class="card"><h2>Muhurat</h2>
        <select id="muhurat-city-select"></select>
        <div id="muhurat-calendar" class="mini-calendar"></div>
        <div id="muhurat-data"><p class="placeholder-text">Loading...</p></div>
      </div>
    </section>
    <section id="section-reminders" class="section" hidden>
      <div class="card">
        <form class="reminder-form" onsubmit="return false;">
          <input type="text" id="reminder-title" />
          <input type="datetime-local" id="reminder-datetime" />
          <button type="button" id="reminder-add-btn">Add Reminder</button>
        </form>
      </div>
      <div class="card">
        <div id="reminder-list">
          <p class="placeholder-text">No reminders yet. Add one above.</p>
        </div>
      </div>
    </section>
    <nav>
      <button class="nav-tab active" data-section="section-home">Home</button>
      <button class="nav-tab" data-section="section-stocks">Stocks</button>
      <button class="nav-tab" data-section="section-calculator">Calculator</button>
      <button class="nav-tab" data-section="section-utilities">Utilities</button>
      <button class="nav-tab" data-section="section-reminders">Reminders</button>
    </nav>
  `;
}

describe('initApp', () => {
  beforeEach(() => {
    createDOM();
    setAppConfig(null);
  });

  it('should set app config from loaded config', async () => {
    // Mock loadConfig to return a config object
    const mockConfig = { apiKey: 'test-key', symbol: 'TCS.NSE', interval: '5min', maWindow: 10, volatilityThreshold: 3.0, refreshInterval: 30000 };
    const apiModule = await import('../../js/api.js');
    const spy = vi.spyOn(apiModule, 'loadConfig').mockResolvedValue(mockConfig);

    await initApp();

    expect(getAppConfig()).toEqual(mockConfig);
    spy.mockRestore();
  });

  it('should use fallback config and show error toast when loadConfig fails', async () => {
    const apiModule = await import('../../js/api.js');
    const spy = vi.spyOn(apiModule, 'loadConfig').mockResolvedValue(null);

    await initApp();

    const config = getAppConfig();
    expect(config).toBeTruthy();
    expect(config.symbol).toBe('RELIANCE.NSE');
    expect(config.interval).toBe('1min');
    expect(config.maWindow).toBe(5);

    // Should have shown an error toast
    const toasts = document.querySelectorAll('.toast.error');
    expect(toasts.length).toBeGreaterThanOrEqual(1);

    spy.mockRestore();
  });

  it('should set the current date in the header', async () => {
    const apiModule = await import('../../js/api.js');
    const spy = vi.spyOn(apiModule, 'loadConfig').mockResolvedValue({ apiKey: 'k', symbol: 'X', interval: '1min', maWindow: 5, volatilityThreshold: 2, refreshInterval: 60000 });

    await initApp();

    const dateEl = document.getElementById('current-date');
    expect(dateEl.textContent).not.toBe('');

    spy.mockRestore();
  });
});

describe('renderHome', () => {
  let originalFetch;

  beforeEach(() => {
    createDOM();
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('XAU')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ price: 433000, updatedAt: '2026-04-07T10:00:00Z' }) });
      if (url.includes('XAG')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ price: 6600, updatedAt: '2026-04-07T10:00:00Z' }) });
      return Promise.reject(new Error('Unknown'));
    });
  });

  afterEach(() => { globalThis.fetch = originalFetch; });

  it('should set the date if not already set', async () => {
    const dateEl = document.getElementById('current-date');
    dateEl.textContent = '';
    await renderHome();
    expect(dateEl.textContent).not.toBe('');
  });

  it('should populate hero stats with live prices', async () => {
    await renderHome();
    const goldEl = document.getElementById('home-gold-price');
    expect(goldEl.textContent).not.toBe('--');
    expect(goldEl.textContent).toContain('₹');
  });
});

describe('renderStocks', () => {
  beforeEach(() => {
    createDOM();
    setAppConfig({ maWindow: 5 });
  });

  it('should render analysis, decision, and prediction when data is provided', () => {
    const data = {
      analysis: {
        movingAverage: 2500.5,
        momentum: 0.75,
        volatility: { value: 1.5, classification: 'Low' },
        signalScore: { score: 5, components: {} }
      },
      recommendation: {
        action: 'STRONG BUY',
        confidence: 83.3,
        reason: 'Strong signals detected',
        emoji: '🟢'
      },
      prediction: {
        direction: 'UP',
        confidence: 75.0,
        emoji: '⬆️'
      }
    };

    renderStocks(data);

    const analysisEl = document.getElementById('analysis-results');
    expect(analysisEl.innerHTML).toContain('2500.50');
    expect(analysisEl.innerHTML).toContain('75.0%');
    expect(analysisEl.innerHTML).toContain('1.50%');
    expect(analysisEl.innerHTML).toContain('5 / 6');

    const decisionEl = document.getElementById('decision-display');
    expect(decisionEl.innerHTML).toContain('STRONG BUY');
    expect(decisionEl.innerHTML).toContain('🟢');

    const predictionEl = document.getElementById('prediction-display');
    expect(predictionEl.innerHTML).toContain('UP');
    expect(predictionEl.innerHTML).toContain('⬆️');
  });

  it('should handle N/A values for null analysis fields', () => {
    const data = {
      analysis: {
        movingAverage: null,
        momentum: null,
        volatility: null,
        signalScore: { score: 0, components: {} }
      },
      recommendation: {
        action: 'WAIT / SELL',
        confidence: 0,
        reason: 'Insufficient data',
        emoji: '🔴'
      },
      prediction: {
        direction: 'DOWN',
        confidence: 50.0,
        emoji: '⬇️'
      }
    };

    renderStocks(data);

    const analysisEl = document.getElementById('analysis-results');
    expect(analysisEl.innerHTML).toContain('N/A');
  });
});

describe('renderCalculator', () => {
  beforeEach(() => createDOM());

  it('should wire input event listeners for live recalculation', () => {
    renderCalculator();

    const buyPriceEl = document.getElementById('calc-buy-price');
    const targetEl = document.getElementById('calc-target');
    const stopLossEl = document.getElementById('calc-stop-loss');
    const capitalEl = document.getElementById('calc-capital');

    // Set valid values
    buyPriceEl.value = '100';
    targetEl.value = '120';
    stopLossEl.value = '90';
    capitalEl.value = '10000';

    // Trigger input event
    buyPriceEl.dispatchEvent(new Event('input'));

    const resultsEl = document.getElementById('calc-results');
    expect(resultsEl.innerHTML).toContain('Quantity');
    expect(resultsEl.innerHTML).toContain('Profit');
    expect(resultsEl.innerHTML).toContain('Loss');
    expect(resultsEl.innerHTML).toContain('Risk');
  });

  it('should show validation errors for invalid inputs', () => {
    renderCalculator();

    const buyPriceEl = document.getElementById('calc-buy-price');
    const targetEl = document.getElementById('calc-target');
    const stopLossEl = document.getElementById('calc-stop-loss');
    const capitalEl = document.getElementById('calc-capital');

    // Target <= buy price (invalid)
    buyPriceEl.value = '100';
    targetEl.value = '90';
    stopLossEl.value = '110';
    capitalEl.value = '10000';

    buyPriceEl.dispatchEvent(new Event('input'));

    const resultsEl = document.getElementById('calc-results');
    expect(resultsEl.innerHTML).toContain('⚠️');
  });

  it('should auto-calculate quantity from capital', () => {
    renderCalculator();

    const buyPriceEl = document.getElementById('calc-buy-price');
    const targetEl = document.getElementById('calc-target');
    const stopLossEl = document.getElementById('calc-stop-loss');
    const capitalEl = document.getElementById('calc-capital');
    const quantityEl = document.getElementById('calc-quantity');

    buyPriceEl.value = '250';
    targetEl.value = '300';
    stopLossEl.value = '230';
    capitalEl.value = '10000';
    quantityEl.value = '';

    capitalEl.dispatchEvent(new Event('input'));

    // Should auto-calculate: floor(10000/250) = 40
    expect(quantityEl.value).toBe('40');
  });

  it('should show placeholder when buy price is empty', () => {
    renderCalculator();

    const buyPriceEl = document.getElementById('calc-buy-price');
    buyPriceEl.value = '';
    buyPriceEl.dispatchEvent(new Event('input'));

    const resultsEl = document.getElementById('calc-results');
    expect(resultsEl.innerHTML).toContain('Enter trade details');
  });

  it('should display risk assessment with color-coded indicator', () => {
    renderCalculator();

    const buyPriceEl = document.getElementById('calc-buy-price');
    const targetEl = document.getElementById('calc-target');
    const stopLossEl = document.getElementById('calc-stop-loss');
    const capitalEl = document.getElementById('calc-capital');

    buyPriceEl.value = '100';
    targetEl.value = '120';
    stopLossEl.value = '90';
    capitalEl.value = '10000';

    buyPriceEl.dispatchEvent(new Event('input'));

    const resultsEl = document.getElementById('calc-results');
    expect(resultsEl.innerHTML).toContain('Risk Level');
    expect(resultsEl.innerHTML).toContain('Max Loss');
    expect(resultsEl.innerHTML).toContain('Safe Capital');
  });
});

describe('renderUtilities', () => {
  let originalFetch;

  beforeEach(() => {
    createDOM();
    originalFetch = globalThis.fetch;
    // Mock gold-api.com + sunrise-sunset.org responses
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('gold-api.com') && url.includes('XAU')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ price: 433000, updatedAt: '2026-04-07T10:00:00Z' }) });
      }
      if (url.includes('gold-api.com') && url.includes('XAG')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ price: 6600, updatedAt: '2026-04-07T10:00:00Z' }) });
      }
      if (url.includes('sunrise-sunset.org')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          status: 'OK',
          results: { sunrise: '2026-04-07T00:56:00+00:00', sunset: '2026-04-07T13:24:00+00:00' }
        })});
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should display live gold and silver prices', async () => {
    await renderUtilities();

    const el = document.getElementById('commodity-prices');
    expect(el.innerHTML).toContain('Gold');
    expect(el.innerHTML).toContain('/g');
    expect(el.innerHTML).toContain('Silver');
    expect(el.innerHTML).toContain('/kg');
    expect(el.innerHTML).toContain('LIVE');
  });

  it('should display petrol and diesel prices with city selector', async () => {
    await renderUtilities();

    const fuelData = document.getElementById('fuel-data');
    expect(fuelData.innerHTML).toContain('Petrol');
    expect(fuelData.innerHTML).toContain('/L');
    expect(fuelData.innerHTML).toContain('Diesel');
  });

  it('should populate fuel city selector', async () => {
    await renderUtilities();
    const select = document.getElementById('fuel-city-select');
    expect(select.options.length).toBeGreaterThan(1);
  });

  it('should display Rahu Kaal with live sunrise data', async () => {
    await renderUtilities();
    // Wait for async Rahu Kaal render to complete
    await new Promise(r => setTimeout(r, 50));

    const el = document.getElementById('rahu-data');
    expect(el.innerHTML).toContain('Start');
    expect(el.innerHTML).toContain('End');
    expect(el.innerHTML).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
    expect(el.innerHTML).toContain('sunrise/sunset');
  });

  it('should display Muhurat with live sunrise data', async () => {
    await renderUtilities();
    await new Promise(r => setTimeout(r, 50));

    const el = document.getElementById('muhurat-data');
    expect(el.innerHTML).toContain('Start');
    expect(el.innerHTML).toContain('End');
    expect(el.innerHTML).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
  });

  it('should handle missing DOM elements gracefully', async () => {
    document.body.innerHTML = '';
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('no'));
    await expect(renderUtilities()).resolves.not.toThrow();
  });
});


describe('renderReminders', () => {
  beforeEach(() => {
    createDOM();
    localStorage.clear();
  });

  it('should show placeholder when no reminders exist', () => {
    renderReminders();

    const listEl = document.getElementById('reminder-list');
    expect(listEl.innerHTML).toContain('No reminders yet');
  });

  it('should create a reminder when add button is clicked with valid inputs', () => {
    renderReminders();

    const titleInput = document.getElementById('reminder-title');
    const datetimeInput = document.getElementById('reminder-datetime');
    const addBtn = document.getElementById('reminder-add-btn');

    titleInput.value = 'Check RELIANCE';
    datetimeInput.value = '2025-01-15T09:00';

    addBtn.click();

    const listEl = document.getElementById('reminder-list');
    expect(listEl.innerHTML).toContain('Check RELIANCE');
    expect(listEl.querySelector('.reminder-item')).not.toBeNull();

    // Should show success toast
    const toasts = document.querySelectorAll('.toast.success');
    expect(toasts.length).toBeGreaterThanOrEqual(1);
  });

  it('should show error toast when title or datetime is empty', () => {
    renderReminders();

    const titleInput = document.getElementById('reminder-title');
    const addBtn = document.getElementById('reminder-add-btn');

    titleInput.value = '';
    addBtn.click();

    const toasts = document.querySelectorAll('.toast.error');
    expect(toasts.length).toBeGreaterThanOrEqual(1);
  });

  it('should clear inputs after adding a reminder', () => {
    renderReminders();

    const titleInput = document.getElementById('reminder-title');
    const datetimeInput = document.getElementById('reminder-datetime');
    const addBtn = document.getElementById('reminder-add-btn');

    titleInput.value = 'Test Reminder';
    datetimeInput.value = '2025-06-01T10:00';

    addBtn.click();

    expect(titleInput.value).toBe('');
    expect(datetimeInput.value).toBe('');
  });

  it('should delete a reminder when delete button is clicked', () => {
    renderReminders();

    // Add a reminder first
    const titleInput = document.getElementById('reminder-title');
    const datetimeInput = document.getElementById('reminder-datetime');
    const addBtn = document.getElementById('reminder-add-btn');

    titleInput.value = 'To Delete';
    datetimeInput.value = '2025-03-01T08:00';
    addBtn.click();

    const listEl = document.getElementById('reminder-list');
    expect(listEl.querySelector('.reminder-item')).not.toBeNull();

    // Click delete
    const deleteBtn = listEl.querySelector('.reminder-delete-btn');
    deleteBtn.click();

    // Should show placeholder again
    expect(listEl.innerHTML).toContain('No reminders yet');
  });

  it('should render reminder items with correct CSS classes', () => {
    renderReminders();

    const titleInput = document.getElementById('reminder-title');
    const datetimeInput = document.getElementById('reminder-datetime');
    const addBtn = document.getElementById('reminder-add-btn');

    titleInput.value = 'CSS Test';
    datetimeInput.value = '2025-04-01T12:00';
    addBtn.click();

    const listEl = document.getElementById('reminder-list');
    expect(listEl.querySelector('.reminder-item')).not.toBeNull();
    expect(listEl.querySelector('.reminder-info')).not.toBeNull();
    expect(listEl.querySelector('.reminder-title')).not.toBeNull();
    expect(listEl.querySelector('.reminder-datetime')).not.toBeNull();
    expect(listEl.querySelector('.reminder-delete-btn')).not.toBeNull();
  });

  it('should show info toast when localStorage is unavailable', () => {
    // Make localStorage throw to simulate unavailability
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = () => { throw new Error('localStorage disabled'); };
    Storage.prototype.removeItem = () => { throw new Error('localStorage disabled'); };

    renderReminders();

    const toasts = document.querySelectorAll('.toast.info');
    expect(toasts.length).toBeGreaterThanOrEqual(1);

    Storage.prototype.setItem = originalSetItem;
    Storage.prototype.removeItem = originalRemoveItem;
  });

  it('should display multiple reminders sorted by dateTime', () => {
    renderReminders();

    const titleInput = document.getElementById('reminder-title');
    const datetimeInput = document.getElementById('reminder-datetime');
    const addBtn = document.getElementById('reminder-add-btn');

    // Add second reminder (later date)
    titleInput.value = 'Later Reminder';
    datetimeInput.value = '2025-12-01T10:00';
    addBtn.click();

    // Add first reminder (earlier date)
    titleInput.value = 'Earlier Reminder';
    datetimeInput.value = '2025-01-01T10:00';
    addBtn.click();

    const listEl = document.getElementById('reminder-list');
    const items = listEl.querySelectorAll('.reminder-item');
    expect(items.length).toBe(2);

    // First item should be the earlier one (sorted by dateTime ascending)
    const titles = listEl.querySelectorAll('.reminder-title');
    expect(titles[0].textContent).toBe('Earlier Reminder');
    expect(titles[1].textContent).toBe('Later Reminder');
  });

  it('should handle missing DOM elements gracefully', () => {
    document.body.innerHTML = '<div id="toast-container"></div>';
    expect(() => renderReminders()).not.toThrow();
  });
});
