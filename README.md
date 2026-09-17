# Worthfolio Mobile

Native, personal, read-only Worthfolio companion built with Expo SDK 57, React Native 0.86, and TypeScript. Android is the first validation target; iOS device validation is deferred.

The native foundation is implemented: Portfolio, Watchlists, Search, Instrument, Account, and Sign-in screens; labeled development fixtures; API contracts; session-isolated query caches; and a client for the planned mobile authentication bridge. The live backend does **not** yet support that bridge. Automatic quote polling and the remaining M2-M5 work are not complete.

## Run locally

Use Node 24 and npm. The examples below use Command Prompt (CMD).

```bat
npm ci
if not exist .env.local copy .env.example .env.local
npm start
```

The example API origin is `https://worthfolio.pripyat.cloud`. Set `EXPO_PUBLIC_DEMO_MODE=true` in `.env.local` to enable **Explore sample portfolio** in development builds. All sample screens carry a visible label, use only synthetic fixture data, and do not call the backend. The preview release profile disables sample access, and the app additionally requires `__DEV__` before allowing it.

The app requires an installed Expo **development build**, not Expo Go. Metro alone does not create an APK. Missing or invalid server configuration is explained on the sign-in screen; configuration must be an HTTPS origin without credentials, a path, query parameters, or a fragment.

## Android development build

Use the standard Expo CLI in **Command Prompt (CMD)**. This Windows account has persistent `JAVA_HOME` (Microsoft JDK 17), `ANDROID_HOME`, and Java/ADB PATH entries configured. Restart your terminal application after environment changes; terminals already open keep their old environment.

```bat
if not exist W:\ subst W: C:\Users\konta\Projects\worth
cd /d W:\worthfolio-mobile
npx expo run:android
```

Expo selects the connected emulator, builds locally, installs the APK, and starts Metro. If you want to explicitly select the emulator or reuse port 8082, use `npx expo run:android --device Pixel_10 --port 8082`. No custom launcher is required, and local compilation does not use EAS quota. The debug APK is under `android/app/build/outputs/apk/debug/`.

For an existing CMD window that still has old settings, refresh them before running Expo:

```bat
set "JAVA_HOME=%LOCALAPPDATA%\Worthfolio\jdk17\jdk-17.0.20.1+1"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
```

