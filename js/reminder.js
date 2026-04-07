const STORAGE_KEY = 'tradeos_reminders';

/**
 * Check if localStorage is available.
 * @returns {boolean}
 */
function isLocalStorageAvailable() {
  try {
    const testKey = '__tradeos_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Load reminders from localStorage.
 * @returns {Array} Array of Reminder objects, or empty array if localStorage unavailable or data is corrupted.
 */
function loadReminders() {
  if (!isLocalStorageAvailable()) {
    return [];
  }
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data === null) {
      return [];
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (e) {
    return [];
  }
}

/**
 * Save reminders array to localStorage.
 * @param {Array} reminders - array to persist
 */
function saveReminders(reminders) {
  if (!isLocalStorageAvailable()) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  } catch (e) {
    // Silently fail if localStorage write fails (e.g., quota exceeded)
  }
}

/**
 * Create and persist a new reminder.
 * @param {string} title - reminder title text
 * @param {string} dateTime - ISO 8601 date-time string
 * @returns {Object} The created Reminder object with generated id.
 */
function createReminder(title, dateTime) {
  const reminder = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    title,
    dateTime,
    createdAt: Date.now()
  };
  const reminders = loadReminders();
  reminders.push(reminder);
  saveReminders(reminders);
  return reminder;
}

/**
 * Delete a reminder by id.
 * @param {string} id - unique reminder identifier
 * @returns {boolean} true if deleted, false if not found.
 */
function deleteReminder(id) {
  const reminders = loadReminders();
  const index = reminders.findIndex(r => r.id === id);
  if (index === -1) {
    return false;
  }
  reminders.splice(index, 1);
  saveReminders(reminders);
  return true;
}

/**
 * Get all reminders sorted by dateTime ascending.
 * @returns {Array} Array of Reminder objects.
 */
function getAllReminders() {
  const reminders = loadReminders();
  reminders.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  return reminders;
}

export { isLocalStorageAvailable, loadReminders, saveReminders, createReminder, deleteReminder, getAllReminders, STORAGE_KEY };
