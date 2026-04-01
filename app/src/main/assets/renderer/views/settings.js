// renderer/views/settings.js
// Settings modal — keyboard shortcut remapping.
// Opens from the gear icon in the titlebar.
// Shows current bindings, lets user click Remap then press a new key,
// and persists changes via window.api.setInputMap().

'use strict';

import { getMap, setBinding, saveMap, resetToDefaults, getLabel, getActions } from '../../input/keyMap.js';
import { show as showToast } from '../components/toast.js';

export class SettingsView {
  constructor() {
    this._el        = null;
    this._remapping = null; // action currently being remapped
    this._keyHandler = null;
  }

  /**
   * Opens the settings modal.
   */
  open() {
    if (this._el) return; // Already open
    this._build();
    document.getElementById('app').appendChild(this._el);
    requestAnimationFrame(() => this._el.classList.add('is-open'));
  }

  /**
   * Closes the settings modal.
   */
  close() {
    if (!this._el) return;
    this._cancelRemap();
    this._el.classList.remove('is-open');
    this._el.addEventListener('transitionend', () => {
      this._el?.remove();
      this._el = null;
    }, { once: true });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _build() {
    const el = document.createElement('div');
    el.className = 'settings-overlay';

    el.innerHTML = `
      <div class="settings-modal">
        <div class="settings-header">
          <h2 class="settings-title">Settings</h2>
          <button class="settings-close" id="settings-close" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <line x1="1" y1="1" x2="11" y2="11"/>
              <line x1="11" y1="1" x2="1" y2="11"/>
            </svg>
          </button>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Keyboard Shortcuts</div>
          <p class="settings-section-desc">These control CARTRIDGE — not the game itself. Game controls are remapped inside the emulator settings.</p>
          <div class="settings-bindings" id="settings-bindings"></div>
        </div>

        <div class="settings-section" style="border-top: 1px solid var(--color-border);">
          <div class="settings-section-title">Box Art Scraper</div>
          <p class="settings-section-desc">Enter your free <a href="https://www.steamgriddb.com/profile/preferences/api" target="_blank" style="color: var(--color-accent);">SteamGridDB</a> API key to automatically fetch box art when you add ROMs.</p>
          <div class="settings-bindings">
            <div class="binding-row">
              <span class="binding-label">API Key</span>
              <input class="settings-input" id="scraper-apikey" type="password" placeholder="SteamGridDB API key" autocomplete="off" spellcheck="false"/>
            </div>
          </div>
          <div style="margin-top: 12px;">
            <button class="settings-btn settings-btn--ghost" id="scraper-scrape-all">
              🎨 Scrape All Missing Art
            </button>
            <p style="margin-top: 6px; font-size: 11px; color: var(--color-text-muted);">
              Fetches art for all ROMs that don't have it yet. Save settings first.
            </p>
          </div>
        </div>

        <div class="settings-footer">
          <button class="settings-btn settings-btn--ghost" id="settings-reset">Reset to Defaults</button>
          <button class="settings-btn settings-btn--primary" id="settings-save">Save</button>
        </div>
      </div>
    `;

    this._el = el;
    this._renderBindings();
    this._loadCredentials();

    // Close on overlay click
    el.addEventListener('click', (e) => {
      if (e.target === el) this.close();
    });

    el.querySelector('#settings-close').addEventListener('click', () => this.close());

    el.querySelector('#settings-save').addEventListener('click', async () => {
      await saveMap();
      await this._saveCredentials();
      showToast('Settings saved', 'success');
      this.close();
    });

    el.querySelector('#settings-reset').addEventListener('click', () => {
      resetToDefaults();
      this._renderBindings();
      showToast('Reset to defaults', 'info');
    });

    el.querySelector('#scraper-scrape-all').addEventListener('click', async () => {
      await this._saveCredentials();
      const btn = el.querySelector('#scraper-scrape-all');
      btn.disabled = true;
      btn.textContent = '⏳ Scraping...';
      showToast('Scraping missing art — this may take a while', 'info');
      try {
        const result = await window.api.scrapeAll();
        if (result.ok) {
          showToast(`Done! Scraped ${result.scraped} game${result.scraped !== 1 ? 's' : ''}`, 'success');
        } else {
          showToast(`Scrape failed: ${result.error}`, 'error');
        }
      } catch (err) {
        showToast('Scrape failed — check credentials', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '🎨 Scrape All Missing Art';
      }
    });

    // ESC closes settings
    this._escHandler = (e) => {
      if (e.key === 'Escape') {
        if (this._remapping) {
          this._cancelRemap();
        } else {
          this.close();
        }
      }
    };
    window.addEventListener('keydown', this._escHandler);
  }

  async _loadCredentials() {
    const creds = await window.api.getScraperCredentials();
    if (!creds) return;
    const k = this._el?.querySelector('#scraper-apikey');
    if (k) k.value = creds.apiKey ?? '';
  }

  async _saveCredentials() {
    const apiKey = this._el?.querySelector('#scraper-apikey')?.value?.trim();
    if (apiKey) {
      await window.api.setScraperCredentials({ apiKey });
    } else {
      await window.api.clearScraperCredentials();
    }
  }

  _renderBindings() {
    const container = this._el?.querySelector('#settings-bindings');
    if (!container) return;

    container.innerHTML = '';
    const map = getMap();

    for (const action of getActions()) {
      const row = document.createElement('div');
      row.className      = 'binding-row';
      row.dataset.action = action;

      const label = document.createElement('span');
      label.className   = 'binding-label';
      label.textContent = getLabel(action);

      const key = document.createElement('span');
      key.className   = 'binding-key';
      key.textContent = map[action] ?? '—';

      const btn = document.createElement('button');
      btn.className   = 'binding-btn';
      btn.textContent = 'Remap';
      btn.addEventListener('click', () => this._startRemap(action, key, btn));

      row.appendChild(label);
      row.appendChild(key);
      row.appendChild(btn);
      container.appendChild(row);
    }
  }

  _startRemap(action, keyEl, btn) {
    // Cancel any existing remap
    this._cancelRemap();

    this._remapping = action;
    keyEl.textContent = 'Press a key…';
    keyEl.classList.add('is-listening');
    btn.textContent = 'Cancel';
    btn.classList.add('binding-btn--cancel');

    // Re-wire the cancel button
    btn.onclick = () => this._cancelRemap();

    this._keyHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier-only keypresses
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      setBinding(action, e.key);
      keyEl.textContent = e.key;
      keyEl.classList.remove('is-listening');
      btn.textContent = 'Remap';
      btn.classList.remove('binding-btn--cancel');
      btn.onclick = () => this._startRemap(action, keyEl, btn);

      this._remapping = null;
      window.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    };

    // Use capture so we intercept before anything else
    window.addEventListener('keydown', this._keyHandler, true);
  }

  _cancelRemap() {
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }
    this._remapping = null;
    this._renderBindings(); // Reset visual state
  }
}
