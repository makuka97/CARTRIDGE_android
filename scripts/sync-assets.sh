#!/usr/bin/env bash
# scripts/sync-assets.sh
# Copies the desktop renderer + emulator data into the Android assets folder.
# Run this from the repo root after pulling desktop changes.
#
# Usage:
#   ./scripts/sync-assets.sh <path-to-desktop-cartridge-repo>
#
# Example:
#   ./scripts/sync-assets.sh ../cartridge

set -euo pipefail

DESKTOP="${1:?Usage: sync-assets.sh <path-to-desktop-repo>}"
ANDROID_ASSETS="app/src/main/assets"

echo "▶ Syncing renderer from $DESKTOP → $ANDROID_ASSETS/renderer"

# ── Renderer HTML, CSS, JS ─────────────────────────────────────────────────
rsync -av --delete \
  --exclude='components/dropZone.js' \
  --exclude='emulator/loader.js' \
  "$DESKTOP/renderer/" \
  "$ANDROID_ASSETS/renderer/"

echo "  ✓ Renderer synced (dropZone.js and loader.js kept as Android versions)"

# ── Android-override files (do NOT overwrite with desktop versions) ────────
# These files live in assets/renderer/ and override their desktop equivalents:
#   renderer/components/dropZone.js  → scan buttons instead of drag-and-drop
#   renderer/emulator/loader.js      → file:///android_asset/ URLs
# They are managed in this repo and should never be overwritten by this script.

# ── EmulatorJS data (cores + loader) ──────────────────────────────────────
CORE_SRC="$DESKTOP/emulator/data"
CORE_DST="$ANDROID_ASSETS/emulator/data"

if [ -d "$CORE_SRC" ]; then
  echo "▶ Syncing EmulatorJS cores from $CORE_SRC → $CORE_DST"
  mkdir -p "$CORE_DST"
  rsync -av --delete "$CORE_SRC/" "$CORE_DST/"
  echo "  ✓ Cores synced"
else
  echo "  ⚠ $CORE_SRC not found — run 'npm run download-cores' in the desktop repo first"
fi

# ── Inject android.css link into index.html ────────────────────────────────
INDEX="$ANDROID_ASSETS/renderer/index.html"
if ! grep -q "android.css" "$INDEX"; then
  sed -i 's|</head>|  <link rel="stylesheet" href="styles/android.css">\n</head>|' "$INDEX"
  echo "  ✓ android.css link injected into index.html"
fi

echo ""
echo "✅ Assets synced. Build the APK with: ./gradlew assembleDebug"
