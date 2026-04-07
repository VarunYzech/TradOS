import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupNavigation, navigateTo, startAutoRefresh, stopAutoRefresh } from '../../js/app.js';

/**
 * Helper: set up a minimal DOM matching index.html structure.
 */
function createDOM() {
  document.body.innerHTML = `
    <div id="toast-container"></div>
    <section id="section-home" class="section active"></section>
    <section id="section-stocks" class="section" hidden></section>
    <section id="section-calculator" class="section" hidden></section>
    <section id="section-utilities" class="section" hidden></section>
    <section id="section-reminders" class="section" hidden></section>
    <nav>
      <button class="nav-tab active" data-section="section-home">Home</button>
      <button class="nav-tab" data-section="section-stocks">Stocks</button>
      <button class="nav-tab" data-section="section-calculator">Calculator</button>
      <button class="nav-tab" data-section="section-utilities">Utilities</button>
      <button class="nav-tab" data-section="section-reminders">Reminders</button>
    </nav>
  `;
}

describe('setupNavigation', () => {
  beforeEach(() => createDOM());

  it('should attach click handlers to all nav tabs', () => {
    setupNavigation();

    // Click the Stocks tab
    const stocksTab = document.querySelector('[data-section="section-stocks"]');
    stocksTab.click();

    const stocksSection = document.getElementById('section-stocks');
    expect(stocksSection.classList.contains('active')).toBe(true);
    expect(stocksSection.hasAttribute('hidden')).toBe(false);
  });

  it('should navigate to the section matching the tab data-section attribute', () => {
    setupNavigation();

    const calcTab = document.querySelector('[data-section="section-calculator"]');
    calcTab.click();

    const calcSection = document.getElementById('section-calculator');
    expect(calcSection.classList.contains('active')).toBe(true);

    // Home should be hidden
    const homeSection = document.getElementById('section-home');
    expect(homeSection.classList.contains('active')).toBe(false);
    expect(homeSection.hasAttribute('hidden')).toBe(true);
  });
});

describe('navigateTo', () => {
  beforeEach(() => createDOM());

  it('should show exactly one section at a time', () => {
    navigateTo('section-stocks');

    const sections = document.querySelectorAll('.section');
    const visible = [...sections].filter(s => !s.hasAttribute('hidden'));
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('section-stocks');
  });

  it('should add active class to the target section and remove from others', () => {
    navigateTo('section-utilities');

    const sections = document.querySelectorAll('.section');
    const activeOnes = [...sections].filter(s => s.classList.contains('active'));
    expect(activeOnes).toHaveLength(1);
    expect(activeOnes[0].id).toBe('section-utilities');
  });

  it('should update the active nav tab to match the target section', () => {
    navigateTo('section-reminders');

    const tabs = document.querySelectorAll('.nav-tab');
    const activeTabs = [...tabs].filter(t => t.classList.contains('active'));
    expect(activeTabs).toHaveLength(1);
    expect(activeTabs[0].getAttribute('data-section')).toBe('section-reminders');
  });

  it('should hide all other sections when navigating', () => {
    navigateTo('section-calculator');

    const otherIds = ['section-home', 'section-stocks', 'section-utilities', 'section-reminders'];
    otherIds.forEach(id => {
      const el = document.getElementById(id);
      expect(el.hasAttribute('hidden')).toBe(true);
      expect(el.classList.contains('active')).toBe(false);
    });
  });

  it('should handle navigating to the already-active section gracefully', () => {
    navigateTo('section-home');

    const homeSection = document.getElementById('section-home');
    expect(homeSection.classList.contains('active')).toBe(true);
    expect(homeSection.hasAttribute('hidden')).toBe(false);
  });
});

describe('auto-refresh lifecycle', () => {
  beforeEach(() => {
    createDOM();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopAutoRefresh();
    vi.useRealTimers();
  });

  it('stopAutoRefresh should be safe to call when no interval is running', () => {
    expect(() => stopAutoRefresh()).not.toThrow();
  });

  it('startAutoRefresh should not create duplicate intervals on repeated calls', () => {
    const spy = vi.spyOn(global, 'setInterval');
    startAutoRefresh();
    startAutoRefresh();
    // setInterval may or may not be called depending on whether refreshStockData exists,
    // but it should not be called more than once
    expect(spy).toHaveBeenCalledTimes(spy.mock.calls.length <= 1 ? spy.mock.calls.length : 1);
    spy.mockRestore();
  });
});
