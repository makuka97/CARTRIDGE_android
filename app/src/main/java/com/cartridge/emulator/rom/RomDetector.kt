package com.cartridge.emulator.rom

/**
 * Kotlin port of rom/detector.js.
 * Maps ROM file extensions → system + EmulatorJS core name.
 */
object RomDetector {

    data class Detection(
        val system: String,
        val core: String,       // e.g. "mgba.wasm"
        val label: String
    )

    private val EXTENSION_MAP = mapOf(
        "nes"  to Detection("nes",       "fceumm.wasm",          "Nintendo NES"),
        "smc"  to Detection("snes",      "snes9x.wasm",          "Super Nintendo"),
        "snes" to Detection("snes",      "snes9x.wasm",          "Super Nintendo"),
        "sfc"  to Detection("snes",      "snes9x.wasm",          "Super Nintendo"),
        "gb"   to Detection("gb",        "mgba.wasm",            "Game Boy"),
        "gbc"  to Detection("gbc",       "mgba.wasm",            "Game Boy Color"),
        "gba"  to Detection("gba",       "mgba.wasm",            "Game Boy Advance"),
        "md"   to Detection("genesis",   "genesis_plus_gx.wasm", "Sega Genesis"),
        "gen"  to Detection("genesis",   "genesis_plus_gx.wasm", "Sega Genesis"),
        "smd"  to Detection("genesis",   "genesis_plus_gx.wasm", "Sega Genesis"),
        "bin"  to Detection("genesis",   "genesis_plus_gx.wasm", "Sega Genesis"),
        "a26"  to Detection("atari2600", "stella.wasm",          "Atari 2600"),
        "a78"  to Detection("atari7800", "prosystem.wasm",       "Atari 7800")
    )

    val SYSTEM_ORDER = listOf("nes", "snes", "gba", "gbc", "gb", "genesis", "atari2600", "atari7800")

    /** All supported extensions — used by the folder scanner. */
    val SUPPORTED_EXTENSIONS: Set<String> = EXTENSION_MAP.keys

    fun detect(filename: String): Detection? {
        val ext = filename.substringAfterLast('.', "").lowercase()
        return EXTENSION_MAP[ext]
    }
}
