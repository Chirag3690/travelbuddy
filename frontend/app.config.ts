import type { ExpoConfig, ConfigContext } from "expo/config";

const IS_PRODUCTION = process.env.APP_VARIANT === "production";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Vinle",
  slug: "vinle",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "vinle",
  userInterfaceStyle: "automatic",
  newArchEnabled: false,
  owner: process.env.EXPO_OWNER,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.vinle.app",
    buildNumber: "1",
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        "Add profile photos to your travel profile",
      NSCameraUsageDescription: "Take a photo for your travel profile",
      ...(IS_PRODUCTION
        ? {}
        : {
            NSAppTransportSecurity: {
              NSAllowsLocalNetworking: true,
            },
          }),
    },
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.vinle.app",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#0F766E",
    },
    ...(IS_PRODUCTION ? {} : { usesCleartextTraffic: true }),
    permissions: ["READ_EXTERNAL_STORAGE", "READ_MEDIA_IMAGES", "CAMERA"],
  },
  androidStatusBar: {
    backgroundColor: "#0F766E",
    barStyle: "light-content",
    translucent: false,
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0F766E",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow Vinle to access your photos to build your travel profile.",
        cameraPermission:
          "Allow Vinle to use your camera for profile photos.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
