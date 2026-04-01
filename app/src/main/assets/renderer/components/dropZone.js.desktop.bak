// renderer/components/dropZone.js
// Handles drag-and-drop visual state and ROM import pipeline.
// Sends dropped file paths to main via window.api.importRom(),
// shows a toast result, and fires a 'rom:imported' custom event
// so the library view can append the new tile.

'use strict';

import { show as showToast } from './toast.js';

/**
 * Handles a single dropped file — imports it and fires events/toasts.
 * @param {File} file
 */
async function handleDrop(file) {
  const result = await window.api.importRom(file.path);

  if (result.error === 'unsupported') {
    showToast(`Unsupported format ${result.ext}`, 'error');
    return;
  }

  if (result.duplicate) {
    showToast(`Already in library: ${result.game.name}`, 'info');
    return;
  }

  if (result.error) {
    showToast(`Import failed: ${result.error}`, 'error');
    return;
  }

  showToast(`Added: ${result.game.name}`, 'success');

  // Notify the library view to append the new tile
  window.dispatchEvent(new CustomEvent('rom:imported', { detail: result.game }));
}

export function initDropZone() {
  const zone = document.getElementById('drop-zone');
  if (!zone) return;

  // Track drag depth so we don't flicker when cursor moves between child elements
  let dragDepth = 0;

  // Prevent browser from navigating to dropped files anywhere in the window
  document.addEventListener('dragover',  (e) => e.preventDefault());
  document.addEventListener('drop',      (e) => e.preventDefault());

  zone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    zone.classList.add('is-drag-over');
  });

  zone.addEventListener('dragleave', () => {
    dragDepth--;
    if (dragDepth <= 0) {
      dragDepth = 0;
      zone.classList.remove('is-drag-over');
    }
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    zone.classList.remove('is-drag-over');

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      await handleDrop(file);
    }
  });
}
