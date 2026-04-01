package com.cartridge.emulator

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Log
import android.webkit.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.cartridge.emulator.bridge.CartridgeBridge
import com.cartridge.emulator.databinding.ActivityMainBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var bridge: CartridgeBridge

    companion object { private const val TAG = "CartridgeMain" }

    private val pickRomLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        Log.d(TAG, "File picker result: ${result.resultCode}")
        if (result.resultCode != Activity.RESULT_OK) {
            binding.webView.post { binding.webView.evaluateJavascript("window.__onRomImported(null)", null) }
            return@registerForActivityResult
        }
        val uri  = result.data?.data ?: return@registerForActivityResult
        val name = getDisplayName(uri) ?: uri.lastPathSegment ?: "unknown"
        Log.d(TAG, "Picked file: $name  uri=$uri")
        lifecycleScope.launch(Dispatchers.IO) { bridge.importRomFromUri(uri, name) }
    }

    private val scanFolderLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        Log.d(TAG, "Folder picker result: ${result.resultCode}")
        if (result.resultCode != Activity.RESULT_OK) {
            binding.webView.post { binding.webView.evaluateJavascript("window.__onScanComplete({imported:[],duplicates:0,errors:0})", null) }
            return@registerForActivityResult
        }
        val uri = result.data?.data ?: run {
            binding.webView.post { binding.webView.evaluateJavascript("window.__onScanComplete({imported:[],duplicates:0,errors:0})", null) }
            return@registerForActivityResult
        }
        Log.d(TAG, "Scanning folder: $uri")
        try { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (e: Exception) { Log.w(TAG, "Permission persist failed: ${e.message}") }
        lifecycleScope.launch(Dispatchers.IO) { bridge.scanFolderTree(uri) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setupWebView()
    }

    override fun onDestroy() { bridge.destroy(); super.onDestroy() }

    @SuppressWarnings("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webView = binding.webView
        WebView.setWebContentsDebuggingEnabled(true)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess   = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        bridge = CartridgeBridge(
            context = this, webView = webView,
            onScanFolderRequested = { launchFolderPicker() },
            onPickRomRequested    = { launchFilePicker() }
        )
        webView.addJavascriptInterface(bridge, "androidApi")
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                Log.d(TAG, "Page loaded: $url")
                val shim = try { assets.open("bridge-init.js").bufferedReader().readText() } catch (e: Exception) { Log.e(TAG, "bridge-init.js missing: ${e.message}"); return }
                view.evaluateJavascript(shim) { Log.d(TAG, "Bridge ready") }
            }
            override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) { Log.e(TAG, "WebView error: ${err.description} — ${req.url}") }
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) = tryServeAsset(request.url)
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                Log.d("CartridgeJS", "[${msg.messageLevel()}] ${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})")
                return true
            }
        }
        webView.loadUrl("file:///android_asset/renderer/index.html")
    }

    private fun launchFilePicker() {
        pickRomLauncher.launch(Intent.createChooser(Intent(Intent.ACTION_GET_CONTENT).apply { type = "*/*"; addCategory(Intent.CATEGORY_OPENABLE) }, "Select ROM"))
    }

    private fun launchFolderPicker() {
        Log.d(TAG, "Opening folder picker")
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent.putExtra("android.provider.extra.INITIAL_URI",
                Uri.parse("content://com.android.externalstorage.documents/root/primary"))
        }
        scanFolderLauncher.launch(intent)
    }

    private fun tryServeAsset(uri: Uri): WebResourceResponse? {
        if (uri.scheme != "file") return null
        val assetPath = uri.path?.removePrefix("/android_asset/") ?: return null
        return try {
            val headers = mapOf("Cross-Origin-Opener-Policy" to "same-origin", "Cross-Origin-Embedder-Policy" to "require-corp")
            WebResourceResponse(guessMime(assetPath), "utf-8", 200, "OK", headers, assets.open(assetPath))
        } catch (e: Exception) { null }
    }

    private fun guessMime(p: String) = when {
        p.endsWith(".js")   -> "application/javascript"
        p.endsWith(".html") -> "text/html"
        p.endsWith(".css")  -> "text/css"
        p.endsWith(".wasm") -> "application/wasm"
        p.endsWith(".png")  -> "image/png"
        p.endsWith(".svg")  -> "image/svg+xml"
        else                -> "application/octet-stream"
    }

    private fun getDisplayName(uri: Uri): String? {
        contentResolver.query(uri, null, null, null, null)?.use { c ->
            if (c.moveToFirst()) { val i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (i >= 0) return c.getString(i) }
        }
        return null
    }
}
