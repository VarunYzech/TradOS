import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FC_CONFIG } from '../setup.js';
import { getRahuKaal, getMuhurat } from '../../js/utility.js';

const TIME_12_REGEX = /^\d{1,2}:\d{2}\s(AM|PM)$/;

// Property 11: getRahuKaal returns valid time windows for all weekdays
describe('Property 11: getRahuKaal returns valid time windows for all weekdays', () => {
  it('should return valid start/end times in 12h format for any day of the week', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        (dayOfWeek) => {
          // Create a date for the given day of week
          const date = new Date(2025, 0, 5 + dayOfWeek); // Jan 5 2025 is Sunday (0)
          const result = getRahuKaal(date);
          expect(result.start).toMatch(TIME_12_REGEX);
          expect(result.end).toMatch(TIME_12_REGEX);
          expect(result.live).toBe(false);
        }
      ),
      FC_CONFIG
    );
  });

  it('should produce different time windows for different days', () => {
    const results = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(2025, 0, 5 + d);
      results.push(getRahuKaal(date));
    }
    // At least some days should have different start times
    const uniqueStarts = new Set(results.map(r => r.start));
    expect(uniqueStarts.size).toBeGreaterThan(1);
  });

  it('should return start time before end time (in minutes)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        (dayOfWeek) => {
          const date = new Date(2025, 0, 5 + dayOfWeek);
          const result = getRahuKaal(date);
          const startMin = parseTime12ToMinutes(result.start);
          const endMin = parseTime12ToMinutes(result.end);
          expect(endMin).toBeGreaterThan(startMin);
        }
      ),
      FC_CONFIG
    );
  });
});

// Property 12: getMuhurat returns valid time windows for all weekdays
describe('Property 12: getMuhurat returns valid time windows for all weekdays', () => {
  it('should return valid start/end times and dayName for any day of the week', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        (dayOfWeek) => {
          const date = new Date(2025, 0, 5 + dayOfWeek);
          const result = getMuhurat(date);
          expect(result.start).toMatch(TIME_12_REGEX);
          expect(result.end).toMatch(TIME_12_REGEX);
          expect(result.live).toBe(false);
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          expect(dayNames).toContain(result.dayName);
          expect(result.dayName).toBe(dayNames[dayOfWeek]);
        }
      ),
      FC_CONFIG
    );
  });

  it('should return start time before end time (in minutes)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        (dayOfWeek) => {
          const date = new Date(2025, 0, 5 + dayOfWeek);
          const result = getMuhurat(date);
          const startMin = parseTime12ToMinutes(result.start);
          const endMin = parseTime12ToMinutes(result.end);
          expect(endMin).toBeGreaterThan(startMin);
        }
      ),
      FC_CONFIG
    );
  });

  it('should produce different time windows for different days', () => {
    const results = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(2025, 0, 5 + d);
      results.push(getMuhurat(date));
    }
    const uniqueStarts = new Set(results.map(r => r.start));
    expect(uniqueStarts.size).toBeGreaterThan(1);
  });
});

/** Helper: parse "3:00 PM" to minutes from midnight */
function parseTime12ToMinutes(timeStr) {
  const [timePart, ampm] = timeStr.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}
