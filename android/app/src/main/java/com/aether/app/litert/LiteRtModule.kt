@file:OptIn(com.google.ai.edge.litertlm.ExperimentalApi::class)

package com.aether.app.litert

import android.graphics.BitmapFactory
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.SamplerConfig
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.CancellationException
import java.util.concurrent.Executors

/**
 * React Native bridge over Google's LiteRT-LM engine (`com.google.ai.edge.litertlm`)
 * — the exact GPU-native engine Google's AI Edge Gallery ships, running the ungated
 * `.litertlm` Gemma models. Replaces llama.rn for chat + vision.
 *
 * litertlm is built with Kotlin 2.x metadata; we read it from Kotlin 1.9 via the
 * `-Xskip-metadata-version-check` compiler flag (see app/build.gradle).
 *
 * The engine is created once per model with a GPU→CPU / vision→text fallback ladder.
 * Each `generate` opens a fresh conversation and streams the reply token-by-token
 * over the `LiteRtToken` device event. JS serialises calls.
 */
class LiteRtModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val ctx = reactContext
  private val worker = Executors.newSingleThreadExecutor()

  @Volatile private var engine: Engine? = null
  @Volatile private var modelPath: String? = null
  @Volatile private var conversation: Conversation? = null
  @Volatile private var visionEnabled = false
  @Volatile private var cancelled = false

  override fun getName() = "LiteRt"

  private fun emit(event: String, payload: Any?) {
    ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(event, payload)
  }

  @ReactMethod fun isLoaded(promise: Promise) = promise.resolve(engine != null)
  @ReactMethod fun getLoadedPath(promise: Promise) = promise.resolve(modelPath)

  private class EngineResult(val engine: Engine, val gpu: Boolean, val vision: Boolean)

  /** Build + initialise the engine, trying GPU+vision → GPU text-only → CPU text-only,
   *  so a model still loads if the GPU or the vision graph is unavailable. */
  private fun createEngine(path: String, maxTokens: Int): EngineResult {
    val cacheDir = ctx.cacheDir.absolutePath
    data class Attempt(val gpu: Boolean, val vision: Boolean)
    val ladder = listOf(Attempt(true, true), Attempt(true, false), Attempt(false, false))
    var lastErr: Throwable? = null
    for (a in ladder) {
      try {
        val backend = if (a.gpu) Backend.GPU() else Backend.CPU()
        val config = EngineConfig(
          modelPath = path,
          backend = backend,
          visionBackend = if (a.vision) Backend.GPU() else null,
          audioBackend = null,
          maxNumTokens = maxTokens,
          cacheDir = cacheDir,
        )
        val eng = Engine(config)
        eng.initialize()
        Log.i("LiteRt", "engine ready (gpu=${a.gpu} vision=${a.vision})")
        return EngineResult(eng, a.gpu, a.vision)
      } catch (t: Throwable) {
        lastErr = t
        Log.w("LiteRt", "engine attempt failed (gpu=${a.gpu} vision=${a.vision}): ${t.message}")
      }
    }
    throw lastErr ?: RuntimeException("Could not create LiteRT engine")
  }

  /** Resolves a JSON capability string `{"gpu":bool,"vision":bool}`. */
  @ReactMethod
  fun init(path: String, maxTokens: Int, promise: Promise) {
    worker.execute {
      try {
        val clean = path.removePrefix("file://")
        if (engine != null && modelPath == clean) {
          promise.resolve("{\"gpu\":true,\"vision\":$visionEnabled}"); return@execute
        }
        val file = File(clean)
        if (!file.exists()) { promise.reject("LITERT_NO_FILE", "Model file not found"); return@execute }
        if (file.length() < 1_000_000L) {
          promise.reject("LITERT_BAD_FILE", "Model file looks incomplete (${file.length()} bytes) — re-download it")
          return@execute
        }
        releaseInternal()
        val res = createEngine(clean, maxTokens)
        engine = res.engine
        visionEnabled = res.vision
        modelPath = clean
        promise.resolve("{\"gpu\":${res.gpu},\"vision\":${res.vision}}")
      } catch (t: Throwable) {
        Log.e("LiteRt", "init failed", t)
        promise.reject("LITERT_INIT", t.message ?: "Could not load this model", t)
      }
    }
  }

  @ReactMethod
  fun generate(
    systemPrompt: String,
    historyJson: String,
    lastText: String,
    imagePaths: ReadableArray,
    topK: Int,
    topP: Double,
    temperature: Double,
    stream: Boolean,
    promise: Promise,
  ) {
    worker.execute {
      val e = engine
      if (e == null) { promise.reject("LITERT_NO_MODEL", "No model loaded"); return@execute }
      cancelled = false
      val useImages = visionEnabled && imagePaths.size() > 0
      try {
        // Proper turn structure (system + prior turns as initialMessages, then the new
        // user turn) so litertlm applies Gemma's chat template and STOPS at the end of
        // the turn. A flattened "User:/Assistant:" blob made the model keep generating
        // fake turns and never fire onDone.
        val convo = e.createConversation(
          ConversationConfig(
            samplerConfig = SamplerConfig(topK = topK, topP = topP, temperature = temperature),
            systemInstruction = if (systemPrompt.isNotBlank()) Contents.of(systemPrompt) else null,
            initialMessages = parseHistory(historyJson),
          ),
        )
        conversation = convo

        val contents = mutableListOf<Content>()
        if (useImages) {
          for (i in 0 until imagePaths.size()) {
            val p = imagePaths.getString(i)?.removePrefix("file://") ?: continue
            pngBytes(p)?.let { contents.add(Content.ImageBytes(it)) }
          }
        }
        if (lastText.isNotBlank()) contents.add(Content.Text(lastText))

        val sb = StringBuilder()
        convo.sendMessageAsync(
          Contents.of(contents),
          object : MessageCallback {
            override fun onMessage(message: Message) {
              val piece = message.toString()
              if (!cancelled && piece.isNotEmpty()) {
                sb.append(piece)
                if (stream) emit("LiteRtToken", piece)
              }
            }
            override fun onDone() {
              closeConversation()
              promise.resolve(sb.toString())
            }
            override fun onError(throwable: Throwable) {
              closeConversation()
              if (throwable is CancellationException) {
                promise.resolve(sb.toString())
              } else {
                Log.e("LiteRt", "generate error", throwable)
                promise.reject("LITERT_GEN", throwable.message ?: "generation failed", throwable)
              }
            }
          },
          emptyMap(),
        )
      } catch (t: Throwable) {
        closeConversation()
        Log.e("LiteRt", "generate failed", t)
        promise.reject("LITERT_GEN", t.message ?: "generation failed", t)
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    cancelled = true
    try { conversation?.cancelProcess() } catch (_: Throwable) {}
    promise.resolve(true)
  }

  @ReactMethod
  fun release(promise: Promise) {
    worker.execute {
      releaseInternal()
      promise.resolve(true)
    }
  }

  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  /** Parse `[{"role":"user|model","text":...}]` into litertlm seed messages. */
  private fun parseHistory(json: String): List<Message> {
    val out = ArrayList<Message>()
    try {
      val arr = org.json.JSONArray(json)
      for (i in 0 until arr.length()) {
        val o = arr.getJSONObject(i)
        val text = o.optString("text")
        if (text.isBlank()) continue
        if (o.optString("role") == "user") out.add(Message.user(text)) else out.add(Message.model(text))
      }
    } catch (t: Throwable) {
      Log.w("LiteRt", "history parse failed", t)
    }
    return out
  }

  private fun pngBytes(path: String): ByteArray? {
    return try {
      val bmp = BitmapFactory.decodeFile(path) ?: return null
      val stream = ByteArrayOutputStream()
      bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, stream)
      stream.toByteArray()
    } catch (t: Throwable) {
      Log.w("LiteRt", "image decode failed", t)
      null
    }
  }

  private fun closeConversation() {
    try { conversation?.close() } catch (_: Throwable) {}
    conversation = null
  }

  private fun releaseInternal() {
    closeConversation()
    try { engine?.close() } catch (_: Throwable) {}
    engine = null
    modelPath = null
    visionEnabled = false
  }
}
