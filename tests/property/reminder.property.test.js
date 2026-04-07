import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { FC_CONFIG } from '../setup.js';
import {
  createReminder,
  deleteReminder,
  getAllReminders,
  loadReminders,
  STORAGE_KEY
} from '../../js/reminder.js';

// Generate valid ISO date strings using integer timestamps
const validDateStr = fc.integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
  .map(ts => new Date(ts).toISOString());

beforeEach(() => {
  localStorage.clear();
});

// Property 13: Reminder round-trip through localStorage
describe('Property 13: Reminder round-trip through localStorage', () => {
  it('should persist and retrieve reminders with matching title and dateTime', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        validDateStr,
        (title, dateTime) => {
          localStorage.clear();
          const created = createReminder(title, dateTime);
          expect(created.title).toBe(title);
          expect(created.dateTime).toBe(dateTime);
          expect(created.id).toBeDefined();

          const loaded = loadReminders();
          expect(loaded.length).toBe(1);
          expect(loaded[0].title).toBe(title);
          expect(loaded[0].dateTime).toBe(dateTime);
          expect(loaded[0].id).toBe(created.id);
        }
      ),
      FC_CONFIG
    );
  });

  it('should round-trip multiple reminders', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 50 }),
            dateTime: validDateStr
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (items) => {
          localStorage.clear();
          const created = items.map(item =>
            createReminder(item.title, item.dateTime)
          );
          const loaded = loadReminders();
          expect(loaded.length).toBe(items.length);
          created.forEach(c => {
            const found = loaded.find(r => r.id === c.id);
            expect(found).toBeDefined();
            expect(found.title).toBe(c.title);
          });
        }
      ),
      FC_CONFIG
    );
  });
});

// Property 14: Reminders sorted by dateTime
describe('Property 14: getAllReminders returns reminders sorted by dateTime ascending', () => {
  it('should return reminders in ascending dateTime order', () => {
    fc.assert(
      fc.property(
        fc.array(validDateStr, { minLength: 2, maxLength: 20 }),
        (dateTimes) => {
          localStorage.clear();
          dateTimes.forEach((dt, i) => {
            createReminder(`Reminder ${i}`, dt);
          });
          const all = getAllReminders();
          expect(all.length).toBe(dateTimes.length);
          for (let i = 1; i < all.length; i++) {
            const prev = new Date(all[i - 1].dateTime).getTime();
            const curr = new Date(all[i].dateTime).getTime();
            expect(curr).toBeGreaterThanOrEqual(prev);
          }
        }
      ),
      FC_CONFIG
    );
  });
});

// Property 15: Deleting removes exactly that reminder
describe('Property 15: Deleting a reminder removes exactly that reminder', () => {
  it('should remove only the targeted reminder and leave others intact', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 50 }),
            dateTime: validDateStr
          }),
          { minLength: 2, maxLength: 10 }
        ),
        fc.nat(),
        (items, indexSeed) => {
          localStorage.clear();
          const created = items.map(item =>
            createReminder(item.title, item.dateTime)
          );
          const deleteIndex = indexSeed % created.length;
          const targetId = created[deleteIndex].id;

          const deleted = deleteReminder(targetId);
          expect(deleted).toBe(true);

          const remaining = loadReminders();
          expect(remaining.length).toBe(created.length - 1);
          expect(remaining.find(r => r.id === targetId)).toBeUndefined();
          created.forEach((c, i) => {
            if (i !== deleteIndex) {
              expect(remaining.find(r => r.id === c.id)).toBeDefined();
            }
          });
        }
      ),
      FC_CONFIG
    );
  });

  it('should return false when deleting a non-existent id', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 30, maxLength: 40 }),
        (fakeId) => {
          localStorage.clear();
          createReminder('Test', '2025-01-01T00:00:00.000Z');
          const result = deleteReminder(fakeId);
          const remaining = loadReminders();
          // The fakeId is very unlikely to match the generated id
          if (remaining.length === 1) {
            expect(result).toBe(false);
          }
        }
      ),
      FC_CONFIG
    );
  });
});
