# Personal Android release

M1-M5 are complete: the signed APK and isolated emulator startup checks pass, and the user confirmed release acceptance after receiving the standalone APK and physical-phone checklist; phone/backend checks are user-reported where identified in `milestones.md`. A development-client check does not establish standalone APK acceptance.

## M12 redesign release (accepted)

Version `0.2.0`, Android build `4`, includes the accepted M6-M11 redesign with Portfolio, Watchlists and Search tabs, company logos, quiet refresh, and the revised instrument chart. Account now uses the shared compact spacing and bottom safe-area padding. Expo/Constants/Router patch versions were aligned with the SDK check. The release uses the existing EAS certificate and the hosted backend/public Authentik client above; no cloud build is required.

Install the M12 release from CMD with the phone connected and USB debugging authorized:

```bat
cd /d C:\Users\konta\Projects\worth\worthfolio-mobile
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" devices
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" -s YOUR_PHONE_SERIAL install -r artifacts\releases\worthfolio-0.2.0-4.apk
```

Then disconnect the computer and use the physical-phone checklist below. Report phone model/Android version, the displayed app version/build, and any failed steps. Review all three tabs, instrument details and Account at normal/enlarged text, including TalkBack names/actions and scrolling. Update installation must preserve an EAS-signed app's session/preferences; do not uninstall a differently signed development client automatically.

Artifact: `artifacts/releases/worthfolio-0.2.0-4.apk` (68,205,047 bytes). SHA-256: `64f7ceaa015ff17f0cca83393b234c42eae0daac1e7dec66a4d3f20c1687a117`. The adjacent JSON records source and bundle hashes. Local `assembleRelease` succeeded in 3m 9s, including release lint. Signature matches the EAS certificate below; both arm64-v8a and x86_64 are included. The APK contains Hermes bytecode, is non-debuggable, disables backup, and contains no signing files.

An `adb install -r` update from M5 version code 2 to code 4 succeeded on the isolated Android 16 emulator. Its saved session survived. With no Metro mappings and Wi-Fi/data disabled, cold startup reached the offline Portfolio state. Re-enabling connectivity loaded real holdings without a new login. The initial automation assertion incorrectly expected a signed-out screen; inspection established the preserved-session state, rather than a startup failure.

M11 source baseline: `8df32b4`. The adjacent APK manifest records hashes of tracked non-Markdown source/configuration files as built, including the M12 changes before their milestone commit. The user accepted M12 on 2026-09-18 after receiving this exact APK and the phone checklist. This is user-reported acceptance; no phone model, Android version or individual authentication/TalkBack traces were supplied.

Validation: TypeScript, ESLint, 126 tests in 16 suites, and Expo Doctor 21/21 pass. Tests cover authentication/cancellation/expiry, account isolation, quiet refresh and offline/resume, logos/fallback, signed and unavailable valuations, search, all chart ranges, and accessible chart actions. Source review found no custom animation additions or disabled font scaling; AsyncStorage remains limited to watchlist selection. Normal/150% native captures cover all redesigned screens, wrapping and long-list scrolling on the isolated emulator; its original 100% setting was restored and read back after relaunch. Loaded data survived offline/background/resume and reconnect. Spoken TalkBack traversal and fresh login/logout/cancellation were included in the requested phone review before user acceptance; they were not independently observed by the agent for this release.

Dependency audit reports 13 moderate findings propagated from `decode-uri-component` and `uuid`. The offered automatic fixes replace Expo/Router with incompatible older major versions; no forced dependency downgrade was applied. This is a recorded dependency limitation, separate from the passing Expo compatibility check.

## M5 build identity (historical)

