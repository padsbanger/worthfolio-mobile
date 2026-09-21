# Worthfolio Mobile design

Status: agreed v1 design; M1 foundation, M2 authentication, and M3 portfolio/watchlists are complete. Hosted login/bootstrap/logout were verified on the emulator; the user confirmed physical-phone testing and hosted authorization tests. M4 search/chart checks pass, including user-confirmed physical-phone acceptance. M5 is complete: the locally built standalone APK uses the existing EAS signing key and the user confirmed release acceptance after the phone checklist. The exact hosted backend revision remains unverified. See `milestones.md` for evidence and remaining work.

## Goal and scope

Create a native, personal, read-only companion for an existing Worthfolio HTTPS deployment protected by OpenID Connect. Deliver an Android APK using local builds by default; Expo Application Services (EAS) is an optional cloud build service. Keep code compatible with iOS, but defer iOS device validation and release until after Android v1.

V1 supports portfolio summaries and open holdings, existing watchlists, market search, instrument details with simple line charts, and account settings. It excludes editing, transaction-history screens, advanced analytics, chart indicators/overlays, notifications, persistent offline portfolio storage, app-store publication, and OTA updates.

Success means the same account sees matching backend portfolio totals for the same quote snapshot, can browse instruments comfortably on a phone, and cannot change portfolio or watchlist settings through its mobile credential.

## Existing system and reuse

The sibling `../worthfolio` repository contains a Flask backend, SQLite persistence, market-provider integrations, and a React web application. The Python package is `../worthfolio/worthfolio`. Account data is scoped by verified OIDC subject; public market caches are shared.

The web UI contains a substantial browser-specific controller and canvas chart. Rebuild the presentation natively. Reuse existing HTTP APIs, backend calculations, response semantics, and suitable framework-independent quote-queue behavior.

Existing browser authentication uses opaque cookies and CSRF tokens. Sessions live in process memory. The user selected a separate public Authentik client for mobile. Hosted acceptance of its access tokens was verified during M2; backend authorization tests and physical-phone authentication were confirmed by the user.

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

## Delta-inspired Android redesign

Direction requested 2026-09-18: evolve the visual presentation toward Delta Investment Tracker while retaining Worthfolio identity and exactly three bottom tabs: **Portfolio, Watchlists, Search**. Instrument details and account settings remain stack screens. M6 density work is the baseline; M7-M12 sequence the redesign and release validation in `milestones.md`.

Reference: Delta's [Portfolio 3.0 discussion](https://delta.app/academy/post/your-portfolio-your-way) emphasizes consistent layouts, at-a-glance information, and polished scrolling; its [feature overview](https://delta.app/en/features) provides portfolio and asset-detail references. Reviewed 2026-09-18. These are design references, not a specification to reproduce Delta's entire feature set. The following choices are Worthfolio's proposed interpretation.

- **Visual system:** near-black canvas, restrained elevated surfaces, subtle separators, strong numeric hierarchy, aligned/tabular numbers, and a consistent company-logo treatment. Use color for selection and signed gains/losses; keep secondary text readable. Preserve Worthfolio branding.
- **Portfolio:** compact account header, prominent holdings value, clearly labeled open P&L and invested amount, then holdings without a large decorative card consuming the first screen. Keep coverage and stale-data exceptions visible. Group supporting metadata instead of repeating long explanatory paragraphs.
- **Asset rows:** stable logo/name/symbol alignment on the left and right-aligned value or price with a clearly labeled change metric. Use compact secondary information and predictable row spacing. Long names and larger text can wrap; values must not overlap or silently disappear.
- **Watchlists:** a compact named-list selector with the active list always identifiable, followed by the shared asset-row treatment. Preserve local list selection. Keep daily percentage changes distinct from portfolio open P&L.
- **Search:** prominent search input and compact logo-led results with company name, ticker, and exchange/type. Preserve debouncing, cancellation, and explicit initial loading/empty/error states.
- **Instrument details:** logo/name header, strong price and daily-change hierarchy, a larger usable chart area with understated framing, compact range selection, and grouped position statistics. Preserve existing ranges, actual history bounds, and touch inspection.
- **Refresh and metadata:** background refresh remains quiet, failures preserve loaded content, and pull progress appears only after a gesture. Compact freshness indicators can open accessible in-screen details for source, exact timestamp, and cache/delay state; do not remove provenance or hide partial-valuation warnings.
- **Accessibility and motion:** at least 48 logical-pixel interactive targets, scalable text, safe areas, visible selected states, and signed values in addition to color. Avoid layout shifts during refresh; any transition respects reduced-motion settings.

