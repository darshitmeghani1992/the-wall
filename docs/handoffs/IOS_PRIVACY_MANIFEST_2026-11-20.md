# iOS privacy manifest — pre-signing audit (20 Nov 2026)

**Status:** Source configuration and disposable native prebuild verification only; **not an Apple App Store privacy approval**. No Apple Developer account, signing, TestFlight distribution or device test is claimed.

Apple requires apps calling covered native APIs to declare approved reasons in `PrivacyInfo.xcprivacy`. Expo SDK 51 supports `expo.ios.privacyManifests` in `app.json` and currently disables automatic pod-manifest aggregation by default. We examined the *actual pinned installed* SDK 51 iOS dependency privacy manifests before selecting categories/reasons:

| Shipped native dependency manifest | Declared access |
|---|---|
| `react-native/template/ios/HelloWorld/PrivacyInfo.xcprivacy` | FileTimestamp `C617.1`; UserDefaults `CA92.1`; SystemBootTime `35F9.1` |
| `expo-file-system/ios/PrivacyInfo.xcprivacy` | FileTimestamp `0A2A.1`, `3B52.1`; DiskSpace `E174.1`, `85F4.1` |
| `expo-application/ios/PrivacyInfo.xcprivacy` | FileTimestamp `C617.1` |
| `expo-notifications/ios/PrivacyInfo.xcprivacy` | UserDefaults `CA92.1` |
| `expo-constants/ios/PrivacyInfo.xcprivacy` | UserDefaults `CA92.1` |
| `@react-native-async-storage/async-storage/ios/PrivacyInfo.xcprivacy` | FileTimestamp `C617.1` |

We configured only these accessed API/reason categories; we **did not** assert `NSPrivacyCollectedDataTypes=[]`, because The-Wall's user-generated content, email-based sign-in and analytics require a separate factual App Privacy questionnaire. App tracking/analytics policy, consent notices, push notification details, camera/photos/microphone usage, data retention and third-party service disclosures remain to be reviewed against the deployed product.

`npm run verify:ios-prebuild` now checks that a disposable Expo iOS native project contains `PrivacyInfo.xcprivacy` and the expected categories/reasons. It does not substitute for installing Pods, compiling with current full Xcode, TestFlight validation, Apple privacy review, or physical iPhone QA. Apple Developer account and domain ownership are deferred until 21 Nov by the Founder.

Primary references: https://docs.expo.dev/guides/apple-privacy/ and https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api and https://expo.dev/changelog/2024-05-07-sdk-51
