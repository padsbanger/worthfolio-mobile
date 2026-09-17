# Worthfolio Mobile

Native, personal, read-only Worthfolio companion built with Expo SDK 57, React Native 0.86, and TypeScript. Android is the first validation target; iOS device validation is deferred.

The native foundation is implemented: Portfolio, Watchlists, Search, Instrument, Account, and Sign-in screens; labeled development fixtures; API contracts; session-isolated query caches; and a client for the planned mobile authentication bridge. The live backend does **not** yet support that bridge. Automatic quote polling and the remaining M2-M5 work are not complete.

## Run locally

Use Node 24 and npm. On Windows PowerShell, `npm.cmd` and `npx.cmd` work without changing execution policy.

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd start
```

The example API origin is `https://worthfolio.pripyat.cloud`. Set `EXPO_PUBLIC_DEMO_MODE=true` in `.env.local` to enable **Explore sample portfolio** in development builds. All sample screens carry a visible label, use only synthetic fixture data, and do not call the backend. The preview release profile disables sample access, and the app additionally requires `__DEV__` before allowing it.

The app requires an installed Expo **development build**, not Expo Go. Metro alone does not create an APK. Missing or invalid server configuration is explained on the sign-in screen; configuration must be an HTTPS origin without credentials, a path, query parameters, or a fragment.

## Android development build

