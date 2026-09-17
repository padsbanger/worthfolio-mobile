# Worthfolio Mobile design

Status: agreed v1 design; M1 foundation and M2 authentication are complete. Hosted login/bootstrap/logout were verified on the emulator; the user confirmed physical-phone testing and hosted authorization tests. M3-M5 features and release gates remain pending. See `milestones.md` for evidence and remaining work.

## Goal and scope

Create a native, personal, read-only companion for an existing Worthfolio HTTPS deployment protected by OpenID Connect. Deliver an Android APK using local builds by default; Expo Application Services (EAS) is an optional cloud build service. Keep code compatible with iOS, but defer iOS device validation and release until after Android v1.

V1 supports portfolio summaries and open holdings, existing watchlists, market search, instrument details with simple line charts, and account settings. It excludes editing, transaction-history screens, advanced analytics, chart indicators/overlays, notifications, persistent offline portfolio storage, app-store publication, and OTA updates.

Success means the same account sees matching backend portfolio totals for the same quote snapshot, can browse instruments comfortably on a phone, and cannot change portfolio or watchlist settings through its mobile credential.

## Existing system and reuse

The sibling `../worthfolio` repository contains a Flask backend, SQLite persistence, market-provider integrations, and a React web application. The Python package is `../worthfolio/worthfolio`. Account data is scoped by verified OIDC subject; public market caches are shared.

The web UI contains a substantial browser-specific controller and canvas chart. Rebuild the presentation natively. Reuse existing HTTP APIs, backend calculations, response semantics, and suitable framework-independent quote-queue behavior.

Existing browser authentication uses opaque cookies and CSRF tokens. Sessions live in process memory. The user selected a separate public Authentik client for mobile. Hosted acceptance of its access tokens is an external prerequisite and has not been verified.

## Screens and navigation

Use three bottom tabs: Portfolio, Watchlists, and Search. Instrument details and Settings are stack screens. Open Settings from an account button in the Portfolio header. Authentication sits outside the signed-in navigation group.

| Screen | V1 behavior |
| --- | --- |
| Sign in | Discover Authentik, launch browser sign-in with PKCE, verify Worthfolio API access, and handle cancellation, failure, and retry |
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
- Use `expo-web-browser` for direct Authentik browser login, `expo-crypto` for state/PKCE material, SecureStore for the mobile credential, AsyncStorage for non-sensitive preferences, and NetInfo plus React Native AppState for network/focus handling.
- Render the simple line chart using `react-native-svg` and React Native touch handling, with pure coordinate/nearest-point helpers.
- Keep TypeScript API contracts separate from display models. Validate essential response fields at the transport boundary and preserve unknown optional fields for forward compatibility.
- Configure the server through `EXPO_PUBLIC_API_URL`. Require HTTPS in distributable builds. Default app identifier: `com.worthfolio.mobile`; callback URI: `worthfolio://auth/callback`.

## API and refresh behavior

| Existing endpoint | Use |
| --- | --- |
| `GET /api/health` | Optional connectivity check; public, not proof of mobile token support |
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

## Mobile authentication with a public OIDC client

Decision updated 2026-09-17: the user created a separate public Authentik mobile client. This replaces the earlier proposed `/auth/mobile/*` backend handoff. Use only the hosted `https://worthfolio.pripyat.cloud` service; do not implement or deploy the sibling backend.

### Configuration

- Issuer: `https://auth.pripyat.cloud/application/o/worthfolio-mobile/`
- Discovery: issuer plus `.well-known/openid-configuration`.
- Public client ID: `9k33r6Ly7z3MYeKYP8JWqjAQKUbxWFoti107Q7Yx`.
- Authentik redirect URI: exactly `worthfolio://auth/callback`, using Strict matching.
- Authorization Code flow with S256 PKCE; scopes `openid profile email`. No client secret, implicit flow, password grant, or `offline_access` in the app.
- Optional public build overrides: `EXPO_PUBLIC_OIDC_ISSUER` and `EXPO_PUBLIC_OIDC_CLIENT_ID`. The configured API origin remains Worthfolio, not Authentik.

Live discovery was retrieved on 2026-09-17 and advertises the expected issuer, authorization code, S256, RS256, token and revocation endpoints. The user subsequently registered the native redirect, and a Pixel_10 emulator login completed a real public-client token exchange. Worthfolio initially denied the bearer-authenticated bootstrap request. After the hosted fix, fresh emulator login/bootstrap/logout pass; the user confirms matching account identity and passing backend read-only/isolation/expiry/revocation/web-login tests. The user subsequently confirmed physical-phone testing, closing M2. Broader feature/lifecycle and standalone release validation remain M3-M5 work.

### Client flow

