const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withBackgroundActionsManifest(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    if (!app.service) app.service = [];

    const svcName = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';
    const existing = app.service.find(s => s.$?.['android:name'] === svcName);

    if (existing) {
      existing.$['android:foregroundServiceType'] = 'microphone';
    } else {
      app.service.push({
        $: {
          'android:name': svcName,
          'android:foregroundServiceType': 'microphone',
        },
      });
    }

    return config;
  });
};
