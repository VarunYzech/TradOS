// Stock categories — Indian BSE/NSE first, then US stocks
// Note: Indian stocks (BSE/NSE) require Twelve Data paid plan
// US stocks work on free tier

const STOCK_CATEGORIES = [
  {
    id: 'bse-nifty50',
    label: '🇮🇳 Nifty 50',
    stocks: [
      { symbol: 'RELIANCE.BSE', name: 'Reliance Industries' },
      { symbol: 'TCS.BSE', name: 'Tata Consultancy Services' },
      { symbol: 'HDFCBANK.BSE', name: 'HDFC Bank' },
      { symbol: 'INFY.BSE', name: 'Infosys' },
      { symbol: 'ICICIBANK.BSE', name: 'ICICI Bank' },
      { symbol: 'HINDUNILVR.BSE', name: 'Hindustan Unilever' },
      { symbol: 'ITC.BSE', name: 'ITC Ltd' },
      { symbol: 'SBIN.BSE', name: 'State Bank of India' },
      { symbol: 'BHARTIARTL.BSE', name: 'Bharti Airtel' },
      { symbol: 'KOTAKBANK.BSE', name: 'Kotak Mahindra Bank' },
      { symbol: 'LT.BSE', name: 'Larsen & Toubro' },
      { symbol: 'AXISBANK.BSE', name: 'Axis Bank' },
      { symbol: 'WIPRO.BSE', name: 'Wipro Ltd' },
      { symbol: 'HCLTECH.BSE', name: 'HCL Technologies' },
      { symbol: 'BAJFINANCE.BSE', name: 'Bajaj Finance' },
    ]
  },
  {
    id: 'bse-it',
    label: '🇮🇳 IT',
    stocks: [
      { symbol: 'TCS.BSE', name: 'TCS' },
      { symbol: 'INFY.BSE', name: 'Infosys' },
      { symbol: 'WIPRO.BSE', name: 'Wipro' },
      { symbol: 'HCLTECH.BSE', name: 'HCL Tech' },
      { symbol: 'TECHM.BSE', name: 'Tech Mahindra' },
      { symbol: 'LTIM.BSE', name: 'LTIMindtree' },
      { symbol: 'MPHASIS.BSE', name: 'Mphasis' },
      { symbol: 'COFORGE.BSE', name: 'Coforge' },
    ]
  },
  {
    id: 'bse-bank',
    label: '🇮🇳 Banks',
    stocks: [
      { symbol: 'HDFCBANK.BSE', name: 'HDFC Bank' },
      { symbol: 'ICICIBANK.BSE', name: 'ICICI Bank' },
      { symbol: 'SBIN.BSE', name: 'SBI' },
      { symbol: 'KOTAKBANK.BSE', name: 'Kotak Bank' },
      { symbol: 'AXISBANK.BSE', name: 'Axis Bank' },
      { symbol: 'INDUSINDBK.BSE', name: 'IndusInd Bank' },
      { symbol: 'BANKBARODA.BSE', name: 'Bank of Baroda' },
      { symbol: 'PNB.BSE', name: 'Punjab National Bank' },
    ]
  },
  {
    id: 'bse-pharma',
    label: '🇮🇳 Pharma',
    stocks: [
      { symbol: 'SUNPHARMA.BSE', name: 'Sun Pharma' },
      { symbol: 'DRREDDY.BSE', name: "Dr. Reddy's Labs" },
      { symbol: 'CIPLA.BSE', name: 'Cipla' },
      { symbol: 'DIVISLAB.BSE', name: "Divi's Labs" },
      { symbol: 'APOLLOHOSP.BSE', name: 'Apollo Hospitals' },
      { symbol: 'BIOCON.BSE', name: 'Biocon' },
    ]
  },
  {
    id: 'bse-auto',
    label: '🇮🇳 Auto',
    stocks: [
      { symbol: 'TATAMOTORS.BSE', name: 'Tata Motors' },
      { symbol: 'MARUTI.BSE', name: 'Maruti Suzuki' },
      { symbol: 'M&M.BSE', name: 'Mahindra & Mahindra' },
      { symbol: 'BAJAJ-AUTO.BSE', name: 'Bajaj Auto' },
      { symbol: 'HEROMOTOCO.BSE', name: 'Hero MotoCorp' },
      { symbol: 'EICHERMOT.BSE', name: 'Eicher Motors' },
    ]
  },
  {
    id: 'us-popular',
    label: '🇺🇸 Popular',
    stocks: [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corp.' },
      { symbol: 'GOOGL', name: 'Alphabet (Google)' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'META', name: 'Meta Platforms' },
      { symbol: 'NVDA', name: 'NVIDIA Corp.' },
      { symbol: 'NFLX', name: 'Netflix Inc.' },
    ]
  },
  {
    id: 'us-tech',
    label: '🇺🇸 Tech',
    stocks: [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft' },
      { symbol: 'GOOGL', name: 'Alphabet' },
      { symbol: 'NVDA', name: 'NVIDIA' },
      { symbol: 'AMD', name: 'AMD' },
      { symbol: 'INTC', name: 'Intel' },
      { symbol: 'CRM', name: 'Salesforce' },
      { symbol: 'ORCL', name: 'Oracle' },
      { symbol: 'ADBE', name: 'Adobe' },
    ]
  },
  {
    id: 'us-finance',
    label: '🇺🇸 Finance',
    stocks: [
      { symbol: 'JPM', name: 'JPMorgan Chase' },
      { symbol: 'BAC', name: 'Bank of America' },
      { symbol: 'GS', name: 'Goldman Sachs' },
      { symbol: 'V', name: 'Visa' },
      { symbol: 'MA', name: 'Mastercard' },
    ]
  },
  {
    id: 'crypto',
    label: '₿ Crypto',
    stocks: [
      { symbol: 'BTC/USD', name: 'Bitcoin' },
      { symbol: 'ETH/USD', name: 'Ethereum' },
      { symbol: 'COIN', name: 'Coinbase' },
    ]
  },
  {
    id: 'etf',
    label: '📦 ETFs',
    stocks: [
      { symbol: 'SPY', name: 'S&P 500 ETF' },
      { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
      { symbol: 'GLD', name: 'Gold ETF' },
    ]
  },
];

// Time intervals for chart view
const TIME_INTERVALS = [
  { id: '1min', label: '1M', desc: '1 Minute' },
  { id: '5min', label: '5M', desc: '5 Minutes' },
  { id: '15min', label: '15M', desc: '15 Minutes' },
  { id: '1h', label: '1H', desc: '1 Hour' },
  { id: '1day', label: '1D', desc: '1 Day' },
  { id: '1week', label: '1W', desc: '1 Week' },
  { id: '1month', label: '1Mo', desc: '1 Month' },
];

// Build flat searchable list
const ALL_STOCKS = [];
const seen = new Set();
STOCK_CATEGORIES.forEach(cat => {
  cat.stocks.forEach(s => {
    if (!seen.has(s.symbol)) {
      seen.add(s.symbol);
      ALL_STOCKS.push(s);
    }
  });
});

function searchStocks(query, limit = 10) {
  if (!query) return [];
  const q = query.toUpperCase();
  return ALL_STOCKS
    .filter(s => s.symbol.toUpperCase().includes(q) || s.name.toUpperCase().includes(q))
    .slice(0, limit);
}

function getStocksByCategory(categoryId) {
  const cat = STOCK_CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.stocks : [];
}

export { STOCK_CATEGORIES, ALL_STOCKS, TIME_INTERVALS, searchStocks, getStocksByCategory };
