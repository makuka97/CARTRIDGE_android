// emulator/loader.js
// Interface between CARTRIDGE and EmulatorJS WASM cores.
// All cores run locally — no internet required after npm run download-cores.

'use strict';

let _active = false;

async function load({ romPath, core, container, gameId, gameName }) {
  if (_active) await unload();

  const ejsCore = CORE_MAP[core];
  if (!ejsCore) throw new Error(`Unknown core: ${core}`);

  const dataDir = appDataUrl();
  const romUrl  = pathToFileUrl(romPath);

  await _purge();

  window.EJS_player           = '#ejs-player';
  window.EJS_core             = ejsCore;
  window.EJS_gameUrl          = romUrl;
  window.EJS_pathtodata       = dataDir;
  window.EJS_startOnLoaded    = true;
  window.EJS_color            = '#7c73ff';
  window.EJS_backgroundColor  = '#1a1d2e';
  window.EJS_adUrl            = '';
  window.EJS_gameName         = '';

  window.EJS_Buttons = {
    playPause:    true,
    restart:      false,
    mute:         true,
    settings:     true,
    fullscreen:   false,
    saveState:    true,
    loadState:    true,
    screenRecord: false,
    gamepad:      true,
    cheat:        false,
    volume:       true,
    saveSavFiles: false,
    quickSave:    false,
    quickLoad:    false,
  };

  await injectScript(`${dataDir}loader.js`, container);
  _active = true;
}

async function unload() {
  if (!_active) return;
  _active = false;

  try { window.EJS_emulator?.pause?.(); } catch {}

  try {
    const ctx = window.EJS_emulator?.audioContext
             ?? window.EJS_audioContext
             ?? window.audioContext;
    if (ctx && typeof ctx.state === 'string' && ctx.state !== 'closed') {
      await ctx.suspend().catch(() => {});
      await ctx.close().catch(() => {});
    }
  } catch {}

  await _purge();
  await new Promise(r => setTimeout(r, 200));
}

function isActive() { return _active; }

async function _purge() {
  const ejsKeys = Object.keys(window).filter(k => k.startsWith('EJS_'));
  for (const key of ejsKeys) {
    try { delete window[key]; } catch {}
  }
  document.querySelectorAll('script[data-ejs]').forEach(s => s.remove());
  document.querySelectorAll('link[href*="emulator"], style[data-ejs]').forEach(s => s.remove());
  const player = document.getElementById('ejs-player');
  if (player) player.innerHTML = '';
}

const CORE_MAP = {
  'fceumm.wasm':           'fceumm',
  'snes9x.wasm':           'snes9x',
  'mgba.wasm':             'mgba',
  'genesis_plus_gx.wasm':  'genesis_plus_gx',
  'stella.wasm':           'stella2014',
  'prosystem.wasm':        'prosystem',
  'mupen64plus_next.wasm': 'mupen64plus_next', // kept for backward compat, won't be downloaded
};

function appDataUrl() {
  const appPath = window.__appPath;
  if (!appPath) throw new Error('window.__appPath not set — check preload.js');
  const normalized = appPath.replace(/\\/g, '/').replace(/\/$/, '');
  return `cartridge://local/${normalized}/emulator/data/`;
}

function pathToFileUrl(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return `cartridge://local/${normalized}`;
}

function injectScript(src, container) {
  return new Promise((resolve, reject) => {
    const script       = document.createElement('script');
    script.src         = src;
    script.dataset.ejs = 'true';
    script.onload      = resolve;
    script.onerror     = () => reject(new Error(`Failed to load: ${src}`));
    container.appendChild(script);
  });
}

export { load, unload, isActive };
