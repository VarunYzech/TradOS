import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { refreshStockData, startAutoRefresh, stopAutoRefresh, setAppConfig, _resetChartInstance } from '../../js/app.js';

// Mock the imported modules
vi.mock('../../js/api.js', () => ({
  fetchStockData: vi.fn(),
  getStockCurrency: vi.fn(() => 'USD')
}));
vi.mock('../../js/analysis.js', () => ({
  computeAll: vi.fn(),
  getRecommendation: vi.fn(),
  predictDirection: vi.fn()
}));
vi.mock('../../js/chart.js', () => ({
  renderChart: vi.fn(),
  updateChart: vi.fn(),
  setChartCurrency: vi.fn(),
  setChartInterval: vi.fn()
}));

import { fetchStockData } from '../../js/api.js';
import { computeAll, getRecommendation, predictDirection } from '../../js/analysis.js';
import { renderChart, updateChart } from '../../js/chart.js';

function createStocksDOM() {
  document.body.innerHTML = `
    <div id="toast-container"></div>
    <div id="analysis-results"><h2>📊 Analysis Results</h2><p class="placeholder-text">Placeholder</p></div>
    <div id="decision-display"><h2>🎯 Trading Decision</h2><p class="placeholder-text">Placeholder</p></div>
    <div id="prediction-display"><h2>🔮 Price Prediction</h2><p class="placeholder-text">Placeholder</p></div>
    <canvas id="priceChart"></canvas>
  `;
}

describe('refreshStockData', () => {
  beforeEach(() => {
    createStocksDOM();
    vi.clearAllMocks();
    setAppConfig(null);
    _resetChartInstance();
  });

  it('shows API key missing message when no apiKey is configured', async () => {
    setAppConfig({ symbol: 'TEST.NSE', interval: '1min' });
    await refreshStockData();

    const el = document.getElementById('analysis-results');
    expect(el.innerHTML).toContain('API key is missing');
    expect(fetchStockData).not.toHaveBeenCalled();
  });

  it('shows API key missing message when apiKey is placeholder', async () => {
    setAppConfig({ apiKey: 'YOUR_API_KEY_HERE' });
    await refreshStockData();

    const el = document.getElementById('analysis-results');
    expect(el.innerHTML).toContain('API key is missing');
  });

  it('calls fetchStockData with config values when apiKey is present', async () => {
    setAppConfig({ apiKey: 'real-key', symbol: 'TCS.NSE', interval: '5min', maWindow: 5, volatilityThreshold: 2.0 });
    fetchStockData.mockResolvedValue(null);

    await refreshStockData();

    expect(fetchStockData).toHaveBeenCalledWith('TCS.NSE', '5min', 'real-key');
  });

  it('returns early if fetchStockData returns null', async () => {
    setAppConfig({ apiKey: 'real-key' });
    fetchStockData.mockResolvedValue(null);

    await refreshStockData();

    expect(computeAll).not.toHaveBeenCalled();
  });

  it('returns early if fetchStockData returns empty array', async () => {
    setAppConfig({ apiKey: 'real-key' });
    fetchStockData.mockResolvedValue([]);

    await refreshStockData();

    expect(computeAll).not.toHaveBeenCalled();
  });

  it('runs full pipeline and updates DOM when data is returned', async () => {
    const prices = [100, 101, 102, 103, 104, 105];
    setAppConfig({ apiKey: 'real-key', symbol: 'RELIANCE.NSE', interval: '1min', maWindow: 3, volatilityThreshold: 2.0 });
    fetchStockData.mockResolvedValue(prices);
    computeAll.mockReturnValue({
      movingAverage: 104,
      momentum: 0.8,
      volatility: { value: 1.5, classification: 'Low' },
      signalScore: { score: 5, components: {} }
    });
    getRecommendation.mockReturnValue({
      action: 'STRONG BUY', confidence: 83.3, reason: 'Strong signals', emoji: '🟢'
    });
    predictDirection.mockReturnValue({
      direction: 'UP', confidence: 80, emoji: '⬆️'
    });
    renderChart.mockReturnValue({ fake: 'chart' });

    await refreshStockData();

    // Verify analysis pipeline was called
    expect(computeAll).toHaveBeenCalledWith(prices, { maWindow: 3, volThreshold: 2.0 });
    expect(getRecommendation).toHaveBeenCalledWith(5);
    expect(predictDirection).toHaveBeenCalledWith(true, 0.8);

    // Verify DOM updates
    const analysisEl = document.getElementById('analysis-results');
    expect(analysisEl.innerHTML).toContain('104.00');
    expect(analysisEl.innerHTML).toContain('80.0%');
    expect(analysisEl.innerHTML).toContain('5 / 6');

    const decisionEl = document.getElementById('decision-display');
    expect(decisionEl.innerHTML).toContain('STRONG BUY');
    expect(decisionEl.innerHTML).toContain('83.3%');

    const predictionEl = document.getElementById('prediction-display');
    expect(predictionEl.innerHTML).toContain('UP');
    expect(predictionEl.innerHTML).toContain('80.0%');

    // Chart rendered
    expect(renderChart).toHaveBeenCalledWith('priceChart', prices, expect.any(Array));

    // Toast shown
    const toast = document.querySelector('.toast.success');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe('Stock data updated');
  });

  it('uses updateChart on second call instead of renderChart', async () => {
    const prices = [100, 101, 102, 103, 104, 105];
    setAppConfig({ apiKey: 'real-key', maWindow: 3, volatilityThreshold: 2.0 });
    fetchStockData.mockResolvedValue(prices);
    computeAll.mockReturnValue({
      movingAverage: 104, momentum: 0.8,
      volatility: { value: 1.5, classification: 'Low' },
      signalScore: { score: 5, components: {} }
    });
    getRecommendation.mockReturnValue({ action: 'STRONG BUY', confidence: 83.3, reason: 'Strong', emoji: '🟢' });
    predictDirection.mockReturnValue({ direction: 'UP', confidence: 80, emoji: '⬆️' });

    const fakeChart = { fake: 'chart' };
    renderChart.mockReturnValue(fakeChart);

    // First call renders chart
    await refreshStockData();
    expect(renderChart).toHaveBeenCalledTimes(1);

    // Second call updates chart
    await refreshStockData();
    expect(updateChart).toHaveBeenCalledWith(fakeChart, prices, expect.any(Array));
  });

  it('uses fallback defaults when appConfig is null', async () => {
    setAppConfig(null);
    // appConfig is null, so apiKey is undefined → shows missing message
    await refreshStockData();
    const el = document.getElementById('analysis-results');
    expect(el.innerHTML).toContain('API key is missing');
  });
});

