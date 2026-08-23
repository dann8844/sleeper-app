const { withMainApplication } = require('@expo/config-plugins');

/**
 * Registers ONNX Runtime's ReactPackage with React Native.
 *
 * onnxruntime-react-native's own config plugin adds only the Gradle dependency,
 * and RN autolinking does not derive its ReactPackage class — so the native code
 * compiles into the APK but `NativeModules.Onnxruntime` is null at runtime. The
 * package then throws `Cannot read property 'install' of null` on import, which
 * takes down app startup.
 */
const IMPORT = 'import ai.onnxruntime.reactnative.OnnxruntimePackage';
const ADD    = '              add(OnnxruntimePackage())';

module.exports = function withOnnxruntimePackage(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (config.modResults.language !== 'kt') {
      throw new Error('withOnnxruntimePackage expects a Kotlin MainApplication');
    }

    if (!contents.includes(IMPORT)) {
      contents = contents.replace(
        /^import com\.facebook\.react\.PackageList$/m,
        `import com.facebook.react.PackageList\n${IMPORT}`,
      );
    }

    if (!contents.includes('add(OnnxruntimePackage())')) {
      const anchor = 'PackageList(this).packages.apply {';
      if (!contents.includes(anchor)) {
        throw new Error('withOnnxruntimePackage: could not find the packages block');
      }
      contents = contents.replace(anchor, `${anchor}\n${ADD}`);
    }

    config.modResults.contents = contents;
    return config;
  });
};
