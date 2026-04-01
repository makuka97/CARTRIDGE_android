// renderer/views/game.js
// Fullscreen game view — launches in fullscreen, toggle via HUD button or F11.
// On exit, reloads the renderer for a clean WASM state.

'use strict';

import { load }                                from '../../emulator/loader.js';
import { clearCallbacks } from '../../emulator/saveStates.js';
import { startListening, stopListening }      from '../../input/keyboard.js';
import { startPolling,   stopPolling }        from '../../input/gamepad.js';
import { show as showToast }                  from '../components/toast.js';

const HUD_HIDE_DELAY = 3000;

export class GameView {
  constructor() {
    this._el          = null;
    this._hud         = null;
    this._hudTimer    = null;
    this._currentGame = null;
    this._onExit      = null;
  }

  async launch(game, onExit) {
    this._currentGame = game;
    this._onExit      = onExit;

    this._buildDOM();
    document.getElementById('app').appendChild(this._el);

    // Enter fullscreen immediately on launch
    await this._enterFullscreen();

    await new Promise(r => setTimeout(r, 50));

    try {
      await load({ romPath: game.romPath, core: game.core, container: this._el, gameId: game.gameId, gameName: game.name });
    } catch (err) {
      console.error('[GameView] Failed to load emulator:', err);
      showToast(`Failed to load: ${err.message}`, 'error');
      await this._exit();
      return;
    }

    this._bindInput();
    this._showHud();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _buildDOM() {
    const el = document.createElement('div');
    el.id        = 'game-view';
    el.className = 'game-view';

    document.getElementById('ejs-player')?.remove();

    const player = document.createElement('div');
    player.id = 'ejs-player';

    const hud = document.createElement('div');
    hud.className = 'game-hud';
    hud.innerHTML = `
      <div class="game-hud__inner">
        <div class="game-hud__left">
          <span class="game-hud__title"></span>
        </div>
        <div class="game-hud__right">
          <button class="game-hud__btn" id="hud-fullscreen" title="Toggle Fullscreen (F11)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" id="hud-fs-icon">
              <path d="M1.5 1h4a.5.5 0 0 1 0 1H2v3.5a.5.5 0 0 1-1 0V1.5A.5.5 0 0 1 1.5 1zm9 0a.5.5 0 0 1 .5.5V5a.5.5 0 0 1-1 0V2h-3.5a.5.5 0 0 1 0-1h4zM1 10.5a.5.5 0 0 1 .5-.5H5a.5.5 0 0 1 0 1H2v3a.5.5 0 0 1-1 0v-3.5zm14 0v3.5a.5.5 0 0 1-1 0V11h-3.5a.5.5 0 0 1 0-1H15a.5.5 0 0 1 .5.5z"/>
            </svg>
            <span id="hud-fs-label">Windowed</span><kbd>F11</kbd>
          </button>
          <div class="game-hud__divider"></div>
          <button class="game-hud__btn game-hud__btn--exit" id="hud-exit" title="Exit to Library (ESC)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 12.796V3.204L11.481 8 6 12.796zm.659.753 5.48-4.796a1 1 0 0 0 0-1.506L6.66 2.451C6.011 1.885 5 2.345 5 3.204v9.592a1 1 0 0 0 1.659.753z"/>
            </svg>
            <span>Exit</span><kbd>ESC</kbd>
          </button>
        </div>
      </div>
    `;

    hud.querySelector('.game-hud__title').textContent = this._currentGame?.name ?? '';

    el.appendChild(player);
    el.appendChild(hud);

    this._el  = el;
    this._hud = hud;

    hud.querySelector('#hud-fullscreen').addEventListener('click', () => this._toggleFullscreen());
    hud.querySelector('#hud-exit').addEventListener('click', () => this._exit());

    document.addEventListener('fullscreenchange', () => this._updateFullscreenBtn());
  }

  _bindInput() {
    startListening({
      onExit:       () => this._exit(),
      onFullscreen: () => this._toggleFullscreen(),
    });
    startPolling({
      onExit: () => this._exit(),
    });
    this._mouseMoveHandler = () => this._showHud();
    this._el.addEventListener('mousemove', this._mouseMoveHandler);
  }

  async _enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
      this._updateFullscreenBtn();
    } catch {}
  }

  async _toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      this._updateFullscreenBtn();
    } catch {}
  }

  _updateFullscreenBtn() {
    const isFs    = !!document.fullscreenElement;
    const label   = document.getElementById('hud-fs-label');
    const icon    = document.getElementById('hud-fs-icon');
    if (label) label.textContent = isFs ? 'Windowed' : 'Fullscreen';
    if (icon) {
      icon.innerHTML = isFs
        // Compress icon (exit fullscreen)
        ? '<path d="M5.5 0a.5.5 0 0 1 .5.5v4A.5.5 0 0 1 5.5 5h-4a.5.5 0 0 1 0-1H5V.5a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5V5h3.5a.5.5 0 0 1 0 1h-4A.5.5 0 0 1 10 5.5v-5a.5.5 0 0 1 .5-.5zM0 10.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V11H.5a.5.5 0 0 1-.5-.5zm10 0a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H11v3.5a.5.5 0 0 1-1 0v-4z"/>'
        // Expand icon (enter fullscreen)
        : '<path d="M1.5 1h4a.5.5 0 0 1 0 1H2v3.5a.5.5 0 0 1-1 0V1.5A.5.5 0 0 1 1.5 1zm9 0a.5.5 0 0 1 .5.5V5a.5.5 0 0 1-1 0V2h-3.5a.5.5 0 0 1 0-1h4zM1 10.5a.5.5 0 0 1 .5-.5H5a.5.5 0 0 1 0 1H2v3a.5.5 0 0 1-1 0v-3.5zm14 0v3.5a.5.5 0 0 1-1 0V11h-3.5a.5.5 0 0 1 0-1H15a.5.5 0 0 1 .5.5z"/>';
    }
  }

  _showHud() {
    this._hud.classList.add('is-visible');
    clearTimeout(this._hudTimer);
    this._hudTimer = setTimeout(() => {
      this._hud.classList.remove('is-visible');
    }, HUD_HIDE_DELAY);
  }

  async _exit() {
    clearTimeout(this._hudTimer);
    stopListening();
    stopPolling();
    clearCallbacks();

    // Exit fullscreen before reloading
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}

    sessionStorage.setItem('cartridge:exiting', '1');
    window.location.reload();
  }
}
