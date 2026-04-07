import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showToast } from '../../js/app.js';

describe('Toast Notifications', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    vi.useFakeTimers();
  });

  afterEach(() => {
    container.remove();
    vi.useRealTimers();
  });

  it('creates a toast element with correct class and message', () => {
    showToast('Success!', 'success');
    const toast = container.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe('Success!');
    expect(toast.classList.contains('toast')).toBe(true);
    expect(toast.classList.contains('success')).toBe(true);
  });

  it('applies the error CSS class for error type', () => {
    showToast('Something failed', 'error');
    const toast = container.querySelector('.toast');
    expect(toast.classList.contains('error')).toBe(true);
  });

  it('applies the info CSS class for info type', () => {
    showToast('FYI', 'info');
    const toast = container.querySelector('.toast');
    expect(toast.classList.contains('info')).toBe(true);
  });

  it('auto-removes the toast after the default 3000ms duration', () => {
    showToast('Bye soon', 'success');
    expect(container.children.length).toBe(1);

    vi.advanceTimersByTime(3000);
    expect(container.children.length).toBe(0);
  });

  it('auto-removes the toast after a custom duration', () => {
    showToast('Custom', 'info', 1000);
    expect(container.children.length).toBe(1);

    vi.advanceTimersByTime(999);
    expect(container.children.length).toBe(1);

    vi.advanceTimersByTime(1);
    expect(container.children.length).toBe(0);
  });

  it('does nothing if toast-container is missing', () => {
    container.remove();
    expect(() => showToast('No container', 'error')).not.toThrow();
  });

  it('supports multiple toasts at the same time', () => {
    showToast('First', 'success');
    showToast('Second', 'error');
    expect(container.children.length).toBe(2);
  });
});
