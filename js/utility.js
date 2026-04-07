// ── Constants ──

const GOLD_API_BASE = 'https://api.gold-api.com/price';
const SUNRISE_API = 'https://api.sunrise-sunset.org/json';
const TROY_OZ_TO_GRAM = 31.1035;
const TROY_OZ_TO_KG = 0.0311035;

const GOLD_KARATS = [
  { karat: '24K', purity: 0.999, label: '24K (99.9%)' },
  { karat: '22K', purity: 0.916, label: '22K (91.6%)' },
  { karat: '18K', purity: 0.750, label: '18K (75.0%)' },
  { karat: '14K', purity: 0.585, label: '14K (58.5%)' },
];

// City coordinates for sunrise API + fuel prices (IOCL published, Apr 2026)
const CITIES = {
  Mumbai:    { lat: 19.076, lng: 72.878, petrol: 103.44, diesel: 89.97 },
  Delhi:     { lat: 28.614, lng: 77.209, petrol: 94.72,  diesel: 87.62 },
  Bangalore: { lat: 12.972, lng: 77.595, petrol: 101.94, diesel: 87.89 },
  Chennai:   { lat: 13.083, lng: 80.270, petrol: 100.76, diesel: 92.38 },
  Kolkata:   { lat: 22.573, lng: 88.364, petrol: 104.95, diesel: 91.76 },
  Hyderabad: { lat: 17.385, lng: 78.487, petrol: 107.41, diesel: 95.65 },
  Pune:      { lat: 18.520, lng: 73.857, petrol: 104.36, diesel: 90.23 },
  Ahmedabad: { lat: 23.023, lng: 72.571, petrol: 94.38,  diesel: 90.08 },
  Jaipur:    { lat: 26.912, lng: 75.787, petrol: 104.88, diesel: 90.36 },
  Lucknow:   { lat: 26.847, lng: 80.947, petrol: 94.65,  diesel: 87.70 },
};

// ── Cache ──
let cachedGoldPerGram = null;
let cachedSilverPerKg = null;
let cachedUpdatedAt = null;
const sunriseCache = {}; // key: "city_YYYY-MM-DD" -> { sunrise, sunset } in minutes from midnight

// ── Helpers ──

function formatTime12(d) {
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function minutesToDate(baseDate, totalMinutes) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(totalMinutes);
  return d;
}

// ── Live Commodity Prices (gold-api.com — free, no key, CORS) ──

async function fetchLiveCommodityPrices() {
  try {
    const [goldRes, silverRes] = await Promise.all([
      fetch(`${GOLD_API_BASE}/XAU/INR`),
      fetch(`${GOLD_API_BASE}/XAG/INR`)
    ]);
    if (!goldRes.ok || !silverRes.ok) throw new Error('API error');
    const goldData = await goldRes.json();
    const silverData = await silverRes.json();

    cachedGoldPerGram = Math.round(goldData.price / TROY_OZ_TO_GRAM);
    cachedSilverPerKg = Math.round(silverData.price / TROY_OZ_TO_KG);
    cachedUpdatedAt = goldData.updatedAt || new Date().toISOString();

    return {
      gold: { pricePerGram: cachedGoldPerGram, pricePerOz: Math.round(goldData.price) },
      silver: { pricePerKg: cachedSilverPerKg, pricePerOz: Math.round(silverData.price) },
      updatedAt: cachedUpdatedAt,
      live: true
    };
  } catch (e) {
    return {
      gold: { pricePerGram: cachedGoldPerGram || 7250, pricePerOz: 0 },
      silver: { pricePerKg: cachedSilverPerKg || 85000, pricePerOz: 0 },
      updatedAt: cachedUpdatedAt || null,
      live: false
    };
  }
}

function getCommodityPrices() {
  return {
    gold: { pricePerGram: cachedGoldPerGram || 7250 },
    silver: { pricePerKg: cachedSilverPerKg || 85000 }
  };
}

function getGoldKaratRates() {
  const base = cachedGoldPerGram || 7250;
  return GOLD_KARATS.map(k => ({
    ...k,
    pricePerGram: Math.round(base * k.purity),
    pricePer10Gram: Math.round(base * k.purity * 10),
  }));
}

function getGoldKaratList() {
  return GOLD_KARATS.map(k => k.karat);
}

function getGoldHistory() { return []; }

/**
 * Fetch 30-day gold price history from Twelve Data API.
 * Uses XAU/USD and converts to INR using the exchange rate from gold-api.
 * @param {string} apiKey - Twelve Data API key
 * @param {string} [karat='24K'] - karat to scale prices for
 * @returns {{ dates: string[], prices: number[], live: boolean }}
 */
