# Worthfolio Mobile design

Status: agreed v1 design; M1 native foundation built and validated on an Android emulator. Backend mobile authentication, physical-device validation, and the remaining release gates are pending. See `milestones.md` for evidence and remaining work.

## Goal and scope

Create a native, personal, read-only companion for an existing Worthfolio HTTPS deployment protected by OpenID Connect. Deliver an Android APK using local builds by default; Expo Application Services (EAS) is an optional cloud build service. Keep code compatible with iOS, but defer iOS device validation and release until after Android v1.

V1 supports portfolio summaries and open holdings, existing watchlists, market search, instrument details with simple line charts, and account settings. It excludes editing, transaction-history screens, advanced analytics, chart indicators/overlays, notifications, persistent offline portfolio storage, app-store publication, and OTA updates.

Success means the same account sees matching backend portfolio totals for the same quote snapshot, can browse instruments comfortably on a phone, and cannot change portfolio or watchlist settings through its mobile credential.

## Existing system and reuse

The sibling `../worthfolio` repository contains a Flask backend, SQLite persistence, market-provider integrations, and a React web application. The Python package is `../worthfolio/worthfolio`. Account data is scoped by verified OIDC subject; public market caches are shared.

The web UI contains a substantial browser-specific controller and canvas chart. Rebuild the presentation natively. Reuse existing HTTP APIs, backend calculations, response semantics, and suitable framework-independent quote-queue behavior.

Existing browser authentication uses opaque cookies and CSRF tokens. Sessions live in process memory. The mobile authentication bridge described below is new work; it is not already supported by the backend.

## Screens and navigation

Use three bottom tabs: Portfolio, Watchlists, and Search. Instrument details and Settings are stack screens. Open Settings from an account button in the Portfolio header. Authentication sits outside the signed-in navigation group.

| Screen | V1 behavior |
| --- | --- |
| Sign in | Check server health/capability, launch browser sign-in, and handle cancellation, failure, and retry |
| Portfolio | Holdings-only value, invested amount, open P&L, coverage/freshness information, and a virtualized holdings list |
| Watchlists | Select an existing named list locally; show symbols, prices, daily changes, and quote status |
| Search | Debounced backend search; open a result's instrument details without adding it to a watchlist |
| Instrument | Name, symbol, native-currency price, daily change when available, the user's position when held, and a price-line chart |
| Settings | Account identity, read-only server address, app version, and sign out |

Holdings show quantity, latest price, base-currency value, and open P&L where calculable. Preserve signed quantities and distinguish missing prices or conversions from zero. Use the backend summary for header totals and display incomplete valuation coverage explicitly.

The chart plots real candle close observations. Offer `1D`, `5D`, `1M`, `6M`, `1Y`, and `ALL`, defaulting to `1M`. Display the actual returned date span: the current backend's `ALL` range is bounded provider history, not a guarantee of an instrument's complete lifetime. Touch inspection selects the nearest observation and displays its time and price. Handle empty, single-point, and flat series. V1 has no pan/zoom, candles, indicators, event markers, or extended-hours controls.

Use Worthfolio's dark palette, native screen transitions, safe areas, scalable text, accessible labels, and touch targets of at least 48 logical pixels. Pull-to-refresh is available on Portfolio and Watchlists. Do not rely on color alone for gain/loss or quote status.

## Client architecture

- Expo development builds, Expo Router, strict TypeScript, npm, and a pinned lockfile. Use stable SDK-compatible dependencies selected during scaffolding.
- Suggested source layout: `src/app` for routes, `src/features` for screens and feature logic, `src/api` for transport/contracts, `src/auth` for sessions, and `src/components`, `src/theme`, and `src/lib` for shared code.
- TanStack Query owns in-memory server state. React state/context owns session lifecycle and local UI state; no additional global state library is required for v1.
- Use `expo-web-browser` for the backend-mediated browser session, `expo-crypto` for state/PKCE material, SecureStore for the mobile credential, AsyncStorage for non-sensitive preferences, and NetInfo plus React Native AppState for network/focus handling.
- Render the simple line chart using `react-native-svg` and React Native touch handling, with pure coordinate/nearest-point helpers.
- Keep TypeScript API contracts separate from display models. Validate essential response fields at the transport boundary and preserve unknown optional fields for forward compatibility.
- Configure the server through `EXPO_PUBLIC_API_URL`. Require HTTPS in distributable builds. Default app identifier: `com.worthfolio.mobile`; callback URI: `worthfolio://auth/callback`.

