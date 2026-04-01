# CARTRIDGE — Android Port

> Porting the CARTRIDGE Electron emulator to Android. Same EmulatorJS WASM cores,
> same renderer UI, new native shell.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│  Android App (Kotlin)                                    │
│                                                          │
│  MainActivity / GameActivity                             │
│    └─ WebView                                            │
│         ├─ file:///android_asset/renderer/index.html     │
│         ├─ bridge-init.js  ← injected on page load       │
│         │    └─ window.api shim (mirrors preload.js)     │
│         └─ androidApi  ← JavascriptInterface             │
│              └─ CartridgeBridge.kt                       │
│                   ├─ RomImporter.kt  (port of importer.js)│
│                   ├─ RomScanner.kt   (replaces drop zone) │
│                   ├─ RomDetector.kt  (port of detector.js)│
│                   └─ CartridgeDatabase (Room / SQLite)   │
└─────────────────────────────────────────────────────────┘
```

### What changed vs desktop

| Desktop (Electron)         | Android                              |
|----------------------------|--------------------------------------|
| `main/preload.js`          | `bridge-init.js` shim (assets)       |
| `main/ipc.js`              | `CartridgeBridge.kt`                 |
| `db/db.js` (sql.js WASM)   | Room (SQLite via Android framework)  |
| `cartridge://local/` URLs  | `file://` + `file:///android_asset/` |
| Drag-and-drop `dropZone.js`| SAF folder/file picker buttons       |
| `keyboard.js` shortcuts    | EmulatorJS built-in touch controls   |
| Web Gamepad API (BT)       | **Unchanged** — works natively       |
| `electron-builder`         | `gradle assembleRelease`             |

---

## Project structure

```
cartridge-android/
├── app/
│   ├── build.gradle
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── assets/
│       │   ├── bridge-init.js          ← window.api shim
│       │   ├── renderer/               ← copied from desktop repo
│       │   │   ├── index.html
│       │   │   ├── components/
│       │   │   │   └── dropZone.js     ← Android override (scan buttons)
│       │   │   ├── emulator/
│       │   │   │   └── loader.js       ← Android override (file:// URLs)
│       │   │   └── styles/
│       │   │       └── android.css     ← mobile-specific styles
│       │   └── emulator/
│       │       └── data/               ← EmulatorJS cores (copied by sync script)
│       │           ├── loader.js
│       │           ├── cores/
│       │           └── ...
│       ├── java/com/cartridge/emulator/
│       │   ├── MainActivity.kt
│       │   ├── GameActivity.kt
│       │   ├── bridge/
│       │   │   └── CartridgeBridge.kt
│       │   ├── db/
│       │   │   ├── Game.kt
│       │   │   ├── GameDao.kt
│       │   │   └── CartridgeDatabase.kt
│       │   └── rom/
│       │       ├── RomDetector.kt
│       │       ├── RomImporter.kt
│       │       └── RomScanner.kt
│       └── res/
│           ├── layout/
│           │   ├── activity_main.xml
│           │   └── activity_game.xml
│           └── values/
│               ├── strings.xml
│               └── themes.xml
└── scripts/
    └── sync-assets.sh
```

---

## Phase 1 — Android shell + JS bridge ✅ (this PR)

Everything in this repo. The WebView loads the desktop renderer unchanged;
`bridge-init.js` intercepts all `window.api.*` calls and routes them to
`CartridgeBridge.kt` via `window.androidApi`.

**To build Phase 1:**

```bash
# 1. Copy renderer + cores from the desktop repo
./scripts/sync-assets.sh ../cartridge

# 2. Open in Android Studio and run on a device/emulator
#    OR build from command line:
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

**What works after Phase 1:**
- Library screen renders in WebView
- "Scan Folder" button opens Android folder picker and imports all ROMs found
- "Add ROM" button opens single-file picker
- ROM detection (extension → system + core) works identically to desktop
- SQLite library persists across app restarts
- System nav, game tiles, settings view all render correctly

**What's not yet wired:**
- Tapping a game tile does not launch the emulator yet (Phase 2)
- No touch d-pad overlay (Phase 2 / 3)

---

## Phase 2 — EmulatorJS core loading (NEXT)

**Goal:** Tapping a game tile launches it in `GameActivity` with a running core.

**Tasks:**
1. Wire the library tile `onclick` → `startActivity(GameActivity)` with game extras
2. In `GameActivity`, after bridge init, detect `window.__pendingGame` and call `GameView.launch()`
3. Confirm `file://` ROM paths load correctly into EmulatorJS
4. Verify each core (fceumm, snes9x, mgba, genesis_plus_gx, stella, prosystem) loads
5. Handle WASM SharedArrayBuffer requirement (COOP/COEP headers already set in `MainActivity`)
6. Test save state read/write via `CartridgeBridge.writeState` / `readState`

