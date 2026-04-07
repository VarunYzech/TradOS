import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, fetchStockData, extractClosingPrices, getCachedData } from '../../js/api.js';

describe('API Client', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('loadConfig', () => {
    it('should return parsed config object on successful fetch', async () => {
      const mockConfig = {
        apiKey: 'TEST_KEY',
        symbol: 'RELIANCE.NSE',
        interval: '1min',
        maWindow: 5,
        volatilityThreshold: 2.0,
        refreshInterval: 60000
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      });

      const result = await loadConfig();
      expect(result).toEqual(mockConfig);
      expect(globalThis.fetch).toHaveBeenCalledWith('/data/config.json');
    });

    it('should return null when fetch response is not ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      });

      const result = await loadConfig();
      expect(result).toBeNull();
    });

    it('should return null when fetch throws a network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await loadConfig();
      expect(result).toBeNull();
    });

    it('should return null when response contains invalid JSON', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token'))
      });

      const result = await loadConfig();
      expect(result).toBeNull();
    });
  });

  describe('extractClosingPrices', () => {
    it('should extract and reverse closing prices from valid response', () => {
      const response = {
        values: [
          { close: '105.50' },
          { close: '103.00' },
          { close: '100.25' }
        ]
      };
      const result = extractClosingPrices(response);
      expect(result).toEqual([100.25, 103.00, 105.50]);
    });

    it('should return empty array for null input', () => {
      expect(extractClosingPrices(null)).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      expect(extractClosingPrices(undefined)).toEqual([]);
    });

    it('should return empty array when values is missing', () => {
      expect(extractClosingPrices({})).toEqual([]);
    });

    it('should return empty array when values is not an array', () => {
      expect(extractClosingPrices({ values: 'not-array' })).toEqual([]);
    });

    it('should return empty array when values is empty', () => {
      expect(extractClosingPrices({ values: [] })).toEqual([]);
    });

    it('should handle single value', () => {
      const response = { values: [{ close: '42.50' }] };
      expect(extractClosingPrices(response)).toEqual([42.50]);
    });

    it('should parse string close values to numbers', () => {
      const response = {
        values: [{ close: '200.75' }, { close: '199.25' }]
      };
      const result = extractClosingPrices(response);
      result.forEach(p => expect(typeof p).toBe('number'));
    });
  });

  describe('fetchStockData', () => {
    it('should fetch data with correct URL parameters', async () => {
      const mockResponse = {
        values: [
          { close: '110.00' },
          { close: '105.00' },
          { close: '100.00' }
        ]
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await fetchStockData('TCS.NSE', '5min', 'MY_KEY');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.twelvedata.com/time_series')
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('symbol=TCS.NSE')
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('interval=5min')
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('apikey=MY_KEY')
      );
    });

    it('should return closing prices ordered oldest to newest on success', async () => {
      const mockResponse = {
        values: [
          { close: '300.00' },
          { close: '200.00' },
          { close: '100.00' }
        ]
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await fetchStockData('SYM', '1min', 'KEY');
      expect(result).toEqual([100, 200, 300]);
    });

    it('should cache successful data', async () => {
      const mockResponse = {
        values: [{ close: '50.00' }, { close: '40.00' }]
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await fetchStockData('SYM', '1min', 'KEY');
      expect(getCachedData()).toEqual([40, 50]);
    });

    it('should return cached data on network error', async () => {
      // First, populate cache with a successful call
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ values: [{ close: '99.00' }] })
      });
      await fetchStockData('SYM', '1min', 'KEY');

      // Now simulate a network error
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const result = await fetchStockData('SYM', '1min', 'KEY');
      expect(result).toEqual([99]);
    });

    it('should return cached data on non-ok response', async () => {
      // Populate cache
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ values: [{ close: '75.00' }] })
      });
      await fetchStockData('SYM', '1min', 'KEY');

      // Non-ok response
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      const result = await fetchStockData('SYM', '1min', 'KEY');
      expect(result).toEqual([75]);
    });

    it('should return cached data when API returns error status', async () => {
      // Populate cache
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ values: [{ close: '60.00' }] })
      });
      await fetchStockData('SYM', '1min', 'KEY');

      // API error response
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'error', message: 'Invalid API key' })
      });
      const result = await fetchStockData('SYM', '1min', 'KEY');
      expect(result).toEqual([60]);
    });

    it('should use default symbol and interval', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ values: [{ close: '10.00' }] })
      });

      await fetchStockData(undefined, undefined, 'KEY');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('symbol=RELIANCE.NSE')
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('interval=1min')
      );
    });

    it('should show and hide loading spinner', async () => {
      const spinner = document.createElement('div');
      spinner.id = 'loading-spinner';
      spinner.style.display = 'none';
      document.body.appendChild(spinner);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ values: [{ close: '10.00' }] })
      });

      await fetchStockData('SYM', '1min', 'KEY');
      // After fetch completes, spinner should be hidden
      expect(spinner.style.display).toBe('none');

      document.body.removeChild(spinner);
    });

    it('should show error toast on failure', async () => {
      const container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      await fetchStockData('SYM', '1min', 'KEY');

      expect(container.children.length).toBe(1);
      expect(container.children[0].textContent).toBe('Connection refused');
      expect(container.children[0].className).toBe('toast error');

      document.body.removeChild(container);
    });
  });

  describe('getCachedData', () => {
    it('should return cached data after successful fetch', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ values: [{ close: '123.45' }] })
      });

      await fetchStockData('SYM', '1min', 'KEY');
      expect(getCachedData()).toEqual([123.45]);
    });
  });
});
