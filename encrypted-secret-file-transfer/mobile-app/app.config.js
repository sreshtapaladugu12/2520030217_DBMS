const production = process.env.EAS_BUILD_PROFILE === 'production';
module.exports = ({ config }) => ({
  ...config,
  name: 'Secret Transfer',
  slug: 'encrypted-secret-file-transfer',
  scheme: 'secrettransfer',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  plugins: ['expo-router', 'expo-secure-store', 'expo-document-picker', './plugins/withDevelopmentCleartext'],
  experiments: { typedRoutes: true },
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.example.secrettransfer',
    supportsTablet: true,
    infoPlist: production ? {} : { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } },
  },
  android: { ...config.android, package: 'com.example.secrettransfer' },
  extra: { ...config.extra, router: {} },
});