describe('startAutoRefresh / stopAutoRefresh integration', () => {
  beforeEach(() => {
    createStocksDOM();
    vi.useFakeTimers();
    vi.clearAllMocks();
    setAppConfig({ apiKey: 'real-key', maWindow: 5, volatilityThreshold: 2.0 });
    fetchStockData.mockResolvedValue(null);
  });

  afterEach(() => {
    stopAutoRefresh();
    vi.useRealTimers();
  });

  it('startAutoRefresh calls refreshStockData immediately', () => {
    startAutoRefresh();
    // fetchStockData should have been called once (from the immediate refreshStockData call)
    expect(fetchStockData).toHaveBeenCalledTimes(1);
  });

  it('startAutoRefresh sets up 60s interval', async () => {
    startAutoRefresh();
    expect(fetchStockData).toHaveBeenCalledTimes(1);

    // Advance 60 seconds
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchStockData).toHaveBeenCalledTimes(2);
  });

  it('stopAutoRefresh clears the interval', async () => {
    startAutoRefresh();
    expect(fetchStockData).toHaveBeenCalledTimes(1);

    stopAutoRefresh();
    await vi.advanceTimersByTimeAsync(60000);
    // Should still be 1 since interval was cleared
    expect(fetchStockData).toHaveBeenCalledTimes(1);
  });

  it('startAutoRefresh prevents duplicate intervals', () => {
    startAutoRefresh();
    startAutoRefresh();
    expect(fetchStockData).toHaveBeenCalledTimes(1); // Only one immediate call
  });
});
