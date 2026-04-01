CARTRIDGE Android
==============

Android emulator for classic game systems. Scan your device for ROMs, launch games, save your progress.

Built with Kotlin and EmulatorJS.

---

Supported Systems
----------------

NES, Super Nintendo, Game Boy, Game Boy Color, Game Boy Advance, Sega Genesis, Atari 2600, Atari 7800

File extensions: .nes .smc .snes .sfc .gb .gbc .gba .md .gen .smd .bin .a26 .a78

---

Features
--------

- Scan a folder on your device to import ROMs
- Box art fetched automatically via SteamGridDB
- Save and load states per game
- Bluetooth controller support
- Touch controls
- Works offline

---

Setup
-----

1. Install the APK
2. Open the app and tap Scan for Games
3. Navigate to the folder where your ROMs are stored
4. Tap Use this folder

For box art, go to Settings and add a SteamGridDB API key. Keys are free at steamgriddb.com.

---

Building from Source
--------------------

Requirements: Android Studio, JDK 17

    git clone https://github.com/makuka97/CARTRIDGE_android
    cd CARTRIDGE_android
    ./gradlew assembleDebug

---

Requirements
------------

Android 8.0 or higher

---

License
-------

MIT