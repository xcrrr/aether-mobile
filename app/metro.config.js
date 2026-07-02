// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle the Second Brain graph page as a static asset so the WebView can load
// it offline (it is self-contained: the 3d-force-graph lib is inlined).
config.resolver.assetExts.push('html');

module.exports = config;
