package com.cartridge.emulator.rom

import android.content.Context
import android.net.Uri
import com.cartridge.emulator.db.CartridgeDatabase
import com.cartridge.emulator.db.Game
import java.io.File
import java.time.Instant
import java.util.Locale

/**
 * Kotlin port of rom/importer.js.
 * Accepts an Android content URI (from SAF file picker or folder scan),
 * copies the ROM to internal storage, inserts a DB row, and returns the result.
 */
object RomImporter {

    sealed class ImportResult {
        data class Success(val game: Game, val duplicate: Boolean = false) : ImportResult()
        data class Error(val reason: String, val ext: String? = null) : ImportResult()
    }

    /**
     * Imports a ROM from a content URI.
     * Runs on whatever coroutine context the caller provides (should be IO).
     */
    fun importRom(context: Context, uri: Uri, displayName: String): ImportResult {
        val detected = RomDetector.detect(displayName)
            ?: return ImportResult.Error(
                reason = "unsupported",
                ext = displayName.substringAfterLast('.', "(no extension)")
            )

        val romDir = getRomDir(context, detected.system)
        val destFile = File(romDir, displayName)
        val destPath = destFile.absolutePath

        val db = CartridgeDatabase.getInstance(context)
        val dao = db.gameDao()

        // Duplicate check
        val existing = dao.getGameByRomPath(destPath)
        if (existing != null) {
            return ImportResult.Success(game = existing, duplicate = true)
        }

        // Copy from SAF URI → internal storage
        context.contentResolver.openInputStream(uri)?.use { input ->
            destFile.outputStream().use { output ->
                input.copyTo(output)
            }
        } ?: return ImportResult.Error(reason = "could not open file")

        // Create save directory immediately on import (mirrors ipc.js behaviour)
        val saveDir = getSaveDir(context, "")
        File(saveDir).mkdirs()

        val game = Game(
            id       = generateId(),
            name     = nameFromFilename(displayName),
            system   = detected.system,
            core     = detected.core,
            romPath  = destPath,
            addedAt  = Instant.now().toString()
        )

        dao.insertGame(game)

        return ImportResult.Success(game = game)
    }

    fun getRomDir(context: Context, system: String): File {
        val dir = File(context.filesDir, "roms/$system")
        dir.mkdirs()
        return dir
    }

    fun getSaveDir(context: Context, gameId: String): String {
        val dir = File(context.filesDir, "saves/$gameId")
        dir.mkdirs()
        return dir.absolutePath
    }

    private fun generateId(): String =
        (1..8).map { "abcdefghijklmnopqrstuvwxyz0123456789".random() }.joinToString("")

    /**
     * Port of nameFromFilename() in importer.js:
     * strips region tags like (USA), [!], strips underscores, title-cases.
     */
    fun nameFromFilename(filename: String): String {
        var name = filename.substringBeforeLast('.')
        name = name.replace(Regex("""\s*[\(\[][^\)\]]*[\)\]]"""), "").trim()
        name = name.replace(Regex("""[_\-]+"""), " ").trim()
        name = name.split(" ").joinToString(" ") { word ->
            word.replaceFirstChar { it.uppercase(Locale.ROOT) }
        }
        return name.ifBlank { filename }
    }
}
