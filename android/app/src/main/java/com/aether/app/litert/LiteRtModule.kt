package com.aether.app.litert

import android.graphics.BitmapFactory
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.genai.llminference.GraphOptions
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import java.io.File
import java.util.concurrent.Executors

/**
 * React Native bridge over Google's MediaPipe LiteRT GenAI engine
 * (`com.google.mediapipe:tasks-genai`) — the GPU-native on-device LLM stack behind
 * Google's AI Edge Gallery, running `.task` models. Replaces llama.rn for chat +
 * vision so Gemma decodes images and replies at GPU speed.
 *
 * The `LlmInference` engine is created once per loaded model. Each `generate` opens
 * a fresh session (sampler + optional vision), streams the reply token-by-token over
 * the `LiteRtToken` device event, and resolves with the full text. JS serialises
 * calls so only one session runs at a time.
 */
class LiteRtModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val ctx = reactContext
  private val worker = Executors.newSingleThreadExecutor()

  @Volatile private var engine: LlmInference? = null
  @Volatile private var modelPath: String? = null
  @Volatile private var session: LlmInferenceSession? = null
  @Volatile private var cancelled = false

  override fun getName() = "LiteRt"

  private fun emit(event: String, payload: Any?) {
    ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(event, payload)
  }

  @ReactMethod fun isLoaded(promise: Promise) = promise.resolve(engine != null)
  @ReactMethod fun getLoadedPath(promise: Promise) = promise.resolve(modelPath)

  /** Create the LlmInference engine for a `.task` model (GPU backend, vision-capable). */
  @ReactMethod
  fun init(path: String, maxTokens: Int, promise: Promise) {
    worker.execute {
      try {
        val clean = path.removePrefix("file://")
        if (engine != null && modelPath == clean) { promise.resolve(true); return@execute }
        if (!File(clean).exists()) { promise.reject("LITERT_NO_FILE", "Model file not found: $clean"); return@execute }
        releaseInternal()
        val options = LlmInference.LlmInferenceOptions.builder()
          .setModelPath(clean)
          .setMaxTokens(maxTokens)
          .setPreferredBackend(LlmInference.Backend.GPU)
          .setMaxNumImages(1)
          .build()
        engine = LlmInference.createFromOptions(ctx, options)
        modelPath = clean
        promise.resolve(true)
      } catch (t: Throwable) {
        Log.e("LiteRt", "init failed", t)
        promise.reject("LITERT_INIT", t.message ?: "init failed", t)
      }
    }
  }

  /**
   * Stream a reply for an already-assembled `prompt` (JS builds the full transcript)
   * plus any images. Tokens emit on `LiteRtToken` when `stream` is true; the full
   * text resolves the promise.
   */
  @ReactMethod
  fun generate(
    prompt: String,
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
      var s: LlmInferenceSession? = null
      try {
        val hasImages = imagePaths.size() > 0
        val sessionOptions = LlmInferenceSession.LlmInferenceSessionOptions.builder()
          .setTopK(topK)
          .setTopP(topP.toFloat())
          .setTemperature(temperature.toFloat())
          .setGraphOptions(GraphOptions.builder().setEnableVisionModality(hasImages).build())
          .build()
        s = LlmInferenceSession.createFromOptions(e, sessionOptions)
        session = s

        if (prompt.isNotBlank()) s.addQueryChunk(prompt)
        for (i in 0 until imagePaths.size()) {
          val p = imagePaths.getString(i)?.removePrefix("file://") ?: continue
          val bmp = BitmapFactory.decodeFile(p) ?: continue
          s.addImage(BitmapImageBuilder(bmp).build())
        }

        val sb = StringBuilder()
        s.generateResponseAsync { partial, done ->
          if (!cancelled && partial != null && partial.isNotEmpty()) {
            sb.append(partial)
            if (stream) emit("LiteRtToken", partial)
          }
          if (done) {
            closeSession()
            promise.resolve(sb.toString())
          }
        }
      } catch (t: Throwable) {
        closeSession()
        Log.e("LiteRt", "generate failed", t)
        promise.reject("LITERT_GEN", t.message ?: "generation failed", t)
      }
    }
  }

  /** Best-effort cancel — stops emitting and closes the session. */
  @ReactMethod
  fun stop(promise: Promise) {
    cancelled = true
    closeSession()
    promise.resolve(true)
  }

  @ReactMethod
  fun release(promise: Promise) {
    worker.execute {
      releaseInternal()
      promise.resolve(true)
    }
  }

  // Required so NativeEventEmitter works on the JS side.
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  private fun closeSession() {
    try { session?.close() } catch (_: Throwable) {}
    session = null
  }

  private fun releaseInternal() {
    closeSession()
    try { engine?.close() } catch (_: Throwable) {}
    engine = null
    modelPath = null
  }
}