Data limits: no fabricated portfolio performance chart, daily portfolio return, allocation analysis, or sparkline. Existing market candles support instrument charts only; holdings total and open P&L remain backend-authoritative. No extra quote polling solely for decorative row charts. Missing new metadata must degrade gracefully. Backend features, write actions, alerts, broker connections, additional tabs, and public distribution are outside this visual redesign.

Delivery: establish a reference screen and reusable components first, then redesign one surface per milestone. Compare emulator captures at the same viewport, text scale, scroll position, and data state; use clearly labeled fixtures for reproducible comparisons. Keep loaded, empty, partial, offline, and failed-refresh states in review. Reuse Metro for UI changes; produce an updated locally signed APK at the final release checkpoint. Commit only completed milestones and pause between them.

## M19 Android widget design

The widget is a native RemoteViews portfolio summary, generated by a checked-in Expo config plugin. It receives only formatted authoritative total/Open P&L, coverage text, observation time and session expiry after a validated bootstrap. No credentials, positions, profile or independent valuations enter the widget. Demo sessions never publish widget data.

This user-requested feature is a narrow exception to the in-memory portfolio boundary: a minimal snapshot is encrypted with an Android Keystore AES-GCM key in the app's no-backup directory. It is never stored in AsyncStorage or used to restore app queries. A random session lease gates writes; logout/expiry invalidates the lease and deletes the snapshot. New sessions reset visibility to masked. Account provides an explicit show-balances switch and launcher pin action. Launcher-rendered values are visible outside the app when enabled.

Successful existing app refreshes push updates; no new market polling or background network/token refresh is added. The widget always labels data as a snapshot with its date/time and tells users to open the app to refresh. Android periodic rendering and an inexact expiry alarm clear expired snapshots while the app is closed; reboot clears the widget rather than restoring monetary data. Android can delay alarms or freeze a force-stopped app, so immediate expiry removal from the launcher cannot be guaranteed. Masking is the default, and this limitation is disclosed before enabling balances. Remote provider revocation is detected on the next normal authenticated app request, preserving the existing auth contract.

Native rendering follows Worthfolio's dark PortfolioOverview design on both light and dark launchers: shared surface/text/accent/gain/loss colors, a subtle lavender gradient and rings, uppercase value label, tabular balance and signed P&L badge. Text scales and the layout is resizable. This supersedes the initial system-light widget at the user's request. Tapping opens the protected Portfolio route through existing authentication. Old development binaries gracefully report that a native rebuild is required. Native Kotlin and resources live under plugins/widget and are copied by prebuild, so ignored android output is never the sole source of implementation. Restoring a credential on a cold app start creates a new widget lease and resets visibility to masked; visibility does not carry over between account sessions.