Use the installed development client with Metro for ordinary JavaScript/TypeScript changes. These changes do not require another APK build or consume EAS build quota. When native dependencies or native configuration change, build locally with the Android SDK and **JDK 17**. React Native [recommends JDK 17](https://reactnative.dev/docs/set-up-your-environment); Android Studio's bundled JDK 25 fails this project's Prefab/CMake configuration with `WARNING: A restricted method in java.lang.System has been called`.

The Windows setup below uses the standalone Microsoft JDK 17 installed for this workspace. On another machine, [download JDK 17](https://learn.microsoft.com/en-us/java/openjdk/download) and set `JAVA_HOME` to its extracted/installed directory. These environment settings apply only to the current PowerShell session:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "$env:LOCALAPPDATA\Worthfolio\jdk17\jdk-17.0.20.1+1"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
Set-Location W:\worthfolio-mobile
npx.cmd expo run:android --device Pixel_10 --port 8082
```

This workspace also needs a shorter build path for Ninja's Windows path limit. `W:` is a drive alias for `C:\Users\konta\Projects\worth`; no project files were moved. If that alias is absent after signing out/restarting Windows, recreate it with `subst.exe W: C:\Users\konta\Projects\worth` before running the commands above. Choose another unused drive letter if `W:` is already assigned elsewhere. Keep the project in a subdirectory of the alias (`W:\worthfolio-mobile`), since Expo autolinking does not discover `package.json` at a drive root. See the native libraries' [Windows build guidance](https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/).

Adjust the SDK/JDK paths and device name for your machine. Expo's `--device` takes the name (`Pixel_10`); pass `--device` without a value to choose interactively. ADB's `-s` instead takes the serial (`emulator-5554`). Expo generates the ignored `android` directory, builds the APK, and installs it. The debug APK is under `android/app/build/outputs/apk/debug/`. Local Android compilation does not use EAS cloud-build quota.

If Gradle reports `SDK location not found`, set `ANDROID_HOME` in the same terminal before building. For an already generated Android project, the ignored `android/local.properties` can also hold `sdk.dir=C:/Users/konta/AppData/Local/Android/Sdk` (adjust for your account). Do not commit machine-specific paths or downloaded JDK binaries.

EAS cloud builds are optional and must only be started at the user's explicit request to preserve the monthly allowance. If intentionally using the cloud, sign into your own Expo account locally; never paste passwords or tokens into chat or repository files.

```powershell
npx.cmd eas-cli login
npx.cmd eas-cli whoami
npx.cmd eas-cli build --platform android --profile development
```

The repository is linked to [@padsbanger/worthfolio-mobile](https://expo.dev/accounts/padsbanger/projects/worthfolio-mobile), project ID `88df6ef6-386b-44de-ab0e-a9bc68b80929`. The dynamic app config accepts optional `EXPO_OWNER` and `EAS_PROJECT_ID` overrides for an intentional project change; ordinary development needs neither override. Project IDs and owner names are public configuration, not credentials. Android signing material is managed by EAS and is not stored in Git.

Install the generated APK on the Android device, run `npm.cmd start`, and connect the development client to Metro. The development profile enables sample access. Devices must be able to reach Metro on your local network; use Expo's tunnel option if necessary.

M1's [successful Android development build](https://expo.dev/accounts/padsbanger/projects/worthfolio-mobile/builds/1f198556-87c4-4179-9006-e44b1ad5b4a8) was installed and checked on the Pixel_10 Android 16 emulator. This APK loads JavaScript from Metro, including changes made after the native build; it is not a standalone release.

For a local Windows Android emulator, this setup avoids IPv6 localhost binding problems. Start Metro in one terminal (port 8082 was used for M1 because 8081 was occupied):

```powershell
node --dns-result-order=ipv4first node_modules/expo/bin/cli start --dev-client --localhost --port 8082
```

In a second terminal, connect the installed development client:

```powershell
& "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" -s emulator-5554 reverse tcp:8082 tcp:8082
& "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" -s emulator-5554 shell am start -W -a android.intent.action.VIEW -d 'exp+worthfolio-mobile://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082' com.worthfolio.mobile
```

For local standalone testing after backend mobile authentication is implemented:

```powershell
npx.cmd expo run:android --variant release --device Pixel_10
```

The release variant bundles JavaScript and disables sample access. Verify signing and retain the chosen signing key before personal distribution; a local build and the existing EAS build may use different keys. If Android reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, replacing the installed app requires matching its key or uninstalling it first (which clears its local data). Local Expo commands use local environment configuration, not the `eas.json` profile's environment.

When explicitly requested, the alternative cloud command is:

```powershell
npx.cmd eas-cli build --platform android --profile preview
```

The preview profile bundles JavaScript into an installable APK and does not require Metro. It uses the configured HTTPS API origin and disables sample access. No app-store submission or OTA update workflow is configured.

## Authentication

The configured identity provider is Authentik:

- Discovery: `https://auth.pripyat.cloud/application/o/watchfolio/.well-known/openid-configuration`
- Issuer: `https://auth.pripyat.cloud/application/o/watchfolio/`

The app's API origin is the **Worthfolio server**, not either Authentik URL. The planned backend bridge reuses the existing confidential OIDC client and `<OIDC_PUBLIC_URL>/auth/callback`. The backend, not Authentik, will allowlist `worthfolio://auth/callback` for the final app handoff. Client secrets stay on the backend. Keep existing subject mapping and verify Authentik backchannel logout reaches `<OIDC_PUBLIC_URL>/auth/backchannel-logout`.

The client checks `/api/health` for `mobileAuth: true` before starting login. The current deployment only advertises `authentication: "oidc"`, so **Sign in with Authentik** currently explains that the backend update is required. It does not attempt to repurpose browser cookies. SecureStore is reserved for mobile credentials; portfolio responses and user profiles stay in memory.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --runInBand
npx.cmd expo-doctor
npm.cmd run export:android
```

The Android export checks Metro/Hermes bundling; it is **not** an APK build or a substitute for device validation. Tests use synthetic fixtures and mocked transport, not a live portfolio.

To repeat the native M1 navigation check, open a development build at its sign-in screen with sample mode enabled. Dismiss first-use Expo and Android keyboard/stylus tutorials, and drag the floating Expo tools button away from the top-right Account button. Then run against the intended connected Android device:

```powershell
python scripts/android-smoke.py --adb "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" --serial emulator-5554
```

The smoke check opens every sample-data screen, verifies key labels, and leaves the sample session. Screenshots and UI trees are written to the Git-ignored `artifacts/m1` directory. It does not log into a real account or clear app storage. Use the serial shown by `adb devices` if yours differs.

M1 validation passed: clean installation, TypeScript, ESLint, 13 Jest tests, Expo Doctor (21/21), Android bundle export, cloud development APK build, and the native navigation smoke check. Physical-device authentication and release checks remain pending in [milestones.md](milestones.md).

Local Windows follow-up (2026-09-17): reproduced the Worklets/Screens CMake failures with JDK 25, then passed both tasks with Microsoft JDK 17.0.20.1. The full emulator APK build passed from `W:\worthfolio-mobile\android` using `gradlew.bat app:assembleDebug -x lint -x test --build-cache -PreactNativeArchitectures=x86_64 -PreactNativeDevServerPort=8082`. The resulting `android/app/build/outputs/apk/debug/app-debug.apk` targets the x86_64 emulator and requires Metro. Updating the installed EAS APK was rejected due to different signing keys; the existing app was retained.

At the foundation checkpoint, npm reports 13 moderate advisories in Expo's transitive tooling/router dependencies. The audit's suggested forced fixes include downgrading Expo across major versions; these were not applied. Review compatible upstream fixes during dependency maintenance rather than using `npm audit fix --force`.

## Project documents

- [Agent instructions](AGENTS.md)
- [Architecture and product design](design.md)
- [Milestones and remaining acceptance checks](milestones.md)
