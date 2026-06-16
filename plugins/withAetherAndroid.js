const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Android build tweaks for Aether:
 *  - build only the arm64-v8a ABI (our sole target -> smaller APK)
 *  - raise AsyncStorage's SQLite ceiling so long histories fit
 */
module.exports = function withAetherAndroid(config) {
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
    return cfg;
  });
};
