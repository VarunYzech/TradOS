/**
 * Chart Module - Wraps Chart.js to render and update the stock price chart.
 *
 * Uses the global Chart constructor (loaded from CDN in the browser).
 * For testing, Chart can be mocked on globalThis/window.
 */

const MAX_POINTS = 50;
const MIN_POINTS = 2;

/**
 * Slice prices and maValues to the most recent data points (between MIN_POINTS and MAX_POINTS).
 * @param {number[]} prices
 * @param {number[]} maValues
 * @returns {{ slicedPrices: number[], slicedMA: number[], labels: string[] }}
 */
function prepareData(prices, maValues) {
  const count = Math.min(prices.length, MAX_POINTS);
  const slicedPrices = prices.slice(-count);
  const slicedMA = maValues.slice(-count);
  const labels = slicedPrices.map((_, i) => String(i + 1));
  return { slicedPrices, slicedMA, labels };
}

/**
 * Initialize or update the line chart with price data and MA line.
 * Uses bezier interpolation for smooth curves.
 * @param {string} canvasId - the id of the <canvas> element
 * @param {number[]} prices - array of closing prices
 * @param {number[]} maValues - moving average values array
 * @returns {object|null} The Chart.js instance, or null if insufficient data.
 */
function renderChart(canvasId, prices, maValues) {
  if (!prices || prices.length < MIN_POINTS) {
    showInsufficientDataMessage(canvasId);
    return null;
  }

  const { slicedPrices, slicedMA, labels } = prepareData(prices, maValues || []);

  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    return null;
  }

  const ctx = canvas.getContext('2d');

  const ChartConstructor = (typeof Chart !== 'undefined') ? Chart
    : (typeof window !== 'undefined' && window.Chart) ? window.Chart
    : null;

  if (!ChartConstructor) {
    return null;
  }

  const chartInstance = new ChartConstructor(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Price',
          data: slicedPrices,
          borderColor: 'blue',
          tension: 0.4,
          fill: false
        },
        {
          label: 'Moving Average',
          data: slicedMA,
          borderColor: 'orange',
          tension: 0.4,
          fill: false
        }
      ]
    },
    options: {
      responsive: true
    }
  });

  return chartInstance;
}

/**
 * Update an existing chart with new data without destroying/recreating.
 * @param {object} chart - existing Chart.js instance
 * @param {number[]} prices - new closing prices
 * @param {number[]} maValues - new MA values
 */
function updateChart(chart, prices, maValues) {
  if (!chart || !prices || prices.length < MIN_POINTS) {
    return;
  }

  const { slicedPrices, slicedMA, labels } = prepareData(prices, maValues || []);

  chart.data.labels = labels;
  chart.data.datasets[0].data = slicedPrices;
  chart.data.datasets[1].data = slicedMA;
  chart.update();
}

/**
 * Destroy the chart instance (cleanup).
 * @param {object} chart - Chart.js instance
 */
function destroyChart(chart) {
  if (chart && typeof chart.destroy === 'function') {
    chart.destroy();
  }
}

/**
 * Show an "Insufficient data" message in the canvas container.
 * @param {string} canvasId
 */
function showInsufficientDataMessage(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const container = canvas.parentElement;
  if (!container) return;

  const msg = document.createElement('p');
  msg.textContent = 'Insufficient data for chart';
  msg.className = 'chart-insufficient-data';
  container.appendChild(msg);
}

export { renderChart, updateChart, destroyChart, prepareData, MAX_POINTS, MIN_POINTS };
