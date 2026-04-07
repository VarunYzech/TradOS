import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isLocalStorageAvailable, loadReminders, saveReminders, createReminder, deleteReminder, getAllReminders, STORAGE_KEY } from '../../js/reminder.js';

describe('Reminder System - localStorage functions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isLocalStorageAvailable', () => {
    it('returns true when localStorage is available', () => {
      expect(isLocalStorageAvailable()).toBe(true);
    });

    it('returns false when localStorage throws', () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('disabled'); };
      expect(isLocalStorageAvailable()).toBe(false);
      Storage.prototype.setItem = original;
    });
  });

  describe('loadReminders', () => {
    it('returns empty array when no data stored', () => {
      expect(loadReminders()).toEqual([]);
    });

    it('returns stored reminders', () => {
      const reminders = [
        { id: '1', title: 'Test', dateTime: '2025-01-01T10:00:00', createdAt: 1000 }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
      expect(loadReminders()).toEqual(reminders);
    });

    it('returns empty array for corrupted JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json!!!');
      expect(loadReminders()).toEqual([]);
    });

    it('returns empty array when stored value is not an array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
      expect(loadReminders()).toEqual([]);
    });

    it('returns empty array when localStorage is unavailable', () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('disabled'); };
      expect(loadReminders()).toEqual([]);
      Storage.prototype.setItem = original;
    });
  });

  describe('saveReminders', () => {
    it('persists reminders to localStorage', () => {
      const reminders = [
        { id: '1', title: 'Buy RELIANCE', dateTime: '2025-06-01T09:15:00', createdAt: 1000 }
      ];
      saveReminders(reminders);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(reminders);
    });

    it('overwrites existing data', () => {
      saveReminders([{ id: '1', title: 'Old', dateTime: '2025-01-01T00:00:00', createdAt: 1 }]);
      const updated = [{ id: '2', title: 'New', dateTime: '2025-02-01T00:00:00', createdAt: 2 }];
      saveReminders(updated);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(updated);
    });

    it('saves empty array', () => {
      saveReminders([]);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([]);
    });

    it('does not throw when localStorage is unavailable', () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('disabled'); };
      expect(() => saveReminders([{ id: '1' }])).not.toThrow();
      Storage.prototype.setItem = original;
    });
  });
});

describe('Reminder System - CRUD functions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('createReminder', () => {
    it('creates a reminder with id, title, dateTime, and createdAt', () => {
      const reminder = createReminder('Buy RELIANCE', '2025-06-15T09:15:00');
      expect(reminder).toHaveProperty('id');
      expect(typeof reminder.id).toBe('string');
      expect(reminder.id.length).toBeGreaterThan(0);
      expect(reminder.title).toBe('Buy RELIANCE');
      expect(reminder.dateTime).toBe('2025-06-15T09:15:00');
      expect(typeof reminder.createdAt).toBe('number');
    });

    it('persists the reminder to localStorage', () => {
      createReminder('Test', '2025-01-01T00:00:00');
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe('Test');
    });

    it('generates unique ids for multiple reminders', () => {
      const r1 = createReminder('First', '2025-01-01T00:00:00');
      const r2 = createReminder('Second', '2025-02-01T00:00:00');
      expect(r1.id).not.toBe(r2.id);
    });
  });

  describe('deleteReminder', () => {
    it('returns true and removes the reminder when id exists', () => {
      const r = createReminder('To delete', '2025-03-01T00:00:00');
      expect(deleteReminder(r.id)).toBe(true);
      expect(getAllReminders()).toHaveLength(0);
    });

    it('returns false when id does not exist', () => {
      createReminder('Keep', '2025-03-01T00:00:00');
      expect(deleteReminder('nonexistent-id')).toBe(false);
      expect(getAllReminders()).toHaveLength(1);
    });

    it('only removes the targeted reminder', () => {
      const r1 = createReminder('First', '2025-01-01T00:00:00');
      const r2 = createReminder('Second', '2025-02-01T00:00:00');
      deleteReminder(r1.id);
      const remaining = getAllReminders();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(r2.id);
    });
  });

  describe('getAllReminders', () => {
    it('returns empty array when no reminders exist', () => {
      expect(getAllReminders()).toEqual([]);
    });

    it('returns reminders sorted by dateTime ascending', () => {
      createReminder('Later', '2025-12-01T00:00:00');
      createReminder('Earlier', '2025-01-01T00:00:00');
      createReminder('Middle', '2025-06-01T00:00:00');
      const all = getAllReminders();
      expect(all[0].title).toBe('Earlier');
      expect(all[1].title).toBe('Middle');
      expect(all[2].title).toBe('Later');
    });
  });
});
