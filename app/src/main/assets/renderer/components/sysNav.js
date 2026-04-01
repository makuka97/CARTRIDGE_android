// renderer/components/sysNav.js
// Renders the system nav list and emits filter events when a system is clicked.

'use strict';

const { systemColor, sortSystems } = window.detector;

const SYSTEM_LABELS = {
  nes:       'Nintendo NES',
  snes:      'Super Nintendo',
  gba:       'Game Boy Advance',
  gbc:       'Game Boy Color',
  gb:        'Game Boy',
  genesis:   'Sega Genesis',
  atari2600: 'Atari 2600',
  atari7800: 'Atari 7800',
};

export class SysNav {
  constructor(listEl) {
    this._list    = listEl;
    this._counts  = {}; // system → count
    this._active  = null; // currently selected system or null (= All)
  }

  /**
   * Rebuilds the nav from the current games array.
   * @param {GameRow[]} games
   */
  update(games) {
    // Recalculate counts
    this._counts = {};
    for (const game of games) {
      this._counts[game.system] = (this._counts[game.system] ?? 0) + 1;
    }
    this._render();
  }

  /**
   * Increments the count for one system (called after a ROM is imported).
   * @param {string} system
   */
  increment(system) {
    this._counts[system] = (this._counts[system] ?? 0) + 1;
    this._render();
  }

  _render() {
    this._list.innerHTML = '';

    // "All" item
    this._list.appendChild(this._makeItem(null, 'All Games',
      Object.values(this._counts).reduce((a, b) => a + b, 0),
      'var(--color-accent)'
    ));

    // One item per system, in canonical order
    const systems = sortSystems(Object.keys(this._counts));
    for (const sys of systems) {
      this._list.appendChild(
        this._makeItem(sys, SYSTEM_LABELS[sys] ?? sys, this._counts[sys], systemColor(sys))
      );
    }
  }

  _makeItem(system, label, count, color) {
    const li = document.createElement('li');
    li.className = 'sys-nav__item' + (this._active === system ? ' is-active' : '');

    const dot = document.createElement('span');
    dot.className        = 'sys-nav__dot';
    dot.style.background = color;

    const labelEl = document.createElement('span');
    labelEl.className   = 'sys-nav__label';
    labelEl.textContent = label;

    const countEl = document.createElement('span');
    countEl.className   = 'sys-nav__count';
    countEl.textContent = count;

    li.appendChild(dot);
    li.appendChild(labelEl);
    li.appendChild(countEl);

    li.addEventListener('click', () => {
      this._active = system;
      this._render();
      window.dispatchEvent(new CustomEvent('sys:filter', { detail: { system } }));
    });

    return li;
  }
}
