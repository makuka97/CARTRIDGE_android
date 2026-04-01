// renderer/views/library.js
// Game library grid with search, filter, tile animations, storage meter,
// and multi-select delete mode.

'use strict';

import { createTile } from '../components/tile.js';
import { SysNav }     from '../components/sysNav.js';
import { show as showToast } from '../components/toast.js';

const { sortSystems } = window.detector;

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

export class LibraryView {
  constructor() {
    this._scroll       = document.getElementById('lib-col__scroll');
    this._empty        = document.getElementById('lib-empty');
    this._searchEl     = document.getElementById('lib-search-input');
    this._navList      = document.getElementById('sys-nav-list');
    this._storageLabel = document.getElementById('storage-label');
    this._storageFill  = document.getElementById('storage-fill');

    // Select mode
    this._btnSelect    = document.getElementById('btn-select');
    this._selectBar    = document.getElementById('lib-select-bar');
    this._selectCount  = document.getElementById('select-count');
    this._btnDelete    = document.getElementById('btn-delete-selected');
    this._btnCancel    = document.getElementById('btn-select-cancel');

    this._games      = [];
    this._filter     = null;
    this._query      = '';
    this._selectMode = false;
    this._selected   = new Set(); // selected game IDs

    this._nav = new SysNav(this._navList);
  }

  async init({ animate = true } = {}) {
    this._games = await window.api.getAllGames();
    this._nav.update(this._games);
    this._renderGrid(animate);
    this._updateStorage();
    this._bindEvents();
  }

  appendGame(game) {
    this._games.push(game);
    this._nav.increment(game.system);
    this._updateStorage();

    if (this._matchesFilter(game) && this._matchesSearch(game)) {
      const section = this._getOrCreateSection(game.system);
      const tile    = createTile(game);
      tile.classList.add('tile--entering');
      this._bindTileSelect(tile, game.id);
      section.grid.appendChild(tile);
      requestAnimationFrame(() => tile.classList.add('tile--visible'));
      this._updateSectionCount(game.system);
    }

    this._updateEmptyState();
  }

