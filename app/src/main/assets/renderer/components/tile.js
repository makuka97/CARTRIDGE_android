// renderer/components/tile.js
// Creates and returns a game tile DOM element.

'use strict';

// Clean SVG icons per system — no emojis
const SYSTEM_ICONS = {
  nes:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="17" cy="12" r="2"/><circle cx="14" cy="12" r="2" fill="currentColor" stroke="none" opacity="0.3"/><rect x="4" y="10" width="4" height="4" rx="1"/></svg>`,
  snes:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="17" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="14" cy="9" r="1.5" fill="currentColor" stroke="none"/><circle cx="20" cy="9" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="6" r="1.5" fill="currentColor" stroke="none"/><rect x="4" y="10" width="5" height="3" rx="1"/></svg>`,
  gba:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="3" width="16" height="18" rx="4"/><rect x="7" y="9" width="10" height="7" rx="1"/><circle cx="16" cy="17" r="1.2" fill="currentColor" stroke="none"/><circle cx="14" cy="19" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  gbc:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="3"/><rect x="7" y="6" width="10" height="8" rx="1"/><circle cx="15" cy="17" r="1.2" fill="currentColor" stroke="none"/><circle cx="13" cy="19" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  gb:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="3"/><rect x="7" y="6" width="10" height="8" rx="1"/><circle cx="15" cy="17" r="1.2" fill="currentColor" stroke="none"/><circle cx="13" cy="19" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  genesis:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M8 12h2M14 12h2"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg>`,
  atari2600: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6" width="18" height="12" rx="2"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="7" y1="9" x2="7" y2="15"/><line x1="17" y1="9" x2="17" y2="15"/></svg>`,
  atari7800: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6" width="18" height="12" rx="2"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="7" y1="9" x2="7" y2="15"/><line x1="17" y1="9" x2="17" y2="15"/></svg>`,
};

const DEFAULT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="16" cy="12" r="2"/><rect x="4" y="10" width="4" height="4" rx="1"/></svg>`;

export function createTile(game) {
  const tile = document.createElement('div');
  tile.className  = 'tile';
  tile.dataset.id = game.id;
  tile.setAttribute('role', 'button');
  tile.setAttribute('tabindex', '0');
  tile.setAttribute('aria-label', game.name);

  // Art area
  const artEl = document.createElement('div');
  artEl.className = 'tile__art--placeholder';

  if (game.boxart) {
    const img = document.createElement('img');
    img.className = 'tile__art';
    const src = game.boxart.startsWith('cartridge://')
      ? game.boxart
      : 'cartridge://local/' + game.boxart.replace(/\\/g, '/');
    img.src       = src;
    img.alt       = game.name;
    img.loading   = 'lazy';
    img.onerror   = () => img.replaceWith(makePlaceholder(game));
    artEl.appendChild(img);
  } else {
    artEl.appendChild(makePlaceholder(game));
  }

  // Info area
  const info = document.createElement('div');
  info.className = 'tile__info';

  const name = document.createElement('div');
  name.className   = 'tile__name';
  name.textContent = game.name;

  const system = document.createElement('div');
  system.className   = 'tile__system';
  system.textContent = game.label ?? game.system?.toUpperCase() ?? '';

  info.appendChild(name);
  info.appendChild(system);
  tile.appendChild(artEl);
  tile.appendChild(info);

  tile.addEventListener('click', () => {
    tile.dispatchEvent(new CustomEvent('game:launch', {
      bubbles: true,
      detail: { gameId: game.id, romPath: game.rom_path, core: game.core }
    }));
  });

  tile.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') tile.click();
  });

  return tile;
}

function makePlaceholder(game) {
  const el = document.createElement('div');
  el.className = 'tile__art--placeholder';

  const icon = document.createElement('div');
  icon.className = 'tile__icon';
  icon.innerHTML = SYSTEM_ICONS[game.system] ?? DEFAULT_ICON;
  icon.style.color = `var(--color-${
    game.system === 'atari2600' || game.system === 'atari7800' ? 'atari' : game.system
  }, var(--color-text-muted))`;

  el.appendChild(icon);
  return el;
}