1. Fetch discovery over HTTPS, validate its issuer exactly, require code/S256 support, and restrict authorization/token/revocation endpoints to the configured provider origin. Fail closed on unexpected metadata.
2. Generate fresh random state and a PKCE verifier/challenge. Open Authentik's authorization endpoint in the system browser with the public client ID and exact redirect URI.
3. The callback screen waits visibly while authentication finishes; it opens the protected portfolio only after session activation, routes failures to sign-in, and offers restart for cold/stale callbacks. Require the exact app callback, matching single state and single code, and no fragment. Handle cancellation and provider failure without exchanging a failed response. Abandon the flow if the app process dies.
4. Exchange the code directly at Authentik's token endpoint using a form-encoded public-client request with `grant_type=authorization_code`, `client_id`, `redirect_uri`, and `code_verifier`. Do not send a client secret or browser cookies. Ignore returned ID and refresh tokens; this client uses the access token for API authorization and does not derive identity from an unverified ID token.
5. Read Worthfolio's `/api/bootstrap` with `Authorization: Bearer <access_token>` and no cookies. Validate the response before activating the session. Explain 401/403 as API access denial after successful provider login; do not assume a Cloudflare response proves a specific backend implementation. Best-effort revoke an issued token if login cannot finish.
6. Persist only the access token, expiry, API origin, issuer, and client ID in SecureStore. Restore only a matching unexpired credential. Portfolio responses and user profiles remain in memory. Legacy backend-handoff credentials are discarded.
7. On expiry/401, clear account state and require sign-in again. V1 does not refresh access tokens. On logout, cancel pending work, erase the credential and account cache, then best-effort revoke the access token at Authentik with the public client ID. Local sign-out succeeds offline; the remote token may remain valid until expiry. Browser SSO stays signed in, so a later login may not prompt for a password.

The old `mobileAuth` health flag and `/auth/mobile/login`, `/auth/mobile/token`, and `/auth/mobile/logout` routes are not required by this design.

### Hosted API prerequisites and authorization

These requirements belong to the hosted backend. Bearer-authenticated bootstrap is verified on the emulator; read-only access, isolation, expiry/revocation, and existing web login are user-reported as tested. Preserve the requirements below and collect evidence for remaining acceptance cases:

- Accept access tokens issued for the public mobile client. Validate signature with the configured trusted issuer's keys, exact issuer, the appropriate audience/client binding, expiry, token purpose, and revocation. Never accept an ID token as an API access token or trust decoded claims without verification. An introspection design is also possible with server-side credentials; do not put those credentials in the app.
- Map the verified mobile identity to the existing portfolio owner. The mobile provider's issuer differs from the existing web provider. Preserve or explicitly map the verified subject identity; do not merge accounts by email or blindly assume both providers return the same subject.
- Restrict mobile tokens to GET/HEAD on `/api/bootstrap`, `/api/watchlists`, `/api/search`, and `/api/market`. Reject all writes and other protected routes. Keep existing browser cookie and CSRF behavior. Invalid bearer tokens must never fall back to cookies or an anonymous/default account.
- Enforce revocation and provider logout in the API. Local JWT signature checks alone do not observe token revocation immediately; use validated introspection or an explicit server revocation strategy and test it. Do not claim that provider revocation or backend restart invalidates a signed token without evidence.
- Confirm the expected account bootstrap, denial of other users' data, denial of writes, expiry, revocation, and web-login compatibility on the hosted service before declaring M2 complete.

## Build, rollout, and verification

Preserve the user's limited EAS cloud-build quota. Reuse the installed development client and Metro for JavaScript/TypeScript iteration, and compile Android locally when native changes require it. Start a cloud build only when the user explicitly requests that build. Milestone completion does not require consuming cloud quota. A locally built and appropriately signed standalone APK can satisfy the Android release gate.

Define an EAS `development` profile for the development client and a `preview` profile producing a standalone signed Android APK with its JavaScript bundled. The preview APK must launch without Metro. Supply the actual server URL, Expo project/account configuration, and signing credentials during setup; do not commit secrets.

Enable and validate hosted API access-token support before distributing the app. Keep web endpoints and browser behavior compatible. Backend deployment is outside this mobile task; the user or deployment owner must perform it. Removing the mobile client or redirect can stop new logins, but existing access tokens require expiry or an enforced revocation strategy.

Use backend HTTP tests for the auth boundary, Jest with the Expo preset and React Native Testing Library for mobile behavior, and real Android checks for browser redirects and native lifecycle/gestures. Use isolated backend databases and mocked providers for automated tests; never run test schedulers against live portfolio data.

Log sanitized endpoint/status/duration diagnostics only. V1 adds no external analytics or crash-reporting service. The detailed delivery gates are in [milestones.md](milestones.md).

## Reference documentation

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo browser authentication](https://docs.expo.dev/guides/authentication/)
- [Expo SVG support](https://docs.expo.dev/versions/latest/sdk/svg/)
- [TanStack Query with React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)
- [EAS internal distribution](https://docs.expo.dev/build/internal-distribution/)
