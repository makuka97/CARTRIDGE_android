package com.cartridge.emulator

import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import com.cartridge.emulator.databinding.ActivityGameBinding
import android.util.Log
import fi.iki.elonen.NanoHTTPD
import java.io.File

class GameActivity : AppCompatActivity() {
    companion object {
        const val EXTRA_GAME_ID   = "game_id"
        const val EXTRA_GAME_NAME = "game_name"
        const val EXTRA_ROM_PATH  = "rom_path"
        const val EXTRA_CORE      = "core"
        private const val TAG     = "CartridgeGame"
        private const val PORT    = 8080
    }
    private lateinit var binding: ActivityGameBinding
    private var server: AssetServer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityGameBinding.inflate(layoutInflater)
        setContentView(binding.root)
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_FULLSCREEN)
        server = AssetServer(assets, PORT)
        server?.start()
        Log.d(TAG, "Asset server started on port $PORT")
        setupWebView()
    }

    override fun onDestroy() { server?.stop(); super.onDestroy() }
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) { finish(); return true }
        return super.onKeyDown(keyCode, event)
    }

    @SuppressWarnings("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webView  = binding.webView
        val gameId   = intent.getStringExtra(EXTRA_GAME_ID)   ?: ""
        val gameName = intent.getStringExtra(EXTRA_GAME_NAME) ?: ""
        val romPath  = intent.getStringExtra(EXTRA_ROM_PATH)  ?: ""
        val core     = intent.getStringExtra(EXTRA_CORE)      ?: ""
        Log.d(TAG, "GameActivity: $gameName | $romPath | $core")
        WebView.setWebContentsDebuggingEnabled(true)
        webView.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true
            allowFileAccess = true; allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        webView.addJavascriptInterface(object {
            @JavascriptInterface fun exitGame() { runOnUiThread { finish() } }

            @JavascriptInterface fun getSaveDir(gameId: String): String {
                val dir = java.io.File(filesDir, "saves/$gameId")
                dir.mkdirs()
                return dir.absolutePath
            }

            @JavascriptInterface fun writeState(filePath: String, base64: String): String {
                return try {
                    val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
                    java.io.File(filePath).also { it.parentFile?.mkdirs() }.writeBytes(bytes)
                    "{\"ok\":true}"
                } catch (e: Exception) { "{\"ok\":false,\"error\":\"${e.message}\"}" }
            }

            @JavascriptInterface fun readState(filePath: String): String? {
                val file = java.io.File(filePath)
                if (!file.exists()) return null
                return android.util.Base64.encodeToString(file.readBytes(), android.util.Base64.DEFAULT)
            }
        }, "androidApi")
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                Log.d(TAG, "Game page loaded: $url")
                val safe = gameName.replace("\\", "\\\\").replace("\"", "\\\"")
                view.evaluateJavascript("""window.__game={id:"$gameId",name:"$safe",romPath:"$romPath",core:"$core",dataUrl:"http://localhost:$PORT/emulator/data/"};console.log('Game ready:',window.__game.name);""", null)
            }
            override fun onReceivedError(v: WebView, r: WebResourceRequest, e: WebResourceError) { Log.e(TAG, "Err: ${e.description} ${r.url}") }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean { Log.d(TAG, "[${m.messageLevel()}] ${m.message()}"); return true }
        }
        webView.loadUrl("http://localhost:$PORT/game.html")
    }
}

class AssetServer(private val assets: android.content.res.AssetManager, port: Int) : NanoHTTPD(port) {
    private val TAG = "CartridgeServer"
    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri.trimStart('/')
        Log.d(TAG, "GET /$uri")

        // Special route: serve ROM files from internal storage
        if (uri == "rom") {
            val path = session.parameters["path"]?.firstOrNull()
            if (path != null) {
                val file = File(path)
                if (file.exists() && file.canRead()) {
                    Log.d(TAG, "Serving ROM: $path")
                    val r = newChunkedResponse(Response.Status.OK, "application/octet-stream", file.inputStream())
                    r.addHeader("Access-Control-Allow-Origin", "*")
                    return r
                } else {
                    Log.e(TAG, "ROM not found: $path")
                    return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "ROM not found: $path")
                }
            }
        }

        // Serve assets
        return try {
            val stream = assets.open(uri)
            val mime = when {
                uri.endsWith(".js")   -> "application/javascript"
                uri.endsWith(".html") -> "text/html"
                uri.endsWith(".css")  -> "text/css"
                uri.endsWith(".wasm") -> "application/wasm"
                uri.endsWith(".json") -> "application/json"
                else                  -> "application/octet-stream"
            }
            val r = newChunkedResponse(Response.Status.OK, mime, stream)
            r.addHeader("Access-Control-Allow-Origin", "*")
            r.addHeader("Cross-Origin-Opener-Policy", "same-origin")
            r.addHeader("Cross-Origin-Embedder-Policy", "require-corp")
            r
        } catch (e: Exception) {
            Log.w(TAG, "Not found: $uri")
            newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not found: $uri")
        }
    }
}