Use **JDK 17**: Android Studio's bundled JDK 25 fails this project's Prefab/CMake configuration. On another machine, [install JDK 17](https://learn.microsoft.com/en-us/java/openjdk/download) and adjust the paths. React Native [recommends JDK 17](https://reactnative.dev/docs/set-up-your-environment).

`W:` is a short drive alias for the parent workspace, avoiding Ninja's Windows path limit without moving files. It may need recreating after signing out/restarting Windows. Choose another unused letter if `W:` is assigned elsewhere. Keep the project in a subdirectory (`W:\worthfolio-mobile`), since Expo autolinking does not discover `package.json` at a drive root. See the native libraries' [Windows build guidance](https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/).

Use the installed development client with Metro for ordinary JavaScript/TypeScript changes; no new APK is needed. Expo's `--device` takes the name (`Pixel_10`); ADB's `-s` takes the serial (`emulator-5554`). The ignored `android/local.properties` also records this machine's SDK location. Do not commit machine-specific configuration or downloaded JDK binaries.

EAS cloud builds are optional and must only be started at the user's explicit request to preserve the monthly allowance. If intentionally using the cloud, sign into your own Expo account locally; never paste passwords or tokens into chat or repository files.

```bat
npx eas-cli login
npx eas-cli whoami
npx eas-cli build --platform android --profile development
```

The repository is linked to [@padsbanger/worthfolio-mobile](https://expo.dev/accounts/padsbanger/projects/worthfolio-mobile), project ID `88df6ef6-386b-44de-ab0e-a9bc68b80929`. The dynamic app config accepts optional `EXPO_OWNER` and `EAS_PROJECT_ID` overrides for an intentional project change; ordinary development needs neither override. Project IDs and owner names are public configuration, not credentials. Android signing material is managed by EAS and is not stored in Git.

Install the generated APK on the Android device, run `npm start`, and connect the development client to Metro. The development profile enables sample access. Devices must be able to reach Metro on your local network; use Expo's tunnel option if necessary.

M1's [successful Android development build](https://expo.dev/accounts/padsbanger/projects/worthfolio-mobile/builds/1f198556-87c4-4179-9006-e44b1ad5b4a8) was installed and checked on the Pixel_10 Android 16 emulator. This APK loads JavaScript from Metro, including changes made after the native build; it is not a standalone release.

For a local Windows Android emulator, this setup avoids IPv6 localhost binding problems. Start Metro in one terminal (port 8082 was used for M1 because 8081 was occupied):

```bat
node --dns-result-order=ipv4first node_modules/expo/bin/cli start --dev-client --localhost --port 8082
```

In a second terminal, connect the installed development client:

```bat
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" -s emulator-5554 reverse tcp:8082 tcp:8082
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" -s emulator-5554 shell am start -W -a android.intent.action.VIEW -d "exp+worthfolio-mobile://expo-development-client/?url=http://127.0.0.1:8082" com.worthfolio.mobile
```

For local standalone testing after backend mobile authentication is implemented:

```bat
npx expo run:android --variant release --device Pixel_10
```

The release variant bundles JavaScript and disables sample access. Verify signing and retain the chosen signing key before personal distribution; a local build and the existing EAS build may use different keys. If Android reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, replacing the installed app requires matching its key or uninstalling it first (which clears its local data). Local Expo commands use local environment configuration, not the `eas.json` profile's environment.

When explicitly requested, the alternative cloud command is:

```bat
npx eas-cli build --platform android --profile preview
```

The preview profile bundles JavaScript into an installable APK and does not require Metro. It uses the configured HTTPS API origin and disables sample access. No app-store submission or OTA update workflow is configured.

## Authentication

The configured identity provider is Authentik:

- Discovery: `https://auth.pripyat.cloud/application/o/watchfolio/.well-known/openid-configuration`
- Issuer: `https://auth.pripyat.cloud/application/o/watchfolio/`

The app's API origin is the **Worthfolio server**, not either Authentik URL. The planned backend bridge reuses the existing confidential OIDC client and `<OIDC_PUBLIC_URL>/auth/callback`. The backend, not Authentik, will allowlist `worthfolio://auth/callback` for the final app handoff. Client secrets stay on the backend. Keep existing subject mapping and verify Authentik backchannel logout reaches `<OIDC_PUBLIC_URL>/auth/backchannel-logout`.

The client checks `/api/health` for `mobileAuth: true` before starting login. The current deployment only advertises `authentication: "oidc"`, so **Sign in with Authentik** currently explains that the backend update is required. It does not attempt to repurpose browser cookies. SecureStore is reserved for mobile credentials; portfolio responses and user profiles stay in memory.

## Checks

```bat
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo-doctor
npm run export:android
```

The Android export checks Metro/Hermes bundling; it is **not** an APK build or a substitute for device validation. Tests use synthetic fixtures and mocked transport, not a live portfolio.

To repeat the native M1 navigation check, open a development build at its sign-in screen with sample mode enabled. Dismiss first-use Expo and Android keyboard/stylus tutorials, and drag the floating Expo tools button away from the top-right Account button. Then run against the intended connected Android device:

```bat
python scripts/android-smoke.py --adb "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" --serial emulator-5554
```

The smoke check opens every sample-data screen, verifies key labels, and leaves the sample session. Screenshots and UI trees are written to the Git-ignored `artifacts/m1` directory. It does not log into a real account or clear app storage. Use the serial shown by `adb devices` if yours differs.

M1 validation passed: clean installation, TypeScript, ESLint, 13 Jest tests, Expo Doctor (21/21), Android bundle export, cloud development APK build, and the native navigation smoke check. Physical-device authentication and release checks remain pending in [milestones.md](milestones.md).

Local Windows follow-up (2026-09-17): reproduced the Worklets/Screens CMake failures with JDK 25, then passed both tasks with Microsoft JDK 17.0.20.1. After configuring user-level Java/SDK settings, the standard `npx expo run:android --device Pixel_10 --no-bundler` command built successfully in 23 seconds from `W:\worthfolio-mobile`, installed the APK, and opened it on Pixel 10. `--no-bundler` reused the existing Metro setup for this check. The resulting `android/app/build/outputs/apk/debug/app-debug.apk` targets the x86_64 emulator and requires Metro. The custom CMD launcher has been removed.

At the foundation checkpoint, npm reports 13 moderate advisories in Expo's transitive tooling/router dependencies. The audit's suggested forced fixes include downgrading Expo across major versions; these were not applied. Review compatible upstream fixes during dependency maintenance rather than using `npm audit fix --force`.

## Project documents

- [Agent instructions](AGENTS.md)
- [Architecture and product design](design.md)
- [Milestones and remaining acceptance checks](milestones.md)
