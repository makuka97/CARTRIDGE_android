package com.cartridge.emulator.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.cartridge.emulator.db.CartridgeDatabase
import com.cartridge.emulator.rom.RomImporter
import com.cartridge.emulator.rom.RomScanner
import com.google.gson.Gson
import kotlinx.coroutines.*
import java.io.File
import java.net.URL
import java.time.Instant

class CartridgeBridge(
    private val context: Context,
    private val webView: WebView,
    private val onScanFolderRequested: () -> Unit,
    private val onPickRomRequested: () -> Unit
) {
    private val gson  = Gson()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val db    = CartridgeDatabase.getInstance(context)
    private val dao   = db.gameDao()

    private fun getApiKey(): String = getPrefs().getString("sgdb_api_key", "") ?: ""
    private fun getPrefs() = context.getSharedPreferences("cartridge_prefs", Context.MODE_PRIVATE)

    fun destroy() = scope.cancel()

    // ── Pickers ───────────────────────────────────────────────────
    @JavascriptInterface
    fun openFolderPicker() { CoroutineScope(Dispatchers.Main).launch { onScanFolderRequested() } }

    @JavascriptInterface
    fun openFilePicker() { CoroutineScope(Dispatchers.Main).launch { onPickRomRequested() } }

    // ── ROM import ────────────────────────────────────────────────
    fun importRomFromUri(uri: android.net.Uri, displayName: String) {
        scope.launch(Dispatchers.IO) {
            val result = RomImporter.importRom(context, uri, displayName)
            val json = when (result) {
                is RomImporter.ImportResult.Success -> {
                    if (result.duplicate) gson.toJson(mapOf("duplicate" to true, "game" to result.game.toMap()))
                    else {
                        scrapeGame(result.game.id, result.game.name, result.game.system)
                        gson.toJson(mapOf("game" to result.game.toMap()))
                    }
                }
                is RomImporter.ImportResult.Error -> gson.toJson(mapOf("error" to result.reason, "ext" to result.ext))
            }
            withContext(Dispatchers.Main) { webView.evaluateJavascript("window.__onRomImported($json)", null) }
        }
    }

    fun scanFolderTree(treeUri: android.net.Uri) {
        scope.launch(Dispatchers.IO) {
            val scanner = RomScanner(context)
            val result  = scanner.scanTree(treeUri) { progress ->
                val json = gson.toJson(progress)
                CoroutineScope(Dispatchers.Main).launch { webView.evaluateJavascript("window.__onScanProgress($json)", null) }
            }
            result.imported.forEach { game -> scrapeGame(game.id, game.name, game.system) }
            val json = gson.toJson(mapOf("imported" to result.imported.map { it.toMap() }, "duplicates" to result.duplicates, "errors" to result.errors))
            withContext(Dispatchers.Main) { webView.evaluateJavascript("window.__onScanComplete($json)", null) }
        }
    }

    // ── Scraper ───────────────────────────────────────────────────
    private fun scrapeGame(gameId: String, gameName: String, system: String) {
        scope.launch(Dispatchers.IO) {
            try {
                val key = getApiKey()
                if (key.isEmpty()) { android.util.Log.d("CartridgeScraper", "No API key — skipping $gameName"); return@launch }
                android.util.Log.d("CartridgeScraper", "Scraping: $gameName")
                val searchUrl  = "https://www.steamgriddb.com/api/v2/search/autocomplete/${java.net.URLEncoder.encode(gameName, "UTF-8")}"
                val searchResp = URL(searchUrl).openConnection().apply { setRequestProperty("Authorization", "Bearer $key"); connectTimeout = 8000; readTimeout = 8000 }.getInputStream().bufferedReader().readText()
                val searchJson = gson.fromJson(searchResp, Map::class.java)
                val data       = (searchJson["data"] as? List<*>) ?: return@launch
                if (data.isEmpty()) return@launch
                val sgdbId     = ((data[0] as? Map<*, *>)?.get("id") as? Double)?.toInt() ?: return@launch
                val gridUrl    = "https://www.steamgriddb.com/api/v2/grids/game/$sgdbId?dimensions=600x900&limit=1"
                val gridResp   = URL(gridUrl).openConnection().apply { setRequestProperty("Authorization", "Bearer $key"); connectTimeout = 8000; readTimeout = 8000 }.getInputStream().bufferedReader().readText()
                val gridJson   = gson.fromJson(gridResp, Map::class.java)
                val grids      = (gridJson["data"] as? List<*>) ?: return@launch
                if (grids.isEmpty()) return@launch
                val imageUrl   = (grids[0] as? Map<*, *>)?.get("url") as? String ?: return@launch
                val boxartDir  = File(context.filesDir, "boxart").also { it.mkdirs() }
                val boxartFile = File(boxartDir, "$gameId.jpg")
                URL(imageUrl).openStream().use { i -> boxartFile.outputStream().use { o -> i.copyTo(o) } }
                dao.updateBoxart(gameId, boxartFile.absolutePath, null)
                android.util.Log.d("CartridgeScraper", "Art saved: $gameName")
                val update = gson.toJson(mapOf("id" to gameId, "boxart" to boxartFile.absolutePath))
                withContext(Dispatchers.Main) { webView.evaluateJavascript("window.__onMetaUpdated($update)", null) }
            } catch (e: Exception) { android.util.Log.w("CartridgeScraper", "Failed $gameName: ${e.message}") }
        }
    }

    // ── Settings ──────────────────────────────────────────────────
    @JavascriptInterface
    fun getApiKey_js(): String = getApiKey()

    @JavascriptInterface
    fun setApiKey(key: String) {
        getPrefs().edit().putString("sgdb_api_key", key).apply()
        android.util.Log.d("CartridgeBridge", "API key saved")
    }

    @JavascriptInterface
    fun openUrl(url: String) {
        CoroutineScope(Dispatchers.Main).launch {
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun scrapeAllGames() {
        scope.launch(Dispatchers.IO) {
            val games = dao.getAllGames().filter { it.boxart == null }
            android.util.Log.d("CartridgeScraper", "Scraping all: ${games.size} games")
            games.forEach { game -> scrapeGame(game.id, game.name, game.system); Thread.sleep(500) }
        }
    }

    // ── Library ───────────────────────────────────────────────────
    @JavascriptInterface
    fun getAllGames(): String = gson.toJson(dao.getAllGames().map { it.toMap() })

    @JavascriptInterface
    fun getGamesBySystem(system: String): String = gson.toJson(dao.getGamesBySystem(system).map { it.toMap() })

    @JavascriptInterface
    fun deleteGames(idsJson: String) {
        scope.launch(Dispatchers.IO) {
            val ids = gson.fromJson(idsJson, Array<String>::class.java).toList()
            dao.deleteGames(ids)
            ids.forEach { id -> File(context.filesDir, "saves/$id").deleteRecursively() }
            withContext(Dispatchers.Main) { webView.evaluateJavascript("window.__onGamesDeleted(${gson.toJson(ids)})", null) }
        }
    }

    // ── Save states ───────────────────────────────────────────────
    @JavascriptInterface
    fun getSaveDir(gameId: String): String = RomImporter.getSaveDir(context, gameId)

    @JavascriptInterface
    fun writeState(filePath: String, base64: String): String {
        return try {
            val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
            File(filePath).also { it.parentFile?.mkdirs() }.writeBytes(bytes)
            gson.toJson(mapOf("ok" to true))
        } catch (e: Exception) { gson.toJson(mapOf("ok" to false, "error" to e.message)) }
    }

    @JavascriptInterface
    fun readState(filePath: String): String? {
        val file = File(filePath)
        if (!file.exists()) return null
        return android.util.Base64.encodeToString(file.readBytes(), android.util.Base64.DEFAULT)
    }

    @JavascriptInterface
    fun getSaveFiles(gameId: String): String {
        val saveDir = File(context.filesDir, "saves/$gameId")
        if (!saveDir.exists()) return "[]"
        return gson.toJson(saveDir.listFiles()?.filter { it.extension == "state" }?.map { it.absolutePath } ?: emptyList<String>())
    }

    // ── App ───────────────────────────────────────────────────────
    @JavascriptInterface
    fun getAppDataUrl(): String = "file:///android_asset/emulator/data/"

    @JavascriptInterface
    fun getPlatform(): String = "android"

    @JavascriptInterface
    fun launchGame(gameId: String, gameName: String, romPath: String, core: String) {
        android.util.Log.d("CartridgeBridge", "launchGame: $gameName")
        CoroutineScope(Dispatchers.Main).launch {
            val intent = android.content.Intent(context, com.cartridge.emulator.GameActivity::class.java).apply {
                putExtra(com.cartridge.emulator.GameActivity.EXTRA_GAME_ID,   gameId)
                putExtra(com.cartridge.emulator.GameActivity.EXTRA_GAME_NAME, gameName)
                putExtra(com.cartridge.emulator.GameActivity.EXTRA_ROM_PATH,  romPath)
                putExtra(com.cartridge.emulator.GameActivity.EXTRA_CORE,      core)
            }
            context.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun recordPlaySession(gameId: String, secondsPlayed: Int) {
        scope.launch(Dispatchers.IO) { dao.recordPlaySession(gameId, secondsPlayed, Instant.now().toString()) }
    }

    private fun com.cartridge.emulator.db.Game.toMap() = mapOf(
        "id" to id, "name" to name, "system" to system, "core" to core,
        "rom_path" to romPath, "romPath" to romPath,
        "boxart" to boxart, "year" to year,
        "play_time" to playTime, "last_played" to lastPlayed, "added_at" to addedAt
    )
}

