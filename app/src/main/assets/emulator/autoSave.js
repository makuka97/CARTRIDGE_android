// emulator/autoSave.js
// Save states handled entirely by EmulatorJS built-in buttons.
// User manages their own save files — no interception.

'use strict';

export function setupSaveFolder(gameId, gameName) {
  // Nothing to set up — EmulatorJS handles everything natively
  console.info(`[save] Native save/load enabled for "${gameName}"`);
}

export async function showResumeOverlay()  { return; }
export async function handleSave()         { return false; }
export async function handleLoad()         { return false; }
export async function autoSave()           { return false; }
export async function autoLoad()           { return false; }
export async function quickLoad()          { return false; }
