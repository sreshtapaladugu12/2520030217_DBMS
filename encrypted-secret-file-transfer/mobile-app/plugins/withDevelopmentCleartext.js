const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withDevelopmentCleartext(config) {
  const allowCleartext = process.env.EAS_BUILD_PROFILE !== 'production';
  return withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = String(allowCleartext);
    }
    return modConfig;
  });
};
