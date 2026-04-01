/**
 * bridge-init.js
 * Injected by WebViewActivity before the renderer loads.
 *
 * Translates the existing window.api.* interface (from Electron's preload.js)
 * into calls to window.androidApi (the JavascriptInterface).
 *
 * The renderer HTML/JS files are UNCHANGED — they still call window.api.*
 * exactly as on desktop. This shim is the only glue layer needed.
 */

(function () {
  'use strict';

  // ── Callback registries (async results from Kotlin → JS) ──────────────────
  let _importCallback   = null;
  let _scanCallback     = null;
  let _progressCallback = null;
  let _deletedCallback  = null;
  const _metaListeners  = [];

  // Called by Kotlin bridge after importRomFromUri()
  window.__onRomImported = function (result) {
    _importCallback?.(result);
    _importCallback = null;

    if (!result.error && !result.duplicate) {
      // Notify the library view the same way desktop does
      window.dispatchEvent(new CustomEvent('rom:imported', { detail: result.game }));
    }
  };

  // Called by Kotlin bridge during scanFolderTree() — progress updates
  window.__onScanProgress = function (progress) {
    _progressCallback?.(progress);
  };

  // Called by Kotlin bridge when scanFolderTree() finishes
  window.__onScanComplete = function (result) {
    _scanCallback?.(result);
    _scanCallback    = null;
    _progressCallback = null;

    // Fire rom:imported for each newly imported game so library tiles appear
    if (result.imported) {
      result.imported.forEach(game => {
        window.dispatchEvent(new CustomEvent('rom:imported', { detail: game }));
      });
    }
  };

  // Called by Kotlin after deleteGames()
  window.__onGamesDeleted = function (ids) {
    _deletedCallback?.(ids);
    _deletedCallback = null;
  };

  // Called by Kotlin when scraper updates metadata (same event as desktop)
  window.__onMetaUpdated = function (updates) {
    _metaListeners.forEach(cb => cb(updates));
  };

  // ── Set window.__appPath so loader.js can locate emulator/data/ ───────────
  window.__appPath = '';          // Not used on Android — loader.js reads EJS_pathtodata directly

  // ── Expose detector (inlined from preload.js) ─────────────────────────────
  const EXTENSION_MAP = {
    nes:  { system: 'nes',       core: 'fceumm.wasm',          label: 'Nintendo NES' },
    smc:  { system: 'snes',      core: 'snes9x.wasm',          label: 'Super Nintendo' },
    snes: { system: 'snes',      core: 'snes9x.wasm',          label: 'Super Nintendo' },
    sfc:  { system: 'snes',      core: 'snes9x.wasm',          label: 'Super Nintendo' },
    gb:   { system: 'gb',        core: 'mgba.wasm',            label: 'Game Boy' },
    gbc:  { system: 'gbc',       core: 'mgba.wasm',            label: 'Game Boy Color' },
    gba:  { system: 'gba',       core: 'mgba.wasm',            label: 'Game Boy Advance' },
    md:   { system: 'genesis',   core: 'genesis_plus_gx.wasm', label: 'Sega Genesis' },
    gen:  { system: 'genesis',   core: 'genesis_plus_gx.wasm', label: 'Sega Genesis' },
    smd:  { system: 'genesis',   core: 'genesis_plus_gx.wasm', label: 'Sega Genesis' },
    bin:  { system: 'genesis',   core: 'genesis_plus_gx.wasm', label: 'Sega Genesis' },
    a26:  { system: 'atari2600', core: 'stella.wasm',          label: 'Atari 2600' },
    a78:  { system: 'atari7800', core: 'prosystem.wasm',       label: 'Atari 7800' },
  };
  const SYSTEM_ORDER = ['nes', 'snes', 'gba', 'gbc', 'gb', 'genesis', 'atari2600', 'atari7800'];

  window.detector = {
    detect(filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      return EXTENSION_MAP[ext] ?? null;
    },
    systemColor(system) {
      const colors = {
        nes: 'var(--color-nes)', snes: 'var(--color-snes)', gba: 'var(--color-gba)',
        gbc: 'var(--color-gb)',  gb:   'var(--color-gb)',   genesis: 'var(--color-genesis)',
        atari2600: 'var(--color-atari)', atari7800: 'var(--color-atari)',
      };
      return colors[system] ?? 'var(--color-text-muted)';
    },
    sortSystems(systems) {
      return [...systems].sort((a, b) => {
        const ia = SYSTEM_ORDER.indexOf(a), ib = SYSTEM_ORDER.indexOf(b);
        return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
      });
    },
  };

  // ── window.api shim — mirrors preload.js contextBridge.exposeInMainWorld ──
  window.api = {

    // ROM import — opens file picker, resolves when Kotlin calls __onRomImported
    importRom(filePath) {
      return new Promise(resolve => {
        _importCallback = resolve;
        window.androidApi.openFilePicker();
      });
    },

    // Library queries — synchronous JavascriptInterface calls returning JSON
    getAllGames() {
      return Promise.resolve(JSON.parse(window.androidApi.getAllGames()));
    },
    getGamesBySystem(system) {
      return Promise.resolve(JSON.parse(window.androidApi.getGamesBySystem(system)));
    },
    deleteGames(ids) {
      return new Promise(resolve => {
        _deletedCallback = resolve;
        window.androidApi.deleteGames(JSON.stringify(ids));
      });
    },

    // Save states
    getGameSaveDir(gameId)           { return Promise.resolve(window.androidApi.getSaveDir(gameId)); },
    getSaveFiles(gameId)             { return Promise.resolve(JSON.parse(window.androidApi.getSaveFiles(gameId))); },
    writeState(filePath, base64)     { return Promise.resolve(JSON.parse(window.androidApi.writeState(filePath, base64))); },
    readState(filePath)              { return Promise.resolve(window.androidApi.readState(filePath)); },

    // Dialogs — on Android we use our own in-app save/load sheet instead of native dialogs
    showSaveDialog(defaultName)      { return Promise.resolve(`${window.androidApi.getSaveDir('')}/${defaultName}`); },
    showLoadDialog()                 { return Promise.resolve(null); }, // TODO Phase 3 bottom sheet

    // Input map — not used on Android (touch controls handle this)
    getInputMap()                    { return Promise.resolve({}); },
    setInputMap()                    { return Promise.resolve({ ok: true }); },

    // Meta update listener (scraper pushes updates)
    onMetaUpdated(cb)                { _metaListeners.push(cb); },

    // Scraper credentials — stored in SharedPreferences (via androidApi)
    getScraperCredentials()          { return Promise.resolve(null); },
    setScraperCredentials()          { return Promise.resolve({ ok: true }); },
    clearScraperCredentials()        { return Promise.resolve({ ok: true }); },
    scrapeAll()                      { return Promise.resolve({ ok: false }); },

    // Window controls — no-ops on Android
    minimizeWindow()                 {},
    maximizeWindow()                 {},
    closeWindow()                    {},

    // ── Android-only extras (used by modified dropZone / library view) ──────
    openFolderPicker(onProgress) {
      return new Promise(resolve => {
        _scanCallback     = resolve;
        _progressCallback = onProgress ?? null;
        window.androidApi.openFolderPicker();
      });
    },

    getPlatform()                    { return window.androidApi.getPlatform(); },
  };

  console.log('[CartridgeBridge] window.api shim installed — platform: android');
})();