| Item | Value |
| --- | --- |
| Application | `com.worthfolio.mobile` |
| Version | `0.1.0`, Android version code `2` |
| API | `https://worthfolio.pripyat.cloud` |
| OIDC issuer | `https://auth.pripyat.cloud/application/o/worthfolio-mobile/` |
| Public client ID | `9k33r6Ly7z3MYeKYP8JWqjAQKUbxWFoti107Q7Yx` |
| Redirect | `worthfolio://auth/callback` (Strict) |
| Signing | Existing EAS key, downloaded with user authorization |
| Certificate SHA-256 | `10B954D5689CA15BF6AAEB73A647D27F18650E58D93E198E164D0F076C971F90` |
| Source baseline | M4 commit `f68285a` plus the M5 completion commit containing this record; exact implementation hashes are in the artifact JSON |
| Hosted backend revision | User reports "newest"; exact commit/image digest not supplied |
| APK | `artifacts/releases/worthfolio-0.1.0-2.apk` (68,178,622 bytes) |
| APK SHA-256 | `80291926fd38a56afdfc1b1ce8c5b96b2d5ce846dbdad78a851e86499304da0b` |
| Build result | Local Gradle `assembleRelease`, including release lint, succeeded in 4m 8s on retry |

The adjacent `worthfolio-0.1.0-2.json` records the artifact and Hermes-bundle hashes, certificate, ABIs, M4 base commit, and hashes of the M5 source files as built before the milestone commit. These hashes preserve the exact implementation identity across the documentation-only completion update. Signature verification matches the EAS certificate; the APK is non-debuggable, disables backup, contains the Hermes bundle, and contains neither signing files nor signing passwords.

The certificate fingerprint is public. Passwords/private keys are not app configuration. The deployed backend revision cannot be inferred from a different local checkout.

## Signing credentials

Downloaded `credentials.json` and `credentials/android/keystore.jks` are ignored by Git. Back up both securely and keep the same key for updates. To store them outside this repo, set `WORTHFOLIO_CREDENTIALS_FILE` to the JSON file; `keystorePath` must be absolute or relative to that file's directory.

To download the existing key again without starting a build:

```bat
npx eas-cli credentials -p android
```

