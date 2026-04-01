// renderer/app.js
// App bootstrap. After a game exits, the page reloads for a clean WASM state.
// On reload, we skip animations and restore the library immediately.

'use strict';

import { initTitlebar }  from './components/titlebar.js';
import { initDropZone }  from './components/dropZone.js';
import { LibraryView }   from './views/library.js';
import { GameView }      from './views/game.js';
import { SettingsView }  from './views/settings.js';
import { loadMap }       from '../input/keyMap.js';

document.addEventListener('DOMContentLoaded', async () => {
  await loadMap();

  initTitlebar();
  initDropZone();

  const library  = new LibraryView();
  const gameView = new GameView();
  const settings = new SettingsView();

  const returning = sessionStorage.getItem('cartridge:exiting') === '1';
  if (returning) sessionStorage.removeItem('cartridge:exiting');

  await library.init({ animate: !returning });

  document.getElementById('btn-settings')
    ?.addEventListener('click', () => settings.open());

  document.addEventListener('game:launch', async (e) => {
    const { gameId, romPath, core, quickLoad } = e.detail;

    const games = await window.api.getAllGames();
    const game  = games.find(g => g.id === gameId)
               ?? { gameId, romPath, core, name: 'Unknown Game' };

    document.getElementById('shell').style.display    = 'none';
    document.getElementById('titlebar').style.display = 'none';

    await gameView.launch(
      { gameId, romPath, core, name: game.name, quickLoad: quickLoad ?? false },
      () => {
        document.getElementById('shell').style.display    = '';
        document.getElementById('titlebar').style.display = '';
      }
    );
  });
});
