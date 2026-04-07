import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchLiveCommodityPrices,
  getCommodityPrices, getGoldKaratRates, getGoldKaratList,
  getFuelPrices, getFuelCities,
  getRahuKaal, getRahuKaalLive, getRahuKaalCities, getMuhurat, getMuhuratLive
} from '../../js/utility.js';

describe('Utility Module', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('fetchLiveCommodityPrices', () => {
    it('returns live gold and silver prices on success', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ price: 433000, updatedAt: '2026-04-07T10:00:00Z' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ price: 6600, updatedAt: '2026-04-07T10:00:00Z' }) });

      const result = await fetchLiveCommodityPrices();
      expect(result.live).toBe(true);
      expect(result.gold.pricePerGram).toBeGreaterThan(0);
      expect(result.silver.pricePerKg).toBeGreaterThan(0);
      expect(result.updatedAt).toBeTruthy();
    });

    it('returns fallback on API error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await fetchLiveCommodityPrices();
      expect(result.live).toBe(false);
      expect(result.gold.pricePerGram).toBeGreaterThan(0);
      expect(result.silver.pricePerKg).toBeGreaterThan(0);
    });

    it('returns fallback on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

      const result = await fetchLiveCommodityPrices();
      expect(result.live).toBe(false);
    });
  });

  describe('getCommodityPrices', () => {
    it('returns gold and silver with positive values', () => {
      const result = getCommodityPrices();
      expect(result.gold.pricePerGram).toBeGreaterThan(0);
      expect(result.silver.pricePerKg).toBeGreaterThan(0);
    });
  });

  describe('getGoldKaratRates', () => {
    it('returns rates for 24K, 22K, 18K, 14K', () => {
      const rates = getGoldKaratRates();
      expect(rates).toHaveLength(4);
      expect(rates.map(r => r.karat)).toEqual(['24K', '22K', '18K', '14K']);
    });

    it('24K is the most expensive per gram', () => {
      const rates = getGoldKaratRates();
      const prices = rates.map(r => r.pricePerGram);
      expect(prices[0]).toBeGreaterThan(prices[1]);
      expect(prices[1]).toBeGreaterThan(prices[2]);
      expect(prices[2]).toBeGreaterThan(prices[3]);
    });
  });

  describe('getGoldKaratList', () => {
    it('returns array of karat strings', () => {
      expect(getGoldKaratList()).toEqual(['24K', '22K', '18K', '14K']);
    });
  });

  describe('getFuelPrices', () => {
    it('defaults to Mumbai', () => {
      const result = getFuelPrices();
      expect(result.city).toBe('Mumbai');
      expect(result.petrol).toBeGreaterThan(0);
    });

    it('returns prices for a specific city', () => {
      const result = getFuelPrices('Delhi');
      expect(result.city).toBe('Delhi');
      expect(result.petrol).toBeGreaterThan(0);
    });

    it('falls back to Mumbai for unknown city', () => {
      const result = getFuelPrices('UnknownCity');
      expect(result.petrol).toBe(getFuelPrices('Mumbai').petrol);
    });
  });

  describe('getFuelCities', () => {
    it('returns an array of city names', () => {
      const cities = getFuelCities();
      expect(cities).toContain('Mumbai');
      expect(cities).toContain('Delhi');
    });
  });

  describe('getRahuKaal', () => {
    it('returns start/end in AM/PM format', () => {
      const result = getRahuKaal(new Date(2025, 0, 5));
      expect(result.start).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
      expect(result.end).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('defaults to today when no date is provided', () => {
      const result = getRahuKaal();
      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('end');
    });
  });

  describe('getRahuKaalLive', () => {
    it('returns live times when sunrise API succeeds', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'OK',
          results: {
            sunrise: '2025-01-05T01:00:00+00:00',
            sunset: '2025-01-05T12:30:00+00:00'
          }
        })
      });

      const result = await getRahuKaalLive(new Date(2025, 0, 5), 'Mumbai');
      expect(result.live).toBe(true);
      expect(result.start).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
      expect(result.end).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('falls back gracefully on API error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'));
      const result = await getRahuKaalLive(new Date(2025, 0, 5), 'UnknownCity');
      expect(result.start).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });
  });

  describe('getRahuKaalCities', () => {
    it('returns an array of city names', () => {
      const cities = getRahuKaalCities();
      expect(cities).toContain('Mumbai');
    });
  });

  describe('getMuhurat', () => {
    it('returns correct day name for Sunday', () => {
      const result = getMuhurat(new Date(2025, 0, 5));
      expect(result.dayName).toBe('Sunday');
      expect(result.start).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('defaults to today when no date is provided', () => {
      const result = getMuhurat();
      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('dayName');
    });
  });

  describe('getMuhuratLive', () => {
    it('returns live times when sunrise API succeeds', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'OK',
          results: {
            sunrise: '2025-01-05T01:00:00+00:00',
            sunset: '2025-01-05T12:30:00+00:00'
          }
        })
      });

      const result = await getMuhuratLive(new Date(2025, 0, 5), 'Mumbai');
      expect(result.live).toBe(true);
      expect(result.dayName).toBe('Sunday');
      expect(result.start).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('returns different times for different cities', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        const sunrise = callCount === 1 ? '2025-01-06T00:50:00+00:00' : '2025-01-06T00:00:00+00:00';
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'OK',
            results: { sunrise, sunset: '2025-01-06T12:30:00+00:00' }
          })
        });
      });

      const mumbai = await getMuhuratLive(new Date(2025, 0, 6), 'Mumbai');
      const kolkata = await getMuhuratLive(new Date(2025, 0, 6), 'Kolkata');
      expect(mumbai.start).not.toBe(kolkata.start);
    });
  });
});
