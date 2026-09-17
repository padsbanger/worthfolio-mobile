# Worthfolio Mobile milestones

Status: M1 complete and Android emulator validation passed. Paused at the M1 checkpoint; M2 backend work and the full M3-M5 acceptance gates remain pending.

Work through these milestones in order. Mark a checkbox complete only after its deliverable or check is demonstrated. Record validation evidence and unresolved issues with each completed milestone. [design.md](design.md) defines the agreed scope and behavior.

## M1: Native foundation

Deliverables:

- [x] Scaffold Expo, Expo Router, strict TypeScript, and npm with pinned compatible dependencies and a generated lockfile ready for version control.
- [x] Add thin routes, feature folders, shared dark-theme components, safe-area handling, and accessible controls.
- [x] Create Portfolio, Watchlists, Search, Instrument, Settings, and Sign-in screen shells using synthetic fixtures.
- [x] Add typed API transport/contracts, in-memory query setup, session boundary, and build-configured HTTPS server URL.
- [x] Define `typecheck`, `lint`, and Jest/Expo test scripts, plus EAS development and standalone preview profiles.
- [x] Document development setup and required Expo/build configuration without committing credentials.

Acceptance:

- [x] A clean `npm ci`, typecheck, lint, tests, and Expo Doctor succeed.
- [x] A development build opens on Android and all fixture-backed routes are reachable.
- [x] Missing/invalid server configuration yields an actionable startup state.
- [x] No mobile runtime source imports depend on the sibling repository.

Foundation evidence (2026-09-17):