  updateTileMeta(meta) {
    const tile = this._scroll.querySelector(`[data-id="${meta.id}"]`);
    if (!tile) return;

    if (meta.boxart) {
      const placeholder = tile.querySelector('.tile__art--placeholder');
      if (placeholder) {
        const img     = document.createElement('img');
        img.className = 'tile__art';
        // Convert absolute path to cartridge:// protocol URL
        const src = meta.boxart.startsWith('cartridge://')
          ? meta.boxart
          : 'cartridge://local/' + meta.boxart.replace(/\\/g, '/');
        img.src       = src;
        img.alt       = meta.name ?? '';
        img.loading   = 'lazy';
        placeholder.replaceWith(img);
      }
    }

    if (meta.name) {
      const nameEl = tile.querySelector('.tile__name');
      if (nameEl) nameEl.textContent = meta.name;
    }

    const game = this._games.find(g => g.id === meta.id);
    if (game) Object.assign(game, meta);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _bindEvents() {
    // Search
    this._searchEl.addEventListener('input', (e) => {
      this._query = e.target.value.trim().toLowerCase();
      this._renderGrid(false);
    });

    this._searchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._searchEl.value = '';
        this._query = '';
        this._renderGrid(false);
      }
    });

    // System filter
    window.addEventListener('sys:filter', (e) => {
      this._filter = e.detail.system;
      this._renderGrid(false);
    });

    // ROM imported
    window.addEventListener('rom:imported', (e) => this.appendGame(e.detail));

    // Scraper meta
    window.api.onMetaUpdated((data) => this.updateTileMeta(data));

    // Select mode toggle
    this._btnSelect.addEventListener('click', () => this._enterSelectMode());
    this._btnCancel.addEventListener('click', () => this._exitSelectMode());

    // Bulk delete
    this._btnDelete.addEventListener('click', () => this._deleteSelected());
  }

  // ── Select mode ───────────────────────────────────────────────────────────

  _enterSelectMode() {
    this._selectMode = true;
    this._selected.clear();
    this._scroll.classList.add('is-select-mode');
    this._btnSelect.classList.add('lib-toolbar__btn--active');
    this._selectBar.classList.add('is-visible');
    this._updateSelectBar();

    // Rebind all tiles for selection
    this._scroll.querySelectorAll('.tile').forEach(tile => {
      this._bindTileSelect(tile, tile.dataset.id);
    });
  }

  _exitSelectMode() {
    this._selectMode = false;
    this._selected.clear();
    this._scroll.classList.remove('is-select-mode');
    this._btnSelect.classList.remove('lib-toolbar__btn--active');
    this._selectBar.classList.remove('is-visible');

    // Clear all selected states
    this._scroll.querySelectorAll('.tile.is-selected')
      .forEach(t => t.classList.remove('is-selected'));
  }

  _bindTileSelect(tile, id) {
    // Remove any old select listener by cloning — clean approach
    const fresh = tile.cloneNode(true);
    tile.replaceWith(fresh);

    fresh.addEventListener('click', (e) => {
      if (!this._selectMode) return;
      e.stopPropagation();
      this._toggleTile(fresh, id);
    });

    return fresh;
  }

  _toggleTile(tile, id) {
    if (this._selected.has(id)) {
      this._selected.delete(id);
      tile.classList.remove('is-selected');
    } else {
      this._selected.add(id);
      tile.classList.add('is-selected');
    }
    this._updateSelectBar();
  }

  _updateSelectBar() {
    const n = this._selected.size;
    this._selectCount.textContent = `${n} selected`;
    this._btnDelete.disabled = n === 0;
  }

  async _deleteSelected() {
    const ids   = [...this._selected];
    const count = ids.length;
    if (count === 0) return;

    const confirmed = window.confirm(
      `Delete ${count} game${count !== 1 ? 's' : ''}? This cannot be undone.`
    );
    if (!confirmed) return;

    await window.api.deleteGames(ids);

    // Remove from internal state
    this._games = this._games.filter(g => !ids.includes(g.id));

    // Remove tiles from DOM
    for (const id of ids) {
      this._scroll.querySelector(`[data-id="${id}"]`)?.remove();
    }

    // Remove empty sections
    this._scroll.querySelectorAll('.lib-section').forEach(section => {
      if (section.querySelectorAll('.tile').length === 0) section.remove();
    });

    this._exitSelectMode();
    this._nav.update(this._games);
    this._updateStorage();
    this._updateEmptyState();

    showToast(
      `Deleted ${count} game${count !== 1 ? 's' : ''}`,
      'success'
    );
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _renderGrid(animate = false) {
    Array.from(this._scroll.children).forEach(el => {
      if (el !== this._empty) el.remove();
    });

    const visible = this._games.filter(g =>
      this._matchesFilter(g) && this._matchesSearch(g)
    );

    if (visible.length === 0) {
      this._updateEmptyState();
      return;
    }

    const bySystem = {};
    for (const game of visible) {
      (bySystem[game.system] ??= []).push(game);
    }

    let tileIndex = 0;
    for (const sys of sortSystems(Object.keys(bySystem))) {
      const section = this._createSection(sys, bySystem[sys], animate, tileIndex);
      this._scroll.appendChild(section.el);
      tileIndex += bySystem[sys].length;
    }

    this._updateEmptyState();
  }

  _createSection(system, games, animate, startIndex = 0) {
    const el = document.createElement('div');
    el.className      = 'lib-section';
    el.dataset.system = system;

    const header = document.createElement('div');
    header.className = 'lib-section__header';

    const dot = document.createElement('span');
    dot.className        = 'lib-section__dot';
    dot.style.background = `var(--color-${
      system === 'atari2600' || system === 'atari7800' ? 'atari' : system
    }, var(--color-text-muted))`;

    const title = document.createElement('span');
    title.className   = 'lib-section__title';
    title.textContent = SYSTEM_LABELS[system] ?? system;

    const count = document.createElement('span');
    count.className   = 'lib-section__count';
    count.textContent = `${games.length} game${games.length !== 1 ? 's' : ''}`;

    header.appendChild(dot);
    header.appendChild(title);
    header.appendChild(count);

    const grid = document.createElement('div');
    grid.className = 'lib-section__grid';

    games.forEach((game, i) => {
      const tile = createTile(game);
      if (animate) {
        tile.classList.add('tile--entering');
        tile.style.animationDelay = `${Math.min((startIndex + i) * 40, 400)}ms`;
        requestAnimationFrame(() => tile.classList.add('tile--visible'));
      }
      this._bindTileSelect(tile, game.id);
      grid.appendChild(tile);
    });

    el.appendChild(header);
    el.appendChild(grid);

    return { el, grid, count };
  }

  _getOrCreateSection(system) {
    const existing = this._scroll.querySelector(`[data-system="${system}"]`);
    if (existing) {
      return {
        el:    existing,
        grid:  existing.querySelector('.lib-section__grid'),
        count: existing.querySelector('.lib-section__count'),
      };
    }
    const section = this._createSection(system, [], false);
    this._scroll.appendChild(section.el);
    return section;
  }

  _updateSectionCount(system) {
    const el = this._scroll.querySelector(`[data-system="${system}"] .lib-section__count`);
    if (!el) return;
    const count = this._scroll.querySelectorAll(`[data-system="${system}"] .tile`).length;
    el.textContent = `${count} game${count !== 1 ? 's' : ''}`;
  }

  _updateStorage() {
    const count = this._games.length;
    if (this._storageLabel) {
      this._storageLabel.textContent = `${count} ROM${count !== 1 ? 's' : ''}`;
    }
    if (this._storageFill) {
      const pct = count === 0 ? 0 : Math.min((1 - Math.exp(-count / 50)) * 100, 99);
      this._storageFill.style.width = `${pct}%`;
    }
  }

  _matchesFilter(game) {
    return this._filter === null || game.system === this._filter;
  }

  _matchesSearch(game) {
    if (!this._query) return true;
    return game.name.toLowerCase().includes(this._query);
  }

  _updateEmptyState() {
    const hasVisible = this._scroll.querySelector('.tile') !== null;
    this._empty.style.display = hasVisible ? 'none' : 'flex';

    const titleEl = this._empty.querySelector('.lib-empty__title');
    const subEl   = this._empty.querySelector('.lib-empty__sub');

    if (!hasVisible && this._query) {
      if (titleEl) titleEl.textContent = 'No results';
      if (subEl)   subEl.textContent   = `Nothing matched "${this._query}"`;
    } else if (!hasVisible) {
      if (titleEl) titleEl.textContent = 'No games yet';
      if (subEl)   subEl.textContent   = 'Drop a ROM file into the zone on the right to get started.';
    }
  }
}
