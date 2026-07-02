const { withGradleProperties, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Android build tweaks for Aether:
 *  - build only the arm64-v8a ABI (our sole target -> smaller APK)
 *  - raise AsyncStorage's SQLite ceiling so long histories fit
 *  - deduplicate any repeated uses-permission entries (some native modules
 *    inject RECORD_AUDIO via their own manifest and via the Expo plugin layer)
 */
function withAetherGradle(config) {
  return withGradleProperties(config, (cfg) => {
    const set = (key, value) => {
      const i = cfg.modResults.findIndex(
        (p) => p.type === 'property' && p.key === key,
      );
      const entry = { type: 'property', key, value };
      if (i >= 0) cfg.modResults[i] = entry;
      else cfg.modResults.push(entry);
    };
    set('reactNativeArchitectures', 'arm64-v8a');
    set('AsyncStorage_db_size_in_MB', '64');
    // Rewrite legacy com.android.support refs (pulled in by
    // @react-native-voice/voice) to androidx so the manifest/classes merge.
    set('android.enableJetifier', 'true');
    return cfg;
  });
}

function withDeduplicatePermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const perms = manifest['uses-permission'] ?? [];
    const seen = new Set();
    manifest['uses-permission'] = perms.filter((p) => {
      const name = p.$?.['android:name'];
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
    return cfg;
  });
}

/**
 * Declare the speech-recognition intent in <queries> so the on-device
 * recognizer is visible under Android 11+ package-visibility filtering.
 * Without it @react-native-voice/voice can't resolve a RecognitionService and
 * Voice.start() throws ("Could not start voice input").
 */
function withSpeechRecognitionQuery(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries ?? [];

    const actions = [
      'android.speech.RecognitionService',
      'android.speech.action.RECOGNIZE_SPEECH',
    ];
    const packages = [
      'com.google.android.googlequicksearchbox',
      'com.google.android.tts',
      'com.google.android.as',
      'com.samsung.android.bixby.agent',
    ];

    const hasAction = (action) =>
      manifest.queries.some((q) =>
        (q.intent ?? []).some((i) =>
          (i.action ?? []).some((a) => a.$?.['android:name'] === action),
        ),
      );
    const hasPackage = (name) =>
      manifest.queries.some((q) =>
        (q.package ?? []).some((p) => p.$?.['android:name'] === name),
      );

    actions.forEach((action) => {
      if (!hasAction(action)) {
        manifest.queries.push({ intent: [{ action: [{ $: { 'android:name': action } }] }] });
      }
    });
    packages.forEach((name) => {
      if (!hasPackage(name)) {
        manifest.queries.push({ package: [{ $: { 'android:name': name } }] });
      }
    });
    return cfg;
  });
}

module.exports = function withAetherAndroid(config) {
  return withSpeechRecognitionQuery(withDeduplicatePermissions(withAetherGradle(config)));
};