Platform references: Android documents the [30-minute minimum periodic widget update](https://developer.android.com/develop/ui/views/appwidgets/advanced), [inexact alarm delays](https://developer.android.com/develop/background-work/services/alarms), and [no-backup directory exclusion](https://developer.android.com/identity/data/autobackup). Periodic widget rendering performs no network access and does not claim to refresh prices.

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

Refresh held symbols and the locally displayed watchlist every 90 seconds while the app is active and online. A session-owned coordinator merges manual and scheduled work; screen changes and resume reuse fresh cached quotes, while explicit and scheduled refreshes request updated quotes. Independent queue subscribers cancel separately, and an active holdings refresh retains its query subscription if a watchlist row unmounts. Use `1D` market requests for daily quote information. Deduplicate identical requests across manual, scheduled, and selected-instrument work; cap all market requests at three in flight. A focused chart uses its requested range and the backend's `selectedRefreshSeconds`, defaulting to five seconds if omitted or non-positive, with a one-second minimum to prevent a busy timer. Selected-instrument work stops on screen blur by unsubscribing that screen; shared requests needed by another owner continue. No interval may launch overlapping work for the same query. Search unsubscribes immediately when input changes, even during the replacement query's debounce.

Load bootstrap first so cached valuations appear immediately. After each holding-quote refresh round, reload bootstrap to obtain updated authoritative totals. Reload watchlists on Watchlists focus and pull-to-refresh. Keep the locally selected watchlist if it still exists; otherwise use the server's active list, then the first available list, then an empty state. Never call server selection/chart-state write endpoints.

Preserve quote source, timestamps, and cached/delayed/stale/unavailable distinctions. Retain last-known real values when a response is stale, invalid, synthetic, or failed. Do not plot a synthetic fallback as real history; show an unavailable state when no real series exists. Do not request corporate events or extended-hours data in v1.

Bootstrap remains authoritative for aggregate valuation. Reject synthetic/invalid/regressed holding quotes as a complete snapshot so new totals are never mixed with old position prices; show a refresh warning while retaining the prior snapshot. A first partial snapshot with genuinely unavailable prices remains valid. If bootstrap regresses temporarily, known holdings can still refresh their quotes and recover a valid server snapshot; authentication failures stop that recovery immediately. Display-only position calculations follow the backend's quantity, average price, `baseRate`, and GBX scaling rules. Missing conversion rates produce unavailable/partial values, not invented conversions. Only use an implicit rate of one when the normalized quote currency equals the account base currency; apply GBX scaling separately. A summary refresh may briefly lag independently refreshed quote labels; retain its own timestamp and do not imply one simultaneous quote snapshot.

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


### M7 reference implementation

The shared theme uses near-black `#0C0E12`, surface `#15181E`, elevated `#20252D`, muted text `#A5ADBA`, and lavender selection `#9AAEFF`. Financial figures use tabular numerals; signed gains/losses retain explicit metric labels. Shared `PortfolioOverview`, `Metric`, and `AssetRow` components provide the reference layout without changing the data contract.

In a development build, open Portfolio > Account > Design preview to review fixed sample holdings at normal and larger text sizes. It has an explicit sample banner, no market queries, and no live account values. The screen is protected by a development-only route guard; it does not add a tab or appear in release navigation. M7 establishes the shell and components; M8-M11 apply the complete layout changes to live screens in sequence.

## M13 list controls

Use a compact local sorting dropdown beside horizontally scrollable period chips, inspired by Delta's [percentage-based gainers/losers](https://support.delta.app/en/articles/4682412-intro-to-the-markets-screen) and [view customization](https://support.delta.app/en/articles/1455275-how-can-i-personalize-delta) (reviewed 2026-09-18). The exact controls are Worthfolio's implementation, not a claim that Delta has identical sorting semantics.

Periods affect instrument price-change percentages on both lists. Portfolio retains authoritative balance/open P&L and row position P&L; a short position's investment gain is distinct from an instrument's price move. 1D uses previous close. 1H compares actual close observations one hour apart within the same trading session, with at most 15 minutes of boundary tolerance. 1W compares actual close observations seven calendar days apart, with at most three days of boundary tolerance for market closures. Both historical periods end at the most recent returned close (not the fetch time); insufficient coverage stays unavailable, never substitutes a different period or a synthetic quote. Details disclose observation bounds.

Price sorting compares unit prices in account base currency using backend-supplied holding FX for known currencies; GBX is converted to GBP first, matching existing valuation rules. Missing FX/prices and missing period changes sort last in either direction. Ties use company name then full symbol; Default order preserves server order. Store only sort/period preferences scoped by server/account and screen. No position or quote data is persisted. Historical requests use the existing queue and cache, pause when unfocused/offline/backgrounded, and never poll faster than the 90-second list cadence.

Portfolio and Watchlists keep routine per-instrument delay/cache notices inside expanded Quote details. Collapsed rows retain unavailable values and explicit stale warnings, without reserving a status line for delayed quotes. Screen-level refresh feedback remains compact.

M13 follow-up: Portfolio and Watchlists hide repeated per-row period captions while retaining the metric in screen-reader hints and the selected timeframe chips. A single compact extended-session line displays the active pre-market/after-hours quote, or the most recent available session outside those periods, with its native-currency unit price, provider percentage and dated observation time. It is hidden while the instrument is in its regular `open` trading session, so historical extended-hours values never compete with its live price. No quote means no placeholder or reserved space. Regular prices, candle-based sorting and authoritative portfolio valuation are unchanged. Daily market requests use the existing `events=1` option to receive `session.preMarket` / `session.postMarket`; weekly views retain daily observations for session quotes. Optional malformed session metadata cannot invalidate a regular quote. This follows the separate extended-hours presentation described in [Delta's Home guide](https://support.delta.app/en/articles/9233147-my-delta-home); it does not reproduce Delta's layout exactly. Hosted support is inferred from the existing backend source contract, not yet verified with a signed-in mobile response.

Extended-session presentation refinement: place the compact `Pre` / `After` price and signed percent directly beneath the change in the right-hand amount column. Color the whole label green/red by the extended-session move; unknown/zero moves remain neutral. Put the dated quote time in expanded Quote details and its accessibility label, removing the full-width session metadata line.

### M14 row layout

`AssetRow` is the shared layout for Portfolio and Watchlists. It uses a 32-point logo, a flexible left identity column and a content-sized, right-aligned amount column with a 104-point readable minimum. Company names use all remaining row width before truncating; symbols and supporting text visually use one line with an ellipsis, while the instrument action retains the complete name and supporting text for assistive technology. At narrow effective widths or for unusually long financial figures, the amount column moves below the identity but remains right-aligned and fully visible. Rows use 10-point vertical padding and retain a 48-point touch target. This keeps regular value, period change and the `Pre`/`After` quote aligned without altering valuation or quote selection.

### M15 list-control feedback

The shared list controls name their state directly: `Sort: <current sort>` and selected period chips. A concise line states the selected period's calculation basis (or the account currency for a price sort). After a user changes either setting, a 48-point `Reset` action returns only that screen's local preference to Default order and 1D; its owner/server/screen-scoped preference is saved through the existing queued write. The Reset action is absent for the default view. The sorting modal retains its existing selection, outside-tap close and Android Back close behavior without changing the selected view or watchlist membership.

### M16 loading and refresh

Portfolio and Watchlists use static, non-financial placeholders only during a genuinely empty first load. The placeholder has the same logo, identity, amount and supporting-line structure as an asset row, so real content arrives without a structural jump. A Watchlists row uses that placeholder only while its first daily quote is fetching; a completed missing or failed quote remains an explicit unavailable row. Existing rows, cached values and background refresh behavior stay visible and quiet. Both FlatLists use stable keys and `maintainVisibleContentPosition` for ordinary data updates; deliberate sort, period or watchlist changes retain their existing remount behavior and can reset list position intentionally. Manual pull-to-refresh remains the only trigger for the native spinner.

### M17 accessibility

The existing semantic controls remain the navigation order: named tabs, instrument actions, selected timeframe/sort choices, modal headings, selected watchlists, and expanded Quote details states. Financial color is supplemented by signed values and explicit metric names. Each asset action includes the visually hidden period metric; when present, it also includes a full pre-market or after-hours sentence with price, explicit Up/Down/Unchanged wording, and quote time. Company-logo imagery stays hidden from assistive technology because the parent action provides the instrument name. Shared financial/action colors meet a 4.5:1 contrast ratio against the app background. Shared controls retain 48-point touch targets and never disable font scaling; the row layout moves large values rather than truncating them, while truncated company/supporting text remains present in the action description.

Portfolio intentionally omits the account-name, holdings-value, holdings-coverage and timestamp labels, along with its Quote details disclosure. The header presents the balance, Open P&L, Invested value, filters and compact refresh feedback. The compact list retains only user-actionable unavailable or stale valuation warnings; full quote provenance remains on the instrument screen. Watchlists and Instrument retain their own Quote details disclosures where their data is the primary subject of the screen.

### M18 Portfolio summary animation

PortfolioOverview receives authoritative numeric summary values and formats the currently displayed value in the account currency. Its balance, Open P&L and Invested figures transition linearly over 360 ms when a later valid server summary differs. Initial values render directly so the screen never appears to count from zero; unavailable/non-finite values also render directly. The transition uses React Native's installed animation runtime, respects the system Reduce Motion setting, and stores no portfolio data or animation state outside the mounted view. Tabular typography prevents digit-width jitter. It does not alter refresh cadence, server totals, valuation, or row-level quotes.
