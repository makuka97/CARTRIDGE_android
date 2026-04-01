// emulator/loader.js  (Android build)
// Same interface as desktop loader.js — only URL scheme generation differs.
// On Android, emulator/data/ lives in assets/ and is served via file:///android_asset/

'use strict';

let _active = false;

async function load({ romPath, core, container, gameId, gameName }) {
  if (_active) await unload();

  const ejsCore = CORE_MAP[core];
  if (!ejsCore) throw new Error(`Unknown core: ${core}`);

  const dataDir = appDataUrl();
  const romUrl  = romToUrl(romPath);

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
    gamepad:      true,   // shows EmulatorJS's own touch controls
    cheat:        false,
    volume:       true,
    saveSavFiles: false,
    quickSave:    false,
    quickLoad:    false,
  };

  // EmulatorJS touch controls enabled by default on mobile
  window.EJS_mobileControls = true;

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
};

/**
 * Returns the base URL for EmulatorJS data files.
 * Android: assets are served at file:///android_asset/
 */
function appDataUrl() {
  // androidApi.getAppDataUrl() returns "file:///android_asset/emulator/data/"
  if (window.androidApi) return window.androidApi.getAppDataUrl();
  // Fallback for desktop Electron build (should never be reached on Android)
  const appPath = window.__appPath;
  if (!appPath) throw new Error('window.__appPath not set');
  const normalized = appPath.replace(/\\/g, '/').replace(/\/$/, '');
  return `cartridge://local/${normalized}/emulator/data/`;
}

/**
 * Converts a ROM file path to a URL the WebView can fetch.
 * On Android, internal storage paths are served via a custom scheme
 * registered in MainActivity, or read directly as file:// URLs.
 * Internal app storage (/data/data/...) is accessible to the WebView
 * when allowFileAccess = true.
 */
function romToUrl(filePath) {
  if (filePath.startsWith('/')) {
    // Absolute path to internal storage — file:// works with allowFileAccess
    return `file://${filePath}`;
  }
  // Fallback: desktop cartridge:// scheme
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
