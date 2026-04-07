import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { FC_CONFIG } from '../setup.js';
import { showToast } from '../../js/app.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="toast-container"></div>';
});

// Property 17: showToast applies correct CSS class for each type
describe('Property 17: showToast applies correct CSS class for each type', () => {
  it('should create a toast element with the correct CSS class matching the type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('success', 'error', 'info'),
        fc.string({ minLength: 1, maxLength: 200 }),
        (type, message) => {
          // Clear previous toasts
          const container = document.getElementById('toast-container');
          container.innerHTML = '';

          showToast(message, type, 999999); // long duration so it stays

          const toasts = container.querySelectorAll('.toast');
          expect(toasts.length).toBe(1);
          expect(toasts[0].classList.contains(type)).toBe(true);
          expect(toasts[0].classList.contains('toast')).toBe(true);
          expect(toasts[0].textContent).toBe(message);
        }
      ),
      FC_CONFIG
    );
  });

  it('should add multiple toasts to the container', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom('success', 'error', 'info'),
            message: fc.string({ minLength: 1, maxLength: 50 })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (toastItems) => {
          const container = document.getElementById('toast-container');
          container.innerHTML = '';

          toastItems.forEach(item => showToast(item.message, item.type, 999999));

          const toasts = container.querySelectorAll('.toast');
          expect(toasts.length).toBe(toastItems.length);
          toastItems.forEach((item, i) => {
            expect(toasts[i].classList.contains(item.type)).toBe(true);
            expect(toasts[i].textContent).toBe(item.message);
          });
        }
      ),
      FC_CONFIG
    );
  });
});
