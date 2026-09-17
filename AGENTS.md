# Worthfolio Mobile: agent instructions

## Project intent and sources of truth

Build a native, personal, read-only Worthfolio companion with React Native, Expo, and TypeScript. Validate Android first; keep application code compatible with iOS for later validation.

- Read [design.md](design.md) before architectural work and [milestones.md](milestones.md) before implementation.
- This repository contains the mobile client. The existing web/backend repository is `../worthfolio`; its Python package is `../worthfolio/worthfolio`.
- The agreed v1 includes portfolio summaries and holdings, browsing existing watchlists, search, simple instrument charts, and account settings.
- Do not expand v1 into editing, advanced analytics, notifications, persistent offline portfolio storage, or store publication without a user request.
- M1 is complete: the Expo foundation, local checks, cloud development APK, and Android emulator navigation checks passed. See `milestones.md` for remaining backend, refresh, standalone build, and physical-device validation work; do not assume the live backend supports mobile login yet.

## Implementation conventions

- Use Expo development builds, Expo Router, strict TypeScript, and npm. Select a stable Expo SDK when scaffolding, use Expo-compatible native dependency versions, and commit the lockfile.
- Use native React Native components and `StyleSheet`, with shared color, spacing, and typography tokens. Use `react-native-svg` for the v1 price-line chart.
- Keep routes thin. Separate feature screens, API contracts, authentication, quote scheduling, storage, and reusable UI components.
- Use TanStack Query for server state. Wire network and app-focus handling explicitly; do not rely on browser lifecycle behavior.
- Keep the repo independently buildable. Do not use runtime imports from the sibling web repo or introduce a shared package in v1.
- Port only useful platform-independent behavior from the web app, with provenance in comments where appropriate. Do not copy its DOM controller, CSS layout, or canvas chart into the app.
- Reuse backend portfolio reconstruction and aggregate valuation. Do not create a second ledger or recompute aggregate portfolio totals independently on mobile.

## Authentication and data boundaries

- Production connects to one build-configured HTTPS server. An `EXPO_PUBLIC_*` value is public app configuration, never a secret.
- Use the system browser for OIDC. The provider client secret remains on the backend; the app stores only its mobile session credential in Expo SecureStore.
- Mobile access must be read-only at the backend, not merely hidden in the UI. Only the agreed read endpoints and mobile logout accept mobile session tokens.
- Preserve verified OIDC subject ownership, browser CSRF protection, session expiry, and backchannel revocation.
- Keep portfolio responses in memory. AsyncStorage is for non-sensitive preferences only; do not persist query data, holdings, quotes, or user profiles there.
- Cancel in-flight work and clear account data on logout, expiry, or account change. Prevent late responses from repopulating another session's cache.
- Do not log tokens, authorization headers, handoff codes, PKCE verifiers, or complete authentication callback URLs.

## Data correctness and mobile behavior

- Preserve last-known real data on failures. Never use synthetic demo quotes to value a portfolio or display an apparently real chart.
- Show unavailable values as unavailable, not zero. Preserve partial coverage, native currencies, GBX scaling, FX availability, and signed short positions.
- Deduplicate market requests and cap concurrency at three. Pause polling while offline or backgrounded; selected-instrument polling also requires screen focus.
- Watchlist selection, chart range, and navigation preferences remain local. Browsing must not write server watchlist selection or chart state.
- Include loading, empty, retry, stale-data, and expired-session states. Use accessible labels, scalable text, safe-area handling, and comfortable touch targets.

## Verification and delivery

- Preserve the user's limited Expo cloud-build quota. Reuse the installed development client with Metro for JavaScript/TypeScript changes; use local Android compilation when native changes require a new APK. Do not start an EAS cloud build unless the user explicitly requests that build. Earlier cloud-build authorization does not authorize future builds.
- A milestone checkpoint does not itself require a new cloud build. A locally built APK can satisfy native acceptance gates; release gates still require appropriate signing, bundled JavaScript, and physical-device validation.

Use these scripts (on Windows PowerShell, use `npm.cmd` / `npx.cmd` if script execution is restricted):

| Command | Purpose |
| --- | --- |
| `npm ci` | Reproduce the pinned dependency installation |
| `npm run typecheck` | Check TypeScript without emitting output |
| `npm run lint` | Check source without rewriting files |
| `npm test -- --runInBand` | Run Jest/Expo unit and component tests |
| `npx expo-doctor` | Check Expo dependency/configuration compatibility |
| `npx expo start --dev-client` | Run the development client workflow |
| `npx expo run:android --device` | Build locally and install on an Android device/emulator |
| `npx expo run:android --variant release --device` | Build and install a local release variant; verify signing before distribution |
| `npx eas-cli build --platform android --profile preview` | Optional cloud APK build; requires an explicit user request |

- Do not claim checks ran when the toolchain or credentials are unavailable. An Android JavaScript export is not a native APK build or a device test.
- Test meaningful behavior: authentication boundaries, quote preservation/concurrency, valuation presentation, navigation, and failure recovery. Avoid tests that only restate implementation details.
- Run the checks appropriate to a completed code change. Validate browser redirects, background/resume, back navigation, and chart interaction on a real Android device before declaring v1 complete.
- Backend changes belong in the sibling repository and must follow its `AGENTS.md`. Its current rules require rebuilding/restarting the completed backend change and verifying `/api/health`, while preserving persisted volumes.
- Documentation-only changes do not require an application rebuild or restart.
- Update milestone status only with supporting evidence. Report unresolved failures and limitations explicitly.
- At each completed milestone, commit the milestone's changes and pause. Do not start the next milestone until the user resumes work. If a required acceptance check is blocked, report the blocker and leave the milestone incomplete.