## API and refresh behavior

| Existing endpoint | Use |
| --- | --- |
| `GET /api/health` | Connectivity and authentication capability check; public |
| `GET /api/bootstrap` | Account, positions, authoritative portfolio summary, watchlists, refresh settings, and authenticated identity |
| `GET /api/watchlists` | Reload existing named lists without changing server selection |
| `GET /api/search?q=...` | Account-scoped instrument search |
| `GET /api/market?symbol=...&range=...` | Quotes and chart observations; use existing `refresh=1` semantics for scheduled/manual refresh |

Use a typed fetch wrapper with cancellation and a 30-second timeout. Encode symbols and queries as query parameters. Debounce search by 300 ms, require two trimmed characters, and cancel superseded searches. Do not retry authentication failures; allow at most one automatic retry for transient read failures, followed by an explicit retry state.

Refresh held symbols and the locally displayed watchlist every 90 seconds while the app is active and online. Use `1D` market requests for daily quote information. Deduplicate identical requests across manual, scheduled, and selected-instrument work; cap all market requests at three in flight. A focused chart uses its requested range and the backend's `selectedRefreshSeconds`, defaulting to five seconds if omitted. Selected-instrument work stops on screen blur; no interval may launch overlapping work for the same query.

Load bootstrap first so cached valuations appear immediately. After each holding-quote refresh round, reload bootstrap to obtain updated authoritative totals. Reload watchlists on Watchlists focus and pull-to-refresh. Keep the locally selected watchlist if it still exists; otherwise use the server's active list, then the first available list, then an empty state. Never call server selection/chart-state write endpoints.

Preserve quote source, timestamps, and cached/delayed/stale/unavailable distinctions. Retain last-known real values when a response is stale, invalid, synthetic, or failed. Do not plot a synthetic fallback as real history; show an unavailable state when no real series exists. Do not request corporate events or extended-hours data in v1.

Bootstrap remains authoritative for aggregate valuation. Display-only position calculations follow the backend's quantity, average price, `baseRate`, and GBX scaling rules. Missing conversion rates produce unavailable/partial values, not invented conversions. A summary refresh may briefly lag independently refreshed quote labels; retain its own timestamp and do not imply one simultaneous quote snapshot.

On background/offline transitions, stop scheduling requests and cancel unnecessary pending work. Retain in-memory data with stale/offline labels. On reconnect/resume, refresh stale visible data through the normal deduplicated queue. A fresh offline launch requires reconnection; no portfolio data is restored from disk.

## Mobile authentication bridge

Keep the current OIDC client and provider callback so the mobile user resolves to the same existing subject and portfolio. Do not embed a provider secret, reuse browser cookies as mobile credentials, or use an embedded WebView for login.

The actual backend origin is `https://worthfolio.pripyat.cloud`. Its provider is Authentik with discovery at `https://auth.pripyat.cloud/application/o/watchfolio/.well-known/openid-configuration` and issuer `https://auth.pripyat.cloud/application/o/watchfolio/`. Public discovery was verified to support authorization code, S256, RS256, `client_secret_basic`, and backchannel logout. Reuse this provider and its existing subject mapping. Register only the backend OIDC callback with Authentik; the final `worthfolio://auth/callback` redirect belongs in Worthfolio's mobile allowlist. Authentik's configured backchannel destination still needs verification during M2.

### Flow and interfaces