Choose **development**, then **credentials.json: Upload/Download**, then **Download credentials from EAS to credentials.json**. Do not generate/rotate a key. See [Expo's credential download workflow](https://docs.expo.dev/guides/local-app-production/).

The config plugin reapplies signing after native regeneration. Gradle reads credentials at build time; they are not embedded in public Expo config or JavaScript. Missing/malformed credentials or the standard `androiddebugkey` alias fail local release builds. Debug builds need no release credentials. EAS retains its own signing injection when explicitly used; no cloud build is required here.

## Build locally in CMD

Use the JDK 17/SDK setup in [README.md](README.md). On this machine:

```bat
if not exist W:\ subst W: C:\Users\konta\Projects\worth
cd /d W:\worthfolio-mobile
set "JAVA_HOME=%LOCALAPPDATA%\Worthfolio\jdk17\jdk-17.0.20.1+1"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
set "NODE_ENV=production"
set "EXPO_PUBLIC_API_URL=https://worthfolio.pripyat.cloud"
set "EXPO_PUBLIC_DEMO_MODE=false"
set "CMAKE_BUILD_PARALLEL_LEVEL=2"
npx expo prebuild --platform android --no-install
cd android
gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 --build-cache
cd ..
```

Output: `android\app\build\outputs\apk\release\app-release.apk`, with bundled JavaScript for 64-bit phones and x86_64 emulators, Android 7/API 24 or later. Local commands read local environment, not an EAS profile. After release work, use a fresh terminal for development.

The standard `npx expo run:android` remains the debug workflow. After signing setup, `npx expo run:android --variant release --device` can also build/install; check the installed app's key first. The explicit architectures above ensure the distributable APK covers both phone and emulator.

On Windows, Expo autolinking resolves SUBST paths to the original drive while Gradle retains the alias. A config plugin adapts paths inside this checkout onto Gradle's drive; external dependencies are unchanged. There is no custom build launcher or dependency-source modification. Expo modules can still fall back from Kotlin incremental compilation on Windows SUBST drives; this slows a cold build but does not indicate APK failure when the final Gradle result is successful. The generated Gradle configuration uses 1024 MB Metaspace and two workers after the template's 512 MB limit failed during release lint analysis.

## Verify and install

```bat
"%ANDROID_HOME%\build-tools\36.0.0\apksigner.bat" verify --verbose --print-certs android\app\build\outputs\apk\release\app-release.apk
certutil -hashfile android\app\build\outputs\apk\release\app-release.apk SHA256
adb devices
adb -s YOUR_DEVICE_SERIAL install -r android\app\build\outputs\apk\release\app-release.apk
```

Use the serial from `adb devices`, authorize USB debugging, and compare the certificate with the fingerprint above. [Android's apksigner](https://developer.android.com/tools/apksigner) checks the signature; a successful check alone does not prove operation without Metro.

Alternatively, copy the APK to the phone and open it, granting that file manager installation permission if prompted. Future updates retain the package/key and increase `android.versionCode`. Updates preserve local preferences/session subject to expiry. Standalone JavaScript changes require a new APK; OTA updates are not configured.

`INSTALL_FAILED_UPDATE_INCOMPATIBLE` means the installed app has another key. This machine's debug key differs from EAS. Do not automatically uninstall: removal clears the local session/preferences. EAS-signed installations can be updated with this release key. A separate release-test emulator preserves the existing debug installation.

## Recorded verification

`npm run typecheck`, `npm run lint`, `npm test -- --runInBand` (101 tests in 14 suites), and `npx expo-doctor` (21/21) pass. The final Gradle release build includes `lintVitalRelease`. Fresh provider discovery matches the configured issuer and advertises Authorization Code, S256, and revocation.

On a separate blank Android 16 emulator, the exact signed APK launched with Wi-Fi/mobile data disabled and no Metro port mapping, displayed the configured server/sign-in screen, omitted sample/dev-client access, and survived force-stop/relaunch. A cold callback showed interrupted-sign-in recovery. This verifies standalone startup/routing, not an authenticated release session; the user subsequently confirmed completion after the phone checklist below. The original development emulator was not replaced or cleared.

## Physical-phone acceptance

The user confirmed milestone completion after receiving this APK and checklist, then requested a commit and pause. This is user-reported acceptance; phone model, Android version, and individual traces were not supplied. The exact deployed backend commit/digest also remains unverified (reported only as "newest"); this disclosed traceability limitation remains in the accepted checkpoint.

For future release validation, install the exact verified APK, disconnect the computer, keep phone internet available, and record device/build details and results:

- Launch without Metro, a development launcher, or sample portfolio access.
- Sign in through Authentik; confirm the same account/portfolio as the web app. Force-stop/relaunch with a valid token and check the saved session.
- Browse Portfolio, Watchlists, Search, and Instrument. Check refresh, chart inspection/ranges, Back, enlarged text, and accessibility actions.
- Background/resume and disconnect/reconnect the network. Loaded data should remain visible with offline/error notices and refresh should recover. Automated tests inject provider failures and verify last-known data preservation.
- Check expiry/401 recovery, browser cancellation/retry, and sign-out. Back after sign-out must not reveal account screens. Expiry is also covered by automated tests; do not change production token lifetimes just for testing.

Capture only sanitized errors and version/build information for troubleshooting. Application source adds no payload/credential logging. Do not share raw callback URLs, tokens, authorization headers, or portfolio dumps.

## Session behavior and limitations

SecureStore holds only the access token, expiry, and server/issuer/client binding. No refresh token is requested; expiry/revocation requires sign-in. Logout clears the local session/cache and attempts remote revocation while browser SSO remains signed in. Offline logout cannot guarantee remote revocation. Backend restart is not assumed to invalidate a signed token.

Portfolio responses remain in memory. Fresh offline launch has no saved portfolio; a running app retains its loaded snapshot. Only local watchlist selection is persisted as a preference. The backend must enforce read-only access and account isolation; the user reported those hosted tests passed in M2. The mobile agent did not run production writes or deploy the backend.

Quotes can be delayed/unavailable; authoritative bootstrap totals can briefly lag an independently refreshed quote. Missing FX stays unavailable. `ALL` charts show available provider history, not necessarily the full lifetime. iOS, editing, persistent offline portfolios, longer sessions, and store publication remain outside this release.
