/**
 * Chart Module - Wraps Chart.js to render and update the stock price chart.
 */

const MAX_POINTS = 50;
const MIN_POINTS = 2;

function prepareData(prices, maValues, interval) {
  const count = Math.min(prices.length, MAX_POINTS);
  const slicedPrices = prices.slice(-count);
  const slicedMA = maValues.slice(-count);

  const iv = interval || '1min';
  const now = new Date();
  let labels;

  if (iv === '1day' || iv === '1week' || iv === '1month') {
    // Date-based labels
    const msPerUnit = iv === '1day' ? 86400000 : iv === '1week' ? 604800000 : 2592000000;
    labels = slicedPrices.map((_, i) => {
      const t = new Date(now.getTime() - (count - 1 - i) * msPerUnit);
      return t.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    });
  } else {
    // Time-based labels
    const minMap = { '1min': 1, '5min': 5, '15min': 15, '1h': 60 };
    const mins = minMap[iv] || 1;
    labels = slicedPrices.map((_, i) => {
      const t = new Date(now.getTime() - (count - 1 - i) * mins * 60000);
      return t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    });
  }

  return { slicedPrices, slicedMA, labels };
}

// Store current interval and currency for chart rendering
let currentInterval = '1min';
let currentChartCurrency = 'USD';
function setChartInterval(iv) { currentInterval = iv; }
function setChartCurrency(c) { currentChartCurrency = c; }

function renderChart(canvasId, prices, maValues) {
  if (!prices || prices.length < MIN_POINTS) {
    showInsufficientDataMessage(canvasId);
    return null;
  }

  const { slicedPrices, slicedMA, labels } = prepareData(prices, maValues || [], currentInterval);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const isDaily = ['1day', '1week', '1month'].includes(currentInterval);
  const xTitle = isDaily ? 'Date' : 'Time (HH:MM)';

  const ctx = canvas.getContext('2d');
  const ChartConstructor = (typeof Chart !== 'undefined') ? Chart
    : (typeof window !== 'undefined' && window.Chart) ? window.Chart : null;
  if (!ChartConstructor) return null;

  const currSym = currentChartCurrency === 'INR' ? '₹' : '$';
  const currLabel = `Price (${currentChartCurrency})`;

  const chartInstance = new ChartConstructor(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: currLabel,
          data: slicedPrices,
          borderColor: '#4f8cff',
          backgroundColor: 'rgba(79,140,255,0.08)',
          tension: 0.3,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 2,
        },
        {
          label: 'Moving Avg',
          data: slicedMA,
          borderColor: '#f1c40f',
          backgroundColor: 'transparent',
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 3],
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: '#8b8fa3', usePointStyle: true, pointStyle: 'line', padding: 16, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: '#1a1d27',
          titleColor: '#e4e6ed',
          bodyColor: '#e4e6ed',
          borderColor: '#2e3240',
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          callbacks: {
            label: function(c) {
              return `${c.dataset.label}: ${currSym}${c.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: xTitle, color: '#8b8fa3', font: { size: 11 } },
          ticks: { color: '#8b8fa3', maxRotation: 45, autoSkip: true, maxTicksLimit: 12, font: { size: 10 } },
          grid: { color: '#2e324020' }
        },
        y: {
          title: { display: true, text: currLabel, color: '#8b8fa3', font: { size: 11 } },
          ticks: { color: '#8b8fa3', font: { size: 10 } },
          grid: { color: '#2e324040' }
        }
      }
    }
  });

  return chartInstance;
}

function updateChart(chart, prices, maValues) {
  if (!chart || !prices || prices.length < MIN_POINTS) return;
  const { slicedPrices, slicedMA, labels } = prepareData(prices, maValues || [], currentInterval);
  chart.data.labels = labels;
  chart.data.datasets[0].data = slicedPrices;
  chart.data.datasets[1].data = slicedMA;
  chart.update();
}

function destroyChart(chart) {
  if (chart && typeof chart.destroy === 'function') chart.destroy();
}

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

export { renderChart, updateChart, destroyChart, prepareData, setChartInterval, setChartCurrency, MAX_POINTS, MIN_POINTS };
