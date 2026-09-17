# Worthfolio Mobile

Native, personal, read-only Worthfolio companion built with Expo SDK 57, React Native 0.86, and TypeScript. Android is the first validation target; iOS device validation is deferred.

The native foundation is implemented: Portfolio, Watchlists, Search, Instrument, Account, and Sign-in screens; labeled development fixtures; API contracts; session-isolated query caches; and direct Authentik login using a public mobile client with PKCE. M2 authentication is complete: hosted login, authenticated bootstrap, and logout pass on the emulator, with physical-phone testing confirmed by the user. M3 portfolio/watchlists are complete, including coordinated quote refresh and failure recovery. M4 adds cancellable search, focused chart refresh, touch/accessibility inspection, and range selection; automated/emulator checks pass and the user confirmed physical-phone feature acceptance. M5 is complete: the standalone APK was built and verified locally, and the user confirmed release acceptance after the physical-phone checklist. See [RELEASE.md](RELEASE.md) for the APK identity, evidence, and documented limitations.

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

For local standalone testing, first configure the release signing key as described in [RELEASE.md](RELEASE.md):

```bat
npx expo run:android --variant release --device Pixel_10
```

The release variant bundles JavaScript and disables sample access. Local releases now use the downloaded EAS signing key; missing release credentials fail the build instead of silently using the debug key. Normal debug builds retain their own key. If Android reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, replacing the installed app requires matching its key or uninstalling it first (which clears its local data). Local Expo commands use local environment configuration, not the `eas.json` profile's environment.

When explicitly requested, the alternative cloud command is:

```bat
npx eas-cli build --platform android --profile preview
```

The preview profile bundles JavaScript into an installable APK and does not require Metro. It uses the configured HTTPS API origin and disables sample access. No app-store submission or OTA update workflow is configured.

## Authentication

The app uses the separate **public** Authentik mobile client:

- Issuer: `https://auth.pripyat.cloud/application/o/worthfolio-mobile/`
- Discovery: `https://auth.pripyat.cloud/application/o/worthfolio-mobile/.well-known/openid-configuration`
- Client ID: `9k33r6Ly7z3MYeKYP8JWqjAQKUbxWFoti107Q7Yx`
- In the Authentik provider, register **Strict** redirect URI `worthfolio://auth/callback` and enable the `openid`, `profile`, and `email` scope mappings.

No client secret is required or stored. Keep the existing web client unchanged. These public defaults are in `src/lib/config.ts`; `.env.example` documents optional `EXPO_PUBLIC_OIDC_ISSUER` and `EXPO_PUBLIC_OIDC_CLIENT_ID` overrides. The API origin remains `https://worthfolio.pripyat.cloud`.

Sign-in opens the system browser with Authorization Code + S256 PKCE, exchanges the returned code at Authentik, then reads Worthfolio bootstrap using the access token. The app saves a session only after that read succeeds. There is no `/auth/mobile/*` dependency or `mobileAuth` health gate in this flow. A 401/403 after Authentik login means API access was denied: the backend needs mobile-token validation, or server access rules may be blocking the request.

The hosted backend must validate the mobile issuer and access-token audience/client binding, preserve the existing portfolio identity, enforce read-only access, and honor expiry/revocation. Creating an Authentik client alone does not implement those API checks. See [the hosted API requirements](design.md#hosted-api-prerequisites-and-authorization).

SecureStore holds only the access token, expiry, and API/issuer/client binding. No refresh tokens are requested and ID tokens are not consumed. Token expiry requires signing in again. Logout clears local data and attempts Authentik token revocation; it does not sign out the browser's SSO session. Offline logout cannot guarantee immediate remote revocation.

M2 is complete. Live emulator sign-in/sign-out pass; the user confirms matching web/mobile accounts, physical-phone testing, and passing hosted read-only/account-isolation/expiry/revocation/web-login tests. The local suite passes 51 tests, including authentication routing and cache isolation. These evidence sources are recorded separately in `milestones.md`. No local backend changes or deployment are authorized. The client code uses the already installed native dependencies, so reload the development client with Metro; no new cloud build is needed.

## Portfolio and watchlist refresh

M3 uses one session-owned refresh coordinator. While online and foregrounded, it refreshes held symbols plus the currently open watchlist every 90 seconds, with at most three market requests in flight. Pull-to-refresh updates quotes as well as list/portfolio data; duplicate requests share work. Each holding refresh ends by reloading the backend's authoritative summary rather than calculating a second portfolio total in the app.

Backgrounding, disconnecting, or signing out cancels obsolete requests. A running offline app retains its in-memory snapshot with an offline notice; a fresh offline launch requires reconnection. Invalid, stale, synthetic, or failed quote responses preserve previous real data with a warning. Provider source, timestamps, delayed/cached status, partial coverage, and missing FX are shown without inventing prices or exchange rates.

Watchlist selection is local to the server/account. Only the selected list ID is stored in AsyncStorage; holdings, quotes, and account responses are not persisted. Deleted lists fall back to the server's active list, then its first list. Browsing and refresh use GET endpoints and never write server watchlist selection or chart settings.

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

M1 validation passed: clean installation, TypeScript, ESLint, 13 Jest tests, Expo Doctor (21/21), Android bundle export, cloud development APK build, and the native navigation smoke check. M2 adds user-confirmed physical-device authentication; standalone release and the remaining feature checks are tracked in [milestones.md](milestones.md).

Local Windows follow-up (2026-09-17): reproduced the Worklets/Screens CMake failures with JDK 25, then passed both tasks with Microsoft JDK 17.0.20.1. After configuring user-level Java/SDK settings, the standard `npx expo run:android --device Pixel_10 --no-bundler` command built successfully in 23 seconds from `W:\worthfolio-mobile`, installed the APK, and opened it on Pixel 10. `--no-bundler` reused the existing Metro setup for this check. The resulting `android/app/build/outputs/apk/debug/app-debug.apk` targets the x86_64 emulator and requires Metro. The custom CMD launcher has been removed.

At the foundation checkpoint, npm reports 13 moderate advisories in Expo's transitive tooling/router dependencies. The audit's suggested forced fixes include downgrading Expo across major versions; these were not applied. Review compatible upstream fixes during dependency maintenance rather than using `npm audit fix --force`.

## Project documents

- [Agent instructions](AGENTS.md)
- [Architecture and product design](design.md)
- [Milestones and remaining acceptance checks](milestones.md)
- [Local release, signing, installation, and troubleshooting](RELEASE.md)
