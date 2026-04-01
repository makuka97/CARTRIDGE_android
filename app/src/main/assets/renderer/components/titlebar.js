// renderer/components/titlebar.js
// Wires the custom titlebar window control buttons to the IPC bridge.

'use strict';

export function initTitlebar() {
  if (!window.api) {
    console.error('[titlebar] window.api is not defined — preload may have failed');
    return;
  }

  document.getElementById('btn-minimize')
    ?.addEventListener('click', () => window.api.minimizeWindow());

  document.getElementById('btn-maximize')
    ?.addEventListener('click', () => window.api.maximizeWindow());

  document.getElementById('btn-close')
    ?.addEventListener('click', () => window.api.closeWindow());

  document.getElementById('btn-settings')
    ?.addEventListener('click', () => {
      // Handled in app.js — dispatches to SettingsView
    });
}
