package com.cartridge.emulator.rom

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import com.cartridge.emulator.db.Game

class RomScanner(private val context: Context) {

    companion object { private const val TAG = "CartridgeScan" }

    data class ScanProgress(val current: Int, val total: Int, val lastFile: String, val imported: Int, val skipped: Int, val errors: Int)
    data class ScanResult(val imported: List<Game>, val duplicates: Int, val errors: Int)

    suspend fun scanTree(treeUri: Uri, onProgress: ((ScanProgress) -> Unit)? = null): ScanResult {
        Log.d(TAG, "scanTree called with URI: $treeUri")

        val root = DocumentFile.fromTreeUri(context, treeUri)
        if (root == null) {
            Log.e(TAG, "DocumentFile.fromTreeUri returned null!")
            return ScanResult(emptyList(), 0, 0)
        }

        Log.d(TAG, "Root name=${root.name} canRead=${root.canRead()} isDir=${root.isDirectory}")

        val romFiles = mutableListOf<DocumentFile>()
        collectRoms(root, romFiles, depth = 0)
        Log.d(TAG, "Found ${romFiles.size} ROM files total")

        val imported   = mutableListOf<Game>()
        var duplicates = 0
        var errors     = 0

        romFiles.forEachIndexed { index, docFile ->
            val name = docFile.name ?: return@forEachIndexed
            Log.d(TAG, "Importing: $name")
            when (val result = RomImporter.importRom(context, docFile.uri, name)) {
                is RomImporter.ImportResult.Success -> {
                    if (result.duplicate) { Log.d(TAG, "Duplicate: $name"); duplicates++ }
                    else { Log.d(TAG, "Imported: $name"); imported.add(result.game) }
                }
                is RomImporter.ImportResult.Error -> { Log.w(TAG, "Error importing $name: ${result.reason}"); errors++ }
            }
            onProgress?.invoke(ScanProgress(index + 1, romFiles.size, name, imported.size, duplicates, errors))
        }

        Log.d(TAG, "Scan complete: ${imported.size} imported, $duplicates duplicates, $errors errors")
        return ScanResult(imported, duplicates, errors)
    }

    private fun collectRoms(dir: DocumentFile, out: MutableList<DocumentFile>, depth: Int) {
        if (depth > 5) return  // safety limit
        val files = try { dir.listFiles() } catch (e: Exception) { Log.e(TAG, "listFiles failed at depth $depth: ${e.message}"); return }
        Log.d(TAG, "  dir=${dir.name} has ${files.size} entries (depth=$depth)")
        for (child in files) {
            when {
                child.isDirectory -> collectRoms(child, out, depth + 1)
                child.isFile -> {
                    val ext = child.name?.substringAfterLast('.', "")?.lowercase() ?: ""
                    Log.d(TAG, "    file=${child.name} ext=$ext supported=${ext in RomDetector.SUPPORTED_EXTENSIONS}")
                    if (ext in RomDetector.SUPPORTED_EXTENSIONS) out.add(child)
                }
            }
        }
    }
}