- A clean `npm ci` succeeds; TypeScript and ESLint pass; all 13 tests in four suites pass, covering API validation, request scheduling, valuation, chart geometry/input immutability, portfolio rendering, and offline fixtures without network calls. Expo Doctor passes 21/21 checks; Metro/Hermes Android export succeeds.
- EAS project: `@padsbanger/worthfolio-mobile` (`88df6ef6-386b-44de-ab0e-a9bc68b80929`). Android development [build `1f198556-87c4-4179-9006-e44b1ad5b4a8`](https://expo.dev/accounts/padsbanger/projects/worthfolio-mobile/builds/1f198556-87c4-4179-9006-e44b1ad5b4a8) finished successfully. APK SHA-256: `93454b99a0dca457ba51c4cea626f518cc3fb1ffb46710ec278d17c5f6f8cb4d`.
- Installed `com.worthfolio.mobile` version `0.1.0` on the Pixel_10 emulator running Android 16. The development client loaded the final M1 JavaScript from Metro on port 8082. `scripts/android-smoke.py` passed Sign-in, Portfolio, Instrument, Watchlists, Search-to-Instrument, Account, back navigation, and sample-session exit. Local screenshots/UI trees are in ignored `artifacts/m1`.
- Native testing exposed unsupported Hermes `Array.toSorted`; chart sorting now uses a copied array and has a regression test. First-use Expo/Android keyboard tutorials were dismissed before the successful smoke run.
- This validates the development client and fixtures. The APK requires Metro; standalone release, physical-device checks, real account login, and iOS remain later gates. The actual server health endpoint responds with OIDC enabled and no mobile-auth capability yet. No backend files or running deployment were changed for M1.

## M2: End-to-end authentication

Depends on M1. Backend work occurs in the sibling Worthfolio repository.

Deliverables:

- [ ] Add the mobile login, one-time token exchange, logout, configured redirect allowlist, and health capability flag.
- [ ] Extend existing OIDC callback handling and in-memory sessions for separately tagged read-only mobile sessions.
- [ ] Enforce the read endpoint allowlist, subject ownership, credential-type separation, and existing backchannel revocation.
- [ ] Implement system-browser login, state verification, PKCE handoff exchange, SecureStore persistence, and expiry handling.
- [ ] Clear account data and cancel obsolete requests on logout, account change, and expired/revoked sessions.

Acceptance:

- [ ] A real Android device completes sign-in, reads the correct account's bootstrap, and signs out.
- [ ] Cancellation and provider failure allow a clean retry; unsupported backend capability is explained.
- [ ] Tests reject invalid state/verifier, expired/replayed codes, unregistered redirects, invalid bearer fallback, and cookie/token interchange.
- [ ] Mobile credentials cannot create/delete trades, mutate/select watchlists, save chart state, or access endpoints outside their allowlist.
- [ ] Cross-account tests prove no other user's portfolio is returned.
- [ ] Session expiry, backend restart, and provider backchannel logout require reauthentication; revoked handoffs cannot restore access.
- [ ] Existing browser login and CSRF regression tests pass.
- [ ] Backend rebuild/restart completes under its repository instructions and `/api/health` is verified without changing persisted volumes.

## M3: Portfolio and watchlists

Depends on M2.

Deliverables:

- [ ] Replace fixtures with bootstrap summaries and native holdings rows.
- [ ] Browse named watchlists with local-only selection and instrument navigation.
- [ ] Implement the shared quote queue, concurrency limit, deduplication, 90-second refresh, and pull-to-refresh.
- [ ] Reload bootstrap after holding-quote refresh rounds to obtain authoritative updated totals.
- [ ] Add coverage/freshness indicators and loading, empty, unavailable, retry, and offline states.
- [ ] Pause background/offline refresh and safely resume visible stale queries.

Acceptance:

- [ ] Header totals match backend responses for the same quote snapshot; portfolio value excludes account cash.
- [ ] Tests cover empty portfolios, multiple/deleted watchlists, signed shorts, GBX scaling, missing FX/prices, and partial coverage.
- [ ] Invalid, stale, failed, and synthetic demo responses preserve last-known real prices.
- [ ] Market concurrency never exceeds three and overlapping refresh triggers do not duplicate identical requests.
- [ ] Background/offline transitions stop polling; late responses cannot repopulate a cleared session.
- [ ] A fresh offline launch asks for reconnection, while a running app retains loaded data with clear stale/offline labels.
- [ ] Browsing leaves server watchlists, selected watchlist, ledger, and chart state unchanged.

## M4: Search and instrument chart

Depends on M3.

Deliverables:

- [ ] Add debounced search with cancellation, empty/error states, and result navigation.
- [ ] Show instrument price, daily change when available, and the current holding when present.
- [ ] Build the native SVG close-price chart and the agreed range selector, defaulting to `1M`.
- [ ] Add nearest-point touch inspection and accessible price/time text.
- [ ] Implement focused-instrument refresh using the backend cadence and shared market-request limit.

Acceptance:

- [ ] Rapid search/range changes cannot render superseded responses.
- [ ] Chart tests cover empty, single-point, flat, sparse, and real multi-point series.
- [ ] Demo data is never plotted as real history; absent real history has an unavailable state.
- [ ] Touch inspection identifies the expected observation; selected refresh stops on blur/background/offline.
- [ ] Android back navigation, safe areas, long instrument names, text scaling, and gesture interaction work on a real device.

## M5: Personal Android release

Depends on M1-M4. iOS validation remains follow-up work.

Deliverables:

- [ ] Complete automated checks and document exact commands/results.
- [ ] Validate the real HTTPS deployment, capability flag, callback URI, and account identity.
- [ ] Produce a signed standalone APK locally (or through EAS only when explicitly requested), with bundled JavaScript, and install it on a physical Android device.
- [ ] Document installation/update steps, session-expiry behavior, known limitations, and sanitized troubleshooting guidance.
- [ ] Record backend/mobile revisions and build identification for reproducible release validation.

Release gate:

- [ ] The APK launches and works without Metro or the development computer.
- [ ] Sign-in, app relaunch with a valid session, expiry, cancellation, and sign-out work.
- [ ] Portfolio, watchlists, search, and chart workflows pass against the intended account.
- [ ] Pull-to-refresh, provider failure, connection loss/recovery, and background/resume behave as designed.
- [ ] Native accessibility and navigation checks pass; no credentials or portfolio payloads appear in diagnostics.
- [ ] No editing endpoints are available to the mobile session and no portfolio responses are persisted on disk.
- [ ] All unresolved issues are documented; no failed required check is reported as passing.

## Deferred roadmap

After Android v1, plan iOS device validation and distribution. Editing, analytics, richer charts, push notifications, persistent offline access, longer-lived sessions, public distribution, and OTA updates require separate scope decisions rather than being implicit additions to these milestones.