1. The app generates fresh state and a PKCE verifier/challenge, then opens `GET /auth/mobile/login` in the system browser with `state`, `code_challenge`, and the configured `redirect_uri`. Only S256 is supported.
2. The backend validates the exact registered mobile redirect, stores a bounded pending mobile login record, and starts its existing provider authorization-code flow. The provider state, nonce, PKCE verifier, and browser binding remain separate from the mobile handoff state/challenge.
3. The existing `/auth/callback` verifies the provider response and subject. For a mobile login, create a separate mobile session and a 60-second single-use handoff code bound to the session, mobile challenge, and redirect. Return only the handoff code and original mobile state to the app URI.
4. The app verifies state and calls `POST /auth/mobile/token` with `code`, `code_verifier`, and `redirect_uri`. Verify and consume the handoff atomically; return `accessToken`, `tokenType: "Bearer"`, and `expiresAt`. Never return provider credentials. Remove abandoned sessions after their handoff expires.
5. Store the mobile credential and expiry in SecureStore. Use `Authorization: Bearer ...` for supported API reads. Keep the verifier/state only for the pending flow and clear them after success or cancellation; if the app process dies, restart sign-in.
6. `POST /auth/mobile/logout` requires the mobile bearer credential and revokes only that mobile session. Clear the local credential, account cache, and navigation state even if logout cannot reach the server. An unreachable session remains valid remotely until expiry or revocation.

Enable the bridge only when OIDC and an explicit mobile redirect allowlist are configured. Add a boolean `mobileAuth` capability to `/api/health`; absence or false produces a mobile-auth-not-supported message in the app. Authentication failures return bounded JSON errors for app-facing endpoints; browser-flow errors provide a recoverable sign-in result without credential details.

### Session and authorization rules

- Tag browser and mobile session records distinctly. Browser cookie authentication must not accept mobile session tokens, and bearer authentication must not accept browser session IDs.
- A supplied invalid bearer token fails authentication; it must not fall back to a browser cookie or unauthenticated account.
- Mobile sessions allow only GET/HEAD access to bootstrap, watchlists, search, and market endpoints, plus POST mobile logout. Health and handoff initiation/exchange have their own public validation rules. Reject all other mobile-authenticated operations.
- Preserve existing browser CSRF requirements. Exempt only the explicitly designed mobile handoff exchange and bearer-authenticated logout from cookie-CSRF handling.
- Continue resolving account ownership from the verified OIDC subject. Existing backchannel logout must revoke matching mobile sessions and prevent pending handoffs from restoring them.
- Use the existing `OIDC_SESSION_TTL`, currently 12 hours by default. Sessions remain in memory and are invalidated by server restarts. V1 adds no refresh tokens or database migration.
- On expiry/401, stop requests, erase credentials and account data, and show sign-in. Namespace caches by server/account and guard completions with the active session generation to reject late responses.

## Build, rollout, and verification

Preserve the user's limited EAS cloud-build quota. Reuse the installed development client and Metro for JavaScript/TypeScript iteration, and compile Android locally when native changes require it. Start a cloud build only when the user explicitly requests that build. Milestone completion does not require consuming cloud quota. A locally built and appropriately signed standalone APK can satisfy the Android release gate.

Define an EAS `development` profile for the development client and a `preview` profile producing a standalone signed Android APK with its JavaScript bundled. The preview APK must launch without Metro. Supply the actual server URL, Expo project/account configuration, and signing credentials during setup; do not commit secrets.

Deploy the additive backend bridge before distributing the app. Keep web endpoints and browser behavior compatible. Follow the backend repo's rebuild/restart and health-check instructions after completed backend code changes, preserving volumes. Disable mobile-auth capability or remove the redirect allowlist to stop new mobile sign-ins if rollback is needed; restart also revokes existing in-memory sessions.

Use backend HTTP tests for the auth boundary, Jest with the Expo preset and React Native Testing Library for mobile behavior, and real Android checks for browser redirects and native lifecycle/gestures. Use isolated backend databases and mocked providers for automated tests; never run test schedulers against live portfolio data.

Log sanitized endpoint/status/duration diagnostics only. V1 adds no external analytics or crash-reporting service. The detailed delivery gates are in [milestones.md](milestones.md).

## Reference documentation

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo browser authentication](https://docs.expo.dev/guides/authentication/)
- [Expo SVG support](https://docs.expo.dev/versions/latest/sdk/svg/)
- [TanStack Query with React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)
- [EAS internal distribution](https://docs.expo.dev/build/internal-distribution/)
