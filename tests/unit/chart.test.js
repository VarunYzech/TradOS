import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderChart, updateChart, destroyChart, prepareData, MAX_POINTS, MIN_POINTS } from '../../js/chart.js';

describe('Chart Module', () => {
  let mockChartInstance;
  let mockCtx;

  beforeEach(() => {
    document.body.innerHTML = '<div id="chart-container"><canvas id="priceChart"></canvas></div>';

    mockChartInstance = {
      data: {
        labels: [],
        datasets: [{ data: [] }, { data: [] }]
      },
      update: vi.fn(),
      destroy: vi.fn()
    };

    mockCtx = {};
    const canvas = document.getElementById('priceChart');
    canvas.getContext = vi.fn(() => mockCtx);

    globalThis.Chart = vi.fn(() => mockChartInstance);
  });

  describe('prepareData', () => {
    it('slices to last MAX_POINTS when array is larger', () => {
      const prices = Array.from({ length: 60 }, (_, i) => i + 1);
      const ma = Array.from({ length: 60 }, (_, i) => i + 0.5);
      const { slicedPrices, slicedMA, labels } = prepareData(prices, ma);

      expect(slicedPrices).toHaveLength(MAX_POINTS);
      expect(slicedPrices[0]).toBe(11);
      expect(slicedPrices[MAX_POINTS - 1]).toBe(60);
      expect(slicedMA).toHaveLength(MAX_POINTS);
      expect(labels).toHaveLength(MAX_POINTS);
      expect(labels[0]).toBe('1');
      expect(labels[MAX_POINTS - 1]).toBe(String(MAX_POINTS));
    });

    it('keeps all points when array is smaller than MAX_POINTS', () => {
      const prices = [10, 20, 30];
      const ma = [15, 25, 35];
      const { slicedPrices, slicedMA, labels } = prepareData(prices, ma);

      expect(slicedPrices).toEqual([10, 20, 30]);
      expect(slicedMA).toEqual([15, 25, 35]);
      expect(labels).toEqual(['1', '2', '3']);
    });
  });

  describe('renderChart', () => {
    it('returns null and shows message when prices has fewer than 2 points', () => {
      const result = renderChart('priceChart', [100], []);
      expect(result).toBeNull();

      const msg = document.querySelector('.chart-insufficient-data');
      expect(msg).not.toBeNull();
      expect(msg.textContent).toBe('Insufficient data for chart');
    });

    it('returns null when prices is empty', () => {
      const result = renderChart('priceChart', [], []);
      expect(result).toBeNull();
    });

    it('returns null when prices is null/undefined', () => {
      expect(renderChart('priceChart', null, [])).toBeNull();
      expect(renderChart('priceChart', undefined, [])).toBeNull();
    });

    it('returns null when canvas element not found', () => {
      const result = renderChart('nonexistent', [10, 20, 30], [15, 25, 35]);
      expect(result).toBeNull();
    });

    it('creates a Chart.js instance with correct config for valid data', () => {
      const prices = [10, 20, 30, 40, 50];
      const ma = [15, 25, 35, 45, 55];

      const result = renderChart('priceChart', prices, ma);

      expect(result).toBe(mockChartInstance);
      expect(globalThis.Chart).toHaveBeenCalledOnce();

      const callArgs = globalThis.Chart.mock.calls[0];
      expect(callArgs[0]).toBe(mockCtx);

      const config = callArgs[1];
      expect(config.type).toBe('line');
      expect(config.options.responsive).toBe(true);
      expect(config.data.datasets).toHaveLength(2);

      // Price dataset
      expect(config.data.datasets[0].label).toBe('Price');
      expect(config.data.datasets[0].borderColor).toBe('blue');
      expect(config.data.datasets[0].tension).toBe(0.4);
      expect(config.data.datasets[0].data).toEqual(prices);

      // MA dataset
      expect(config.data.datasets[1].label).toBe('Moving Average');
      expect(config.data.datasets[1].borderColor).toBe('orange');
      expect(config.data.datasets[1].tension).toBe(0.4);
      expect(config.data.datasets[1].data).toEqual(ma);

      // Labels
      expect(config.data.labels).toEqual(['1', '2', '3', '4', '5']);
    });

    it('slices data to MAX_POINTS when more than 50 prices provided', () => {
      const prices = Array.from({ length: 60 }, (_, i) => i);
      const ma = Array.from({ length: 60 }, (_, i) => i + 0.5);

      renderChart('priceChart', prices, ma);

      const config = globalThis.Chart.mock.calls[0][1];
      expect(config.data.datasets[0].data).toHaveLength(MAX_POINTS);
      expect(config.data.datasets[1].data).toHaveLength(MAX_POINTS);
      expect(config.data.labels).toHaveLength(MAX_POINTS);
    });

    it('handles null maValues gracefully', () => {
      const prices = [10, 20, 30];
      const result = renderChart('priceChart', prices, null);

      expect(result).toBe(mockChartInstance);
      const config = globalThis.Chart.mock.calls[0][1];
      expect(config.data.datasets[1].data).toEqual([]);
    });

    it('works with exactly 2 data points (minimum)', () => {
      const result = renderChart('priceChart', [10, 20], [15, 25]);
      expect(result).toBe(mockChartInstance);
    });
  });

  describe('updateChart', () => {
    it('updates chart data and calls update()', () => {
      const prices = [100, 200, 300];
      const ma = [150, 250, 350];

      updateChart(mockChartInstance, prices, ma);

      expect(mockChartInstance.data.labels).toEqual(['1', '2', '3']);
      expect(mockChartInstance.data.datasets[0].data).toEqual([100, 200, 300]);
      expect(mockChartInstance.data.datasets[1].data).toEqual([150, 250, 350]);
      expect(mockChartInstance.update).toHaveBeenCalledOnce();
    });

    it('does nothing when chart is null', () => {
      updateChart(null, [10, 20], [15, 25]);
      // No error thrown
    });

    it('does nothing when prices has fewer than 2 points', () => {
      updateChart(mockChartInstance, [10], [15]);
      expect(mockChartInstance.update).not.toHaveBeenCalled();
    });

    it('handles null maValues gracefully', () => {
      updateChart(mockChartInstance, [10, 20, 30], null);
      expect(mockChartInstance.data.datasets[1].data).toEqual([]);
      expect(mockChartInstance.update).toHaveBeenCalledOnce();
    });
  });

  describe('destroyChart', () => {
    it('calls destroy() on the chart instance', () => {
      destroyChart(mockChartInstance);
      expect(mockChartInstance.destroy).toHaveBeenCalledOnce();
    });

    it('does nothing when chart is null', () => {
      destroyChart(null);
      // No error thrown
    });

    it('does nothing when chart has no destroy method', () => {
      destroyChart({});
      // No error thrown
    });
  });
});
