import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { FC_CONFIG } from '../setup.js';
import { navigateTo } from '../../js/app.js';

const SECTION_IDS = [
  'section-home',
  'section-stocks',
  'section-calculator',
  'section-utilities',
  'section-reminders'
];

beforeEach(() => {
  // Set up minimal DOM with sections and nav tabs
  document.body.innerHTML = `
    <main>
      ${SECTION_IDS.map((id, i) =>
        `<section id="${id}" class="section${i === 0 ? ' active' : ''}" ${i !== 0 ? 'hidden' : ''}></section>`
      ).join('\n')}
    </main>
    <nav>
      ${SECTION_IDS.map((id, i) =>
        `<button class="nav-tab${i === 0 ? ' active' : ''}" data-section="${id}"></button>`
      ).join('\n')}
    </nav>
  `;
});

// Property 16: navigateTo shows exactly one section
describe('Property 16: navigateTo shows exactly one section', () => {
  it('should show only the target section and hide all others', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SECTION_IDS),
        (sectionId) => {
          navigateTo(sectionId);

          const sections = document.querySelectorAll('.section');
          let visibleCount = 0;
          sections.forEach(section => {
            if (section.classList.contains('active') && !section.hasAttribute('hidden')) {
              visibleCount++;
              expect(section.id).toBe(sectionId);
            }
          });
          expect(visibleCount).toBe(1);
        }
      ),
      FC_CONFIG
    );
  });

  it('should set the correct nav tab as active', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SECTION_IDS),
        (sectionId) => {
          navigateTo(sectionId);

          const tabs = document.querySelectorAll('.nav-tab');
          let activeCount = 0;
          tabs.forEach(tab => {
            if (tab.classList.contains('active')) {
              activeCount++;
              expect(tab.getAttribute('data-section')).toBe(sectionId);
            }
          });
          expect(activeCount).toBe(1);
        }
      ),
      FC_CONFIG
    );
  });

  it('should work correctly when navigating between random sections', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SECTION_IDS),
        fc.constantFrom(...SECTION_IDS),
        (first, second) => {
          navigateTo(first);
          navigateTo(second);

          const sections = document.querySelectorAll('.section');
          const activeSections = [...sections].filter(
            s => s.classList.contains('active') && !s.hasAttribute('hidden')
          );
          expect(activeSections.length).toBe(1);
          expect(activeSections[0].id).toBe(second);
        }
      ),
      FC_CONFIG
    );
  });
});
