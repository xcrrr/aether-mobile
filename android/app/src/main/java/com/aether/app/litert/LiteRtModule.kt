@file:OptIn(com.google.ai.edge.litertlm.ExperimentalApi::class)

package com.aether.app.litert

import android.graphics.Bitmap
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

  /** Build + initialise the engine. Gallery defaults vision to GPU ("must be GPU for Gemma
   *  3n") but exposes a CPU vision option (Accelerator.CPU -> Backend.CPU); some devices
   *  can't compile the GPU vision graph (vision_litert_compiled_model_executor INTERNAL
   *  error). So we keep vision ALIVE by falling back GPU→CPU vision before ever going
   *  text-only — a slower vision encoder still lets the model see the image, which a blind
   *  text engine cannot. Text-only is the last resort just so the app always loads. */
  private fun createEngine(path: String, maxTokens: Int): EngineResult {
    // Gallery only sets cacheDir for adb-pushed /data/local/tmp models; app-owned files
    // pass null. Match that — an unexpected cacheDir can perturb graph init.
    val cacheDir = if (path.startsWith("/data/local/tmp")) ctx.getExternalFilesDir(null)?.absolutePath else null
    // (mainGpu, vision backend). Vision-preserving rungs first; text-only only as a fallback.
    val ladder = listOf(
      Triple(true, Backend.GPU() as Backend?, "GPU"),
      Triple(false, Backend.GPU() as Backend?, "GPU"),
      Triple(true, Backend.CPU() as Backend?, "CPU"),
      Triple(false, Backend.CPU() as Backend?, "CPU"),
      Triple(true, null, "none"),
      Triple(false, null, "none"),
    )
    var lastErr: Throwable? = null
    for ((mainGpu, visionBackend, visLabel) in ladder) {
      try {
        val config = EngineConfig(
          modelPath = path,
          backend = if (mainGpu) Backend.GPU() else Backend.CPU(),
          visionBackend = visionBackend,
          audioBackend = null,
          maxNumTokens = maxTokens,
          cacheDir = cacheDir,
        )
        val eng = Engine(config)
        eng.initialize()
        Log.i("LiteRt", "engine ready (mainGpu=$mainGpu vision=$visLabel)")
        return EngineResult(eng, mainGpu, visionBackend != null)
      } catch (t: Throwable) {
        lastErr = t
        Log.w("LiteRt", "engine attempt failed (mainGpu=$mainGpu vision=$visLabel): ${t.message}")
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
    maxOutputTokens: Int,
    promise: Promise,
  ) {
    worker.execute {
      val e = engine
      if (e == null) { promise.reject("LITERT_NO_MODEL", "No model loaded"); return@execute }
      cancelled = false
      val useImages = visionEnabled && imagePaths.size() > 0
      try {
        // litertlm supports ONE conversation/session at a time. Force-close the prior
        // one HERE (start of the next generate), never inside the callback: closing
        // from within onDone/onError runs on litertlm's generation thread and can
        // deadlock, so onDone never returns → the reply "never stops" and the lingering
        // session makes the next createConversation throw "session already exists".
        forceCloseConversation()

        val convo = e.createConversation(
          ConversationConfig(
            samplerConfig = SamplerConfig(topK = topK, topP = topP, temperature = temperature),
            systemInstruction = if (systemPrompt.isNotBlank()) Contents.of(systemPrompt) else null,
            initialMessages = parseHistory(historyJson),
          ),
        )
        conversation = convo

        // EXACTLY how Google's AI Edge Gallery feeds images: decode to a Bitmap,
        // PNG-compress, and pass Content.ImageBytes (Content.ImageFile is not wired
        // through the 0.11.0 JNI). Image/audio go BEFORE the text so the last token
        // is the prompt.
        val contents = mutableListOf<Content>()
        if (useImages) {
          for (i in 0 until imagePaths.size()) {
            val p = imagePaths.getString(i)?.removePrefix("file://") ?: continue
            decodeScaled(p)?.let { contents.add(Content.ImageBytes(it.toPngByteArray())) }
          }
        }
        if (lastText.isNotBlank()) contents.add(Content.Text(lastText))

        // litertlm's onMessage may deliver either a delta or the full text-so-far.
        // Track both: keep the accumulated text and only emit the new tail.
        val acc = StringBuilder()
        var settled = false
        convo.sendMessageAsync(
          Contents.of(contents),
          object : MessageCallback {
            override fun onMessage(message: Message) {
              if (cancelled || settled) return
              val s = message.toString()
              if (s.isEmpty()) return
              val delta: String
              if (s.length >= acc.length && s.startsWith(acc)) {
                delta = s.substring(acc.length); acc.setLength(0); acc.append(s)
              } else {
                delta = s; acc.append(s)
              }
              if (stream && delta.isNotEmpty()) emit("LiteRtToken", delta)
              // Hard output cap (used by research to keep answers — and latency —
              // bounded). ~4 chars/token is a safe approximation. Resolve now and
              // cancel the run from the worker thread (never this gen thread).
              if (maxOutputTokens > 0 && acc.length >= maxOutputTokens * 4) {
                settled = true
                promise.resolve(acc.toString())
                worker.execute { try { conversation?.cancelProcess() } catch (_: Throwable) {} }
              }
            }
            override fun onDone() {
              // Do NOT close the conversation here (would deadlock on the gen thread).
              if (settled) return
              settled = true
              promise.resolve(acc.toString())
            }
            override fun onError(throwable: Throwable) {
              if (settled) return
              settled = true
              if (throwable is CancellationException) {
                promise.resolve(acc.toString())
              } else {
                Log.e("LiteRt", "generate error", throwable)
                promise.reject("LITERT_GEN", throwable.message ?: "generation failed", throwable)
              }
            }
          },
          emptyMap(),
        )
      } catch (t: Throwable) {
        Log.e("LiteRt", "generate failed", t)
        promise.reject("LITERT_GEN", t.message ?: "generation failed", t)
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    cancelled = true
    // Only cancel the running generation; the conversation is closed by the next
    // generate (closing here, possibly on the gen thread, risks a deadlock).
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

  /** Decode an image file, downscaling so a full-res phone photo (12 MP+) doesn't OOM
   *  when PNG-compressed. The vision encoder works fine from a ~1280px image. */
  private fun decodeScaled(path: String, maxDim: Int = 1280): Bitmap? {
    return try {
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(path, bounds)
      if (bounds.outWidth <= 0) return null
      var sample = 1
      val longest = maxOf(bounds.outWidth, bounds.outHeight)
      while (longest / sample > maxDim) sample *= 2
      BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
    } catch (t: Throwable) {
      Log.w("LiteRt", "image decode failed", t)
      null
    }
  }

  private fun Bitmap.toPngByteArray(): ByteArray {
    val stream = ByteArrayOutputStream()
    compress(Bitmap.CompressFormat.PNG, 100, stream)
    return stream.toByteArray()
  }

  /** Cancel any in-flight generation, then close the conversation. Always called from
   *  the worker thread (start of generate / release), never the litertlm gen thread. */
  private fun forceCloseConversation() {
    val c = conversation ?: return
    conversation = null
    try { c.cancelProcess() } catch (_: Throwable) {}
    try { c.close() } catch (_: Throwable) {}
  }

  private fun releaseInternal() {
    forceCloseConversation()
    try { engine?.close() } catch (_: Throwable) {}
    engine = null
    modelPath = null
    visionEnabled = false
  }
}