async function fetchGoldHistory(apiKey, karat) {
  const k = GOLD_KARATS.find(x => x.karat === karat) || GOLD_KARATS[0];
  try {
    // Fetch XAU/USD daily for last 30 days
    const res = await fetch(`https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=1day&outputsize=30&apikey=${apiKey}`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    if (data.status === 'error' || !data.values) throw new Error(data.message || 'No data');

    // Get USD/INR rate from gold-api cached data or approximate
    let usdToInr = 85; // fallback
    try {
      const fxRes = await fetch(`${GOLD_API_BASE}/XAU/INR`);
      const fxGold = await fxRes.json();
      const fxResUsd = await fetch(`${GOLD_API_BASE}/XAU`);
      const fxGoldUsd = await fxResUsd.json();
      if (fxGold.price && fxGoldUsd.price) {
        usdToInr = fxGold.price / fxGoldUsd.price;
      }
    } catch (e) { /* use fallback */ }

    // Convert: XAU/USD per oz -> INR per gram for the selected karat
    const values = data.values.slice().reverse(); // oldest first
    const dates = values.map(v => v.datetime.slice(5)); // MM-DD
    const prices = values.map(v => {
      const usdPerOz = parseFloat(v.close);
      const inrPerOz = usdPerOz * usdToInr;
      const inrPerGram = inrPerOz / TROY_OZ_TO_GRAM;
      return Math.round(inrPerGram * k.purity);
    });

    return { dates, prices, live: true, karat: karat };
  } catch (e) {
    return { dates: [], prices: [], live: false, karat: karat };
  }
}

// Metal history interval mapping
const METAL_INTERVALS = [
  { id: '1day', label: '1D', outputsize: 30, desc: '30 Days' },
  { id: '1week', label: '1W', outputsize: 52, desc: '1 Year (Weekly)' },
  { id: '1month', label: '1M', outputsize: 24, desc: '2 Years (Monthly)' },
];

function getMetalIntervals() { return METAL_INTERVALS; }

/**
 * Fetch gold history with configurable interval.
 */
async function fetchGoldHistoryInterval(apiKey, karat, interval) {
  const k = GOLD_KARATS.find(x => x.karat === karat) || GOLD_KARATS[0];
  const iv = METAL_INTERVALS.find(x => x.id === interval) || METAL_INTERVALS[0];
  try {
    const res = await fetch(`https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${iv.id}&outputsize=${iv.outputsize}&apikey=${apiKey}`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    if (data.status === 'error' || !data.values) throw new Error(data.message || 'No data');

    let usdToInr = cachedUsdToInr || 85;
    try {
      const fxRes = await fetch(`${GOLD_API_BASE}/XAU/INR`);
      const fxGold = await fxRes.json();
      const fxResUsd = await fetch(`${GOLD_API_BASE}/XAU`);
      const fxGoldUsd = await fxResUsd.json();
      if (fxGold.price && fxGoldUsd.price) usdToInr = fxGold.price / fxGoldUsd.price;
    } catch (e) {}

    const values = data.values.slice().reverse();
    const dates = values.map(v => v.datetime.slice(5, 10));
    const prices = values.map(v => Math.round((parseFloat(v.close) * usdToInr / TROY_OZ_TO_GRAM) * k.purity));
    return { dates, prices, live: true };
  } catch (e) {
    return { dates: [], prices: [], live: false };
  }
}

/**
 * Fetch silver price history from Twelve Data.
 * Note: XAG/USD requires paid Twelve Data plan.
 * Falls back gracefully.
 */
async function fetchSilverHistory(apiKey, interval) {
  const iv = METAL_INTERVALS.find(x => x.id === interval) || METAL_INTERVALS[0];
  try {
    const res = await fetch(`https://api.twelvedata.com/time_series?symbol=XAG/USD&interval=${iv.id}&outputsize=${iv.outputsize}&apikey=${apiKey}`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    if (data.status === 'error' || !data.values) throw new Error(data.message || 'No data');

    let usdToInr = cachedUsdToInr || 85;

    const values = data.values.slice().reverse();
    const dates = values.map(v => v.datetime.slice(5, 10));
    // XAG/USD is price per troy oz. Convert to INR per kg: price * usdToInr / 0.0311035
    const prices = values.map(v => Math.round(parseFloat(v.close) * usdToInr / TROY_OZ_TO_KG));
    return { dates, prices, live: true };
  } catch (e) {
    // XAG/USD requires paid plan — return not available
    return { dates: [], prices: [], live: false, reason: 'Silver history (XAG/USD) requires Twelve Data Grow plan' };
  }
}

// ── Fuel Prices (IOCL published — no free live API exists for client-side) ──

function getFuelCities() { return Object.keys(CITIES); }

function getFuelPrices(city) {
  const c = city || 'Mumbai';
  const data = CITIES[c] || CITIES['Mumbai'];
  return { petrol: data.petrol, diesel: data.diesel, city: c };
}

// ── Live Sunrise/Sunset (sunrise-sunset.org — free, no key) ──

async function fetchSunriseSunset(city, date) {
  const d = date || new Date();
  const dateStr = d.toISOString().split('T')[0];
  const cacheKey = `${city}_${dateStr}`;

  if (sunriseCache[cacheKey]) return sunriseCache[cacheKey];

  const coords = CITIES[city] || CITIES['Mumbai'];
  try {
    const res = await fetch(`${SUNRISE_API}?lat=${coords.lat}&lng=${coords.lng}&date=${dateStr}&formatted=0`);
    if (!res.ok) throw new Error('Sunrise API error');
    const data = await res.json();
    if (data.status !== 'OK') throw new Error('Bad status');

    // Convert UTC ISO to local minutes from midnight
    const sunriseUTC = new Date(data.results.sunrise);
    const sunsetUTC = new Date(data.results.sunset);

    // Convert to IST (UTC+5:30) manually since we know these are Indian cities
    const IST_OFFSET = 5.5 * 60; // minutes
    const sunriseLocal = sunriseUTC.getUTCHours() * 60 + sunriseUTC.getUTCMinutes() + IST_OFFSET;
    const sunsetLocal = sunsetUTC.getUTCHours() * 60 + sunsetUTC.getUTCMinutes() + IST_OFFSET;

    const result = { sunrise: Math.round(sunriseLocal), sunset: Math.round(sunsetLocal), live: true };
    sunriseCache[cacheKey] = result;
    return result;
  } catch (e) {
    // Fallback: approximate sunrise 6:00 AM, sunset 6:30 PM
    return { sunrise: 360, sunset: 1110, live: false };
  }
}

// ── Rahu Kaal (computed from live sunrise/sunset) ──

async function getRahuKaalLive(date, city) {
  const d = date || new Date();
  const c = city || 'Mumbai';
  const day = d.getDay();
  const slotByDay = [8, 2, 7, 5, 6, 4, 3]; // Sun=8, Mon=2, Tue=7, Wed=5, Thu=6, Fri=4, Sat=3
  const slot = slotByDay[day];

  const sun = await fetchSunriseSunset(c, d);
  const dayLength = sun.sunset - sun.sunrise; // total day in minutes
  const slotDuration = dayLength / 8;
  const startMin = sun.sunrise + (slot - 1) * slotDuration;
  const endMin = startMin + slotDuration;

  return {
    start: formatTime12(minutesToDate(d, Math.round(startMin))),
    end: formatTime12(minutesToDate(d, Math.round(endMin))),
    city: c,
    live: sun.live
  };
}

// Sync fallback (uses approximate sunrise)
function getRahuKaal(date, city) {
  const d = date || new Date();
  const day = d.getDay();
  const slotByDay = [8, 2, 7, 5, 6, 4, 3];
  const slot = slotByDay[day];
  const startMin = 360 + (slot - 1) * 90;
  const endMin = startMin + 90;
  return {
    start: formatTime12(minutesToDate(d, startMin)),
    end: formatTime12(minutesToDate(d, endMin)),
    city: city || 'Default',
    live: false
  };
}

function getRahuKaalCities() { return Object.keys(CITIES); }

// ── Muhurat (computed from live sunrise/sunset) ──

async function getMuhuratLive(date, city) {
  const d = date || new Date();
  const c = city || 'Mumbai';
  const day = d.getDay();
  const slotByDay = [2, 7, 3, 6, 1, 5, 4];
  const slot = slotByDay[day];

  const sun = await fetchSunriseSunset(c, d);
  const dayLength = sun.sunset - sun.sunrise;
  const slotDuration = dayLength / 8;
  const startMin = sun.sunrise + (slot - 1) * slotDuration;
  const endMin = startMin + slotDuration;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return {
    start: formatTime12(minutesToDate(d, Math.round(startMin))),
    end: formatTime12(minutesToDate(d, Math.round(endMin))),
    dayName: dayNames[day],
    city: c,
    live: sun.live
  };
}

// Sync fallback
function getMuhurat(date, city) {
  const d = date || new Date();
  const day = d.getDay();
  const slotByDay = [2, 7, 3, 6, 1, 5, 4];
  const slot = slotByDay[day];
  const startMin = 360 + (slot - 1) * 90;
  const endMin = startMin + 90;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return {
    start: formatTime12(minutesToDate(d, startMin)),
    end: formatTime12(minutesToDate(d, endMin)),
    dayName: dayNames[day],
    city: city || 'Default',
    live: false
  };
}

// ── USD/INR Exchange Rate ──

let cachedUsdToInr = 85; // fallback

async function fetchExchangeRate() {
  try {
    const [inrRes, usdRes] = await Promise.all([
      fetch(`${GOLD_API_BASE}/XAU/INR`),
      fetch(`${GOLD_API_BASE}/XAU`)
    ]);
    const inrData = await inrRes.json();
    const usdData = await usdRes.json();
    if (inrData.price && usdData.price) {
      cachedUsdToInr = inrData.price / usdData.price;
    }
  } catch (e) { /* use fallback */ }
  return cachedUsdToInr;
}

function getExchangeRate() {
  return cachedUsdToInr;
}

export {
  fetchLiveCommodityPrices, fetchSunriseSunset, fetchGoldHistory, fetchGoldHistoryInterval, fetchSilverHistory, getMetalIntervals,
  getCommodityPrices, getGoldKaratRates, getGoldHistory, getGoldKaratList,
  getFuelPrices, getFuelCities,
  getRahuKaal, getRahuKaalLive, getRahuKaalCities,
  getMuhurat, getMuhuratLive,
  formatTime12,
  fetchExchangeRate, getExchangeRate
};