**Key files to touch:**
- `renderer/views/library.js` — add `window.api.getPlatform()` check, fire Intent instead of `GameView.launch()` on Android
- `GameActivity.kt` — detect `__pendingGame` and call JS `GameView.launch()`
- `assets/renderer/emulator/loader.js` — already updated for `file://` URLs

---

## Phase 3 — Touch controls + mobile HUD

**Goal:** Full playable experience without a physical controller.

**Tasks:**
1. Build `TouchControls` overlay component in JS/CSS:
   - D-pad (left side), A/B/X/Y buttons (right side)
   - Start/Select (center bottom)
   - Draws on top of the EmulatorJS canvas, transparent background
2. EmulatorJS has a built-in mobile control layer (`EJS_mobileControls = true`) — evaluate whether it's sufficient or needs custom overlay
3. Replace `keyboard.js` `startListening()` with touch event handlers for save/load/exit shortcuts
4. Long-press on HUD area to show save/exit options (replaces keyboard shortcuts)
5. Haptic feedback via `window.androidApi.vibrate(ms)` on button presses

**Bluetooth controllers:**
- The existing `gamepad.js` polling code works unchanged
- Android WebView supports the Web Gamepad API natively
- No changes needed

---

## Phase 4 — Packaging + release

**Tasks:**
1. Add app icon (convert `assets/icon.png` to all mipmap densities)
2. Bundle all EmulatorJS WASM cores in `assets/emulator/data/`
3. Configure `build.gradle` signing for release APK
4. Test on physical devices: Pixel (reference), Samsung (most popular), budget Android
5. ProGuard / R8 configuration
6. Optional: Google Play listing

**Build release APK:**
```bash
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

---

## Bluetooth controller support

No changes needed from desktop. The Web Gamepad API is supported in Android WebView
(Chrome 80+, which covers all devices running Android 10+). The existing `gamepad.js`
shortcut polling (Select+Start = exit, Select+RB = save state) works as-is.

**Testing:**
1. Pair a BT controller to the Android device
2. Open any game
3. The `gamepadconnected` event fires and `gamepad.js` begins polling
4. Verify Select+Start exits to library

---

## Supported systems

| System       | Core                  | Extensions           |
|--------------|-----------------------|----------------------|
| Nintendo NES | fceumm                | .nes                 |
| Super Nintendo | snes9x              | .smc .snes .sfc      |
| Game Boy     | mgba                  | .gb                  |
| Game Boy Color | mgba                | .gbc                 |
| Game Boy Advance | mgba             | .gba                 |
| Sega Genesis | genesis_plus_gx       | .md .gen .smd .bin   |
| Atari 2600   | stella2014            | .a26                 |
| Atari 7800   | prosystem             | .a78                 |

---

## Development notes

### The bridge pattern
`CartridgeBridge.kt` is annotated with `@JavascriptInterface` — any method with
that annotation is callable from JS as `window.androidApi.methodName()`.
`bridge-init.js` wraps these into the `window.api` Promise interface so the
renderer JS never needs to know it's running on Android.

### Async DB calls
Room DB operations run on `Dispatchers.IO`. Results post back to the WebView via
`webView.evaluateJavascript()` which must be called on the main thread.
`CartridgeBridge` uses a `SupervisorJob` scope for this; `scope.cancel()` is called
in `onDestroy()` to avoid leaks.

### File access
`allowFileAccess = true` in WebView settings lets `file://` URLs reach internal app
storage (`/data/data/com.cartridge.emulator/files/`). This is where ROMs are copied
to on import. External/SD card paths require SAF and cannot be accessed as `file://`
directly — the importer always copies to internal storage first.

### SharedArrayBuffer / WASM threads
Some EmulatorJS cores use SharedArrayBuffer for WASM threading. This requires
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
headers. These are injected in `MainActivity.tryServeAsset()` for all asset responses.
