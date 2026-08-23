const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The YAMNet model ships as a bundled asset; Metro ignores unknown extensions.
config.resolver.assetExts.push('onnx');

module.exports = config;
