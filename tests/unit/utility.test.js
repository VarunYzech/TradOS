import { describe, it, expect } from 'vitest';
import {
  getCommodityPrices, getGoldKaratRates, getGoldHistory,
  getFuelPrices, getFuelCities,
  getRahuKaal, getRahuKaalCities, getMuhurat
} from '../../js/utility.js';

describe('Utility Module', () => {
  describe('getCommodityPrices', () => {
    it('returns gold price per gram as a positive number', () => {
      const result = getCommodityPrices();
      expect(result.gold.pricePerGram).toBeGreaterThan(0);
    });

    it('returns silver price per kg as a positive number', () => {
      const result = getCommodityPrices();
      expect(result.silver.pricePerKg).toBeGreaterThan(0);
    });

    it('returns gold price in reasonable INR/gram range', () => {
      const { gold } = getCommodityPrices();
      expect(gold.pricePerGram).toBeGreaterThanOrEqual(4000);
      expect(gold.pricePerGram).toBeLessThanOrEqual(10000);
    });

    it('returns silver price in reasonable INR/kg range', () => {
      const { silver } = getCommodityPrices();
      expect(silver.pricePerKg).toBeGreaterThanOrEqual(50000);
      expect(silver.pricePerKg).toBeLessThanOrEqual(150000);
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

    it('pricePer10Gram is approximately 10x pricePerGram', () => {
      const rates = getGoldKaratRates();
      rates.forEach(r => {
        expect(Math.abs(r.pricePer10Gram - r.pricePerGram * 10)).toBeLessThanOrEqual(10);
      });
    });
  });

  describe('getGoldHistory', () => {
    it('returns an array of date/price objects', () => {
      const history = getGoldHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('date');
      expect(history[0]).toHaveProperty('price');
    });

    it('is sorted oldest first', () => {
      const history = getGoldHistory();
      for (let i = 1; i < history.length; i++) {
        expect(history[i].date >= history[i - 1].date).toBe(true);
      }
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
      expect(result.diesel).toBeGreaterThan(0);
    });

    it('falls back to Mumbai for unknown city', () => {
      const result = getFuelPrices('UnknownCity');
      expect(result.petrol).toBe(getFuelPrices('Mumbai').petrol);
    });
  });

  describe('getFuelCities', () => {
    it('returns an array of city names', () => {
      const cities = getFuelCities();
      expect(cities.length).toBeGreaterThan(0);
      expect(cities).toContain('Mumbai');
      expect(cities).toContain('Delhi');
    });
  });

  describe('getRahuKaal', () => {
    it('returns start/end in AM/PM format with default (no city)', () => {
      const sunday = new Date(2025, 0, 5);
      const result = getRahuKaal(sunday);
      expect(result.start).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
      expect(result.end).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('returns different times for different cities on the same day', () => {
      const monday = new Date(2025, 0, 6);
      const mumbai = getRahuKaal(monday, 'Mumbai');
      const kolkata = getRahuKaal(monday, 'Kolkata');
      // Different sunrise times should produce different windows
      expect(mumbai.start).not.toBe(kolkata.start);
    });

    it('defaults to today when no date is provided', () => {
      const result = getRahuKaal();
      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('end');
    });
  });

  describe('getRahuKaalCities', () => {
    it('returns an array of city names', () => {
      const cities = getRahuKaalCities();
      expect(cities.length).toBeGreaterThan(0);
      expect(cities).toContain('Mumbai');
    });
  });

  describe('getMuhurat', () => {
    it('returns correct Muhurat for Sunday (slot 2): 7:30 AM – 9:00 AM', () => {
      const sunday = new Date(2025, 0, 5);
      const result = getMuhurat(sunday);
      expect(result.start).toBe('7:30 AM');
      expect(result.end).toBe('9:00 AM');
      expect(result.dayName).toBe('Sunday');
    });

    it('returns correct Muhurat for Thursday (slot 1): 6:00 AM – 7:30 AM', () => {
      const thursday = new Date(2025, 0, 9);
      const result = getMuhurat(thursday);
      expect(result.start).toBe('6:00 AM');
      expect(result.end).toBe('7:30 AM');
      expect(result.dayName).toBe('Thursday');
    });

    it('returns dayName for any date', () => {
      const result = getMuhurat(new Date(2025, 0, 8)); // Wednesday
      expect(result.dayName).toBe('Wednesday');
    });

    it('defaults to today when no date is provided', () => {
      const result = getMuhurat();
      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('end');
      expect(result).toHaveProperty('dayName');
    });
  });
});
