/**
 * Native autolinking overrides.
 *
 * Apple Health (HealthKit) is iOS-only. Its JS layer ships safe no-op stubs for
 * other platforms, and the app only imports it from `.ios.js` files, so Android
 * never calls it. But its native runtime, react-native-nitro-modules, carries
 * Android C++ code that autolinking would otherwise compile into the Play Store
 * build for nothing. Unlink it (and the HealthKit packages, for clarity) on
 * Android so the Android binary is unchanged by the iOS health integration.
 *
 * If an Android feature ever needs a Nitro module, remove the nitro entry here.
 */
module.exports = {
  dependencies: {
    'react-native-nitro-modules': { platforms: { android: null } },
    '@kingstinct/react-native-healthkit': { platforms: { android: null } },
    '@react-native-healthkit/core': { platforms: { android: null } },
  },
};
