// ── Static Data ──

const GOLD_BASE_24K = 7250; // INR per gram for 24K

const GOLD_KARATS = [
  { karat: '24K', purity: 0.999, label: '24K (99.9%)' },
  { karat: '22K', purity: 0.916, label: '22K (91.6%)' },
  { karat: '18K', purity: 0.750, label: '18K (75.0%)' },
  { karat: '14K', purity: 0.585, label: '14K (58.5%)' },
];

const GOLD_HISTORY = [
  { date: '2026-04-07', price: 7250 },
  { date: '2026-04-06', price: 7220 },
  { date: '2026-04-05', price: 7195 },
  { date: '2026-04-04', price: 7180 },
  { date: '2026-04-03', price: 7210 },
  { date: '2026-04-02', price: 7150 },
  { date: '2026-04-01', price: 7120 },
  { date: '2026-03-31', price: 7090 },
  { date: '2026-03-30', price: 7060 },
  { date: '2026-03-29', price: 7045 },
  { date: '2026-03-28', price: 7030 },
  { date: '2026-03-27', price: 7010 },
  { date: '2026-03-26', price: 6980 },
  { date: '2026-03-25', price: 6950 },
  { date: '2026-03-24', price: 6920 },
  { date: '2026-03-23', price: 6900 },
  { date: '2026-03-22', price: 6870 },
  { date: '2026-03-21', price: 6850 },
  { date: '2026-03-20', price: 6830 },
  { date: '2026-03-19', price: 6810 },
  { date: '2026-03-18', price: 6790 },
  { date: '2026-03-17', price: 6770 },
  { date: '2026-03-16', price: 6750 },
  { date: '2026-03-15', price: 6730 },
  { date: '2026-03-14', price: 6710 },
  { date: '2026-03-13', price: 6690 },
  { date: '2026-03-12', price: 6670 },
  { date: '2026-03-11', price: 6650 },
  { date: '2026-03-10', price: 6630 },
  { date: '2026-03-09', price: 6610 },
];

const FUEL_BY_CITY = {
  Mumbai:    { petrol: 104.21, diesel: 92.15 },
  Delhi:     { petrol: 94.72,  diesel: 87.62 },
  Bangalore: { petrol: 101.94, diesel: 87.89 },
  Chennai:   { petrol: 100.76, diesel: 92.38 },
  Kolkata:   { petrol: 104.95, diesel: 91.76 },
  Hyderabad: { petrol: 107.41, diesel: 95.65 },
  Pune:      { petrol: 104.36, diesel: 90.23 },
  Ahmedabad: { petrol: 94.38,  diesel: 90.08 },
  Jaipur:    { petrol: 104.88, diesel: 90.36 },
  Lucknow:   { petrol: 94.65,  diesel: 87.70 },
};

// Sunrise times by city (hour, minute) for Rahu Kaal calculation
const SUNRISE_BY_CITY = {
  Mumbai:    { h: 6, m: 20 },
  Delhi:     { h: 6, m: 0 },
  Bangalore: { h: 6, m: 10 },
  Chennai:   { h: 5, m: 55 },
  Kolkata:   { h: 5, m: 30 },
  Hyderabad: { h: 6, m: 5 },
  Pune:      { h: 6, m: 20 },
  Ahmedabad: { h: 6, m: 25 },
  Jaipur:    { h: 6, m: 10 },
  Lucknow:   { h: 5, m: 50 },
};

// ── Helpers ──

function formatTime12(d) {
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mm = minutes.toString().padStart(2, '0');
  return `${hours}:${mm} ${ampm}`;
}

// ── Public API ──

function getCommodityPrices() {
  return {
    gold: { pricePerGram: GOLD_BASE_24K },
    silver: { pricePerKg: 78000 }
  };
}

function getGoldKaratRates() {
  return GOLD_KARATS.map(k => ({
    ...k,
    pricePerGram: Math.round(GOLD_BASE_24K * k.purity),
    pricePer10Gram: Math.round(GOLD_BASE_24K * k.purity * 10),
  }));
}

function getGoldHistory() {
  return GOLD_HISTORY.slice().reverse(); // oldest first
}

function getFuelCities() {
  return Object.keys(FUEL_BY_CITY);
}

function getFuelPrices(city) {
  const c = city || 'Mumbai';
  const data = FUEL_BY_CITY[c] || FUEL_BY_CITY['Mumbai'];
  return { petrol: data.petrol, diesel: data.diesel, city: c };
}

function getRahuKaal(date, city) {
  const d = date || new Date();
  const day = d.getDay();
  const slotByDay = [8, 2, 7, 5, 6, 4, 3];
  const slot = slotByDay[day];

  const sunrise = (city && SUNRISE_BY_CITY[city]) ? SUNRISE_BY_CITY[city] : { h: 6, m: 0 };
  const sunriseMinutes = sunrise.h * 60 + sunrise.m;
  const startMinutes = sunriseMinutes + (slot - 1) * 90;
  const endMinutes = startMinutes + 90;

  const start = new Date(d); start.setHours(0, 0, 0, 0); start.setMinutes(startMinutes);
  const end = new Date(d); end.setHours(0, 0, 0, 0); end.setMinutes(endMinutes);

  return { start: formatTime12(start), end: formatTime12(end), city: city || 'Default' };
}

function getMuhurat(date) {
  const d = date || new Date();
  const day = d.getDay();
  const slotByDay = [2, 7, 3, 6, 1, 5, 4];
  const slot = slotByDay[day];

  const sunriseMinutes = 6 * 60;
  const startMinutes = sunriseMinutes + (slot - 1) * 90;
  const endMinutes = startMinutes + 90;

  const start = new Date(d); start.setHours(0, 0, 0, 0); start.setMinutes(startMinutes);
  const end = new Date(d); end.setHours(0, 0, 0, 0); end.setMinutes(endMinutes);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return { start: formatTime12(start), end: formatTime12(end), dayName: dayNames[day] };
}

function getRahuKaalCities() {
  return Object.keys(SUNRISE_BY_CITY);
}

export {
  getCommodityPrices, getGoldKaratRates, getGoldHistory,
  getFuelPrices, getFuelCities,
  getRahuKaal, getRahuKaalCities, getMuhurat,
  formatTime12
};
