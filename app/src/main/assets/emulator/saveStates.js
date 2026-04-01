// emulator/saveStates.js
// Save and load state via EmulatorJS toolbar buttons.
// Buttons are found by their text content — no title or aria-label available.

'use strict';

/**
 * Triggers a save state by clicking the EmulatorJS "Save State" toolbar button.
 * @returns {boolean}
 */
function triggerSave() {
  const btn = _findButtonByText('Save State');
  if (btn) { btn.click(); return true; }
  console.warn('[saveStates] Could not find "Save State" button');
  return false;
}

/**
 * Triggers a load state by clicking the EmulatorJS "Load State" toolbar button.
 * @returns {boolean}
 */
function triggerLoad() {
  const btn = _findButtonByText('Load State');
  if (btn) { btn.click(); return true; }
  console.warn('[saveStates] Could not find "Load State" button');
  return false;
}

/**
 * Clears EJS save/load callbacks on unload.
 */
function clearCallbacks() {
  try { delete window.EJS_onSaveState; } catch {}
  try { delete window.EJS_onLoadState; } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Finds an EmulatorJS toolbar button by its exact text content.
 * @param {string} text
 * @returns {HTMLElement | null}
 */
function _findButtonByText(text) {
  const candidates = document.querySelectorAll(
    '#ejs-player button, #ejs-player [role="button"]'
  );
  for (const el of candidates) {
    if (el.textContent.trim() === text) return el;
  }
  return null;
}

export { triggerSave, triggerLoad, clearCallbacks };
