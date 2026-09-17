# Worthfolio Mobile milestones

Status: M1-M4 complete. The user confirmed M4 completion after the physical-phone checklist and authorized M5. Phone and hosted backend-auth results remain user-reported. M5 release work is next.

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

Depends on M1. Use only `https://worthfolio.pripyat.cloud`; do not implement or deploy the sibling backend. On 2026-09-17 the user created a separate public Authentik mobile client. Direct Authorization Code + S256 PKCE replaces the earlier backend handoff proposal. Cloudflare blocked previous automated Worthfolio probes (403 / Error 1010). The user-supplied health response confirms OIDC only; it does not establish bearer-token support.

Deliverables:

- [x] Configure the public mobile issuer/client ID; retrieve and validate provider discovery.
- [x] Implement system-browser login, state/callback checks, S256 PKCE, public-client token exchange, and authenticated bootstrap verification before saving a session (mocked tests and live emulator login/bootstrap pass).
- [x] Bind SecureStore credentials to API origin/issuer/client, enforce expiry, and perform best-effort provider token revocation on logout.
- [x] Confirm the native redirect and requested scopes through a real login (user registered the exact URI; public-client exchange and hosted bootstrap succeed on the emulator).
- [x] Hosted backend: accept mobile access tokens and preserve the existing account identity (live emulator bootstrap succeeds; user confirms the account matches the web app).
- [x] Hosted backend: enforce read-only access, account isolation, expiry/revocation, and existing web-login compatibility (user reports all these backend tests passed; no backend tests were run locally by the mobile agent).
- [x] Validate account cache clearing and cancellation across sessions: live emulator logout removes authenticated navigation; DataProvider tests verify cleared caches, aborted requests, and isolation from late data/401 responses. The user subsequently confirmed the requested physical-phone testing.

Acceptance:

- [x] A physical Android phone completes the requested authentication checks, per user confirmation after the phone-test checklist; matching web/mobile account data was previously confirmed.
- [x] Cancellation/provider-failure recovery is covered by client tests and the user-confirmed phone-test checklist; API rejection after provider login was observed on the emulator and is explained visibly.
- [x] Authentication boundaries are covered by local PKCE/state/callback/token-response tests and the user-confirmed hosted auth suite. Code/verifier validation and code replay protection belong to Authentik in the public-client design; no backend mobile-handoff code exists. Individual provider negative-case traces were not collected by the mobile agent.
- [x] Mobile read-only authorization tests pass, per the user's hosted-backend test confirmation (not independently probed with production writes).
- [x] Account-isolation tests pass and the web/mobile account matches, per user confirmation; client cache isolation is covered locally.
- [x] Client expiry/401 handling and provider revocation requests pass local tests; hosted expiry/revocation tests passed per user confirmation. Signed access tokens are not assumed to be invalidated by a backend restart; enforcement remains the hosted validator's responsibility.
- [x] Existing web-login tests pass, per user confirmation. Retain backend evidence for the exact CSRF/credential-misuse cases; the mobile agent did not run the hosted backend suite.
- [x] The user confirms the hosted mobile-auth fix; fresh emulator login and authenticated bootstrap verify service availability. The mobile agent made no backend deployment or portfolio writes.

Client evidence (2026-09-17): live mobile discovery was retrieved successfully and advertises the expected issuer, authorization code, S256, and token/revocation endpoints. TypeScript, ESLint, and the Metro/Hermes Android export pass. The local client suite passes 51 tests across seven suites, including PKCE/state binding, exact callbacks, safe discovery, token response validation, bootstrap rejection, saved credential binding, offline logout, revocation, and cancellation while browser/API work is pending. A subsequent Pixel_10 emulator retry completed the real public-client exchange but Worthfolio denied the authenticated bootstrap request (401/403 error path). Hosted API acceptance and account identity were unverified at that stage; the later successful hosted follow-up is recorded below.

Callback fix (2026-09-17): the user registered `worthfolio://auth/callback` and reported a blank screen after login. The callback had unconditionally redirected into the protected portfolio before session completion. It now displays progress, enters the portfolio only with an active session, returns API/provider errors to sign-in, and offers recovery for stale/cold callbacks. Three Expo Router integration tests cover these paths with the actual root layout. After reloading the installed development client, an emulator sign-in displayed progress and then the explicit Worthfolio API denial. No APK/cloud build was used.

Hosted authentication follow-up (2026-09-17): after the user deployed the mobile-auth fix, the emulator displayed real holdings. A fresh sign-out/sign-in cycle passed: account settings contained no fixture banner, sign-out returned to sign-in, Android back did not restore account screens, and fresh Authentik login loaded live bootstrap/holdings. The user confirmed matching web/mobile account data and passing hosted read-only, account-isolation, expiry/revocation, and web-login tests. These backend results are user-reported, not locally executed. Three added DataProvider integration tests verify cache clearing, new-account separation, request cancellation, and rejection of late old-account data/401 responses.

M2 completion (2026-09-17): after being given the remaining physical-phone checklist (sign-in, matching account, sign-out, cancellation/retry, and saved-session restart), the user confirmed testing on a physical phone. Accept this as user-reported device validation together with their earlier backend-test confirmation; do not describe it as an agent-operated phone run. Device model, raw backend test output, and individual provider negative-case traces were not supplied. The earlier automated emulator restart assertion remained inconclusive and is not reported as a passing agent check. Local TypeScript, lint, and all 51 tests pass; the Android Metro/Hermes export also passed during M2. No local backend implementation/deployment, portfolio writes, or new cloud build was performed. No `/auth/mobile/*` routes or `mobileAuth` flag are required.

Checkpoint: commit M2 and pause. Do not begin M3 until the user resumes work. Standalone APK, broader feature/lifecycle validation, and iOS remain later milestones.

## M3: Portfolio and watchlists

Depends on M2.

Deliverables:

- [x] Replace fixtures with bootstrap summaries and native holdings rows.
- [x] Browse named watchlists with local-only selection and instrument navigation.
- [x] Implement the shared quote queue, concurrency limit, deduplication, 90-second refresh, and pull-to-refresh.
- [x] Reload bootstrap after holding-quote refresh rounds to obtain authoritative updated totals.
- [x] Add coverage/freshness indicators and loading, empty, unavailable, retry, and offline states.
- [x] Pause background/offline refresh and safely resume visible stale queries.

Acceptance:

- [x] Header totals match backend responses for the same quote snapshot; portfolio value excludes account cash.
- [x] Tests cover empty portfolios, multiple/deleted watchlists, signed shorts, GBX scaling, missing FX/prices, and partial coverage.
- [x] Invalid, stale, failed, and synthetic demo responses preserve last-known real prices.
- [x] Market concurrency never exceeds three and overlapping refresh triggers do not duplicate identical requests.
- [x] Background/offline transitions stop polling; late responses cannot repopulate a cleared session.
- [x] A fresh offline launch asks for reconnection, while a running app retains loaded data with clear stale/offline labels.
- [x] Browsing leaves server watchlists, selected watchlist, ledger, and chart state unchanged.

M3 evidence (2026-09-17):

- TypeScript, ESLint, Jest, and Metro/Hermes Android export pass. The suite contains 91 tests across 11 suites. Added cases cover 90-second cadence, shared manual/scheduled rounds, three-request concurrency across ranges, independent subscriber cancellation, retained slots for abort-ignoring transports, and watchlist-row unmount during a holdings refresh.
- Lifecycle integration tests exercise real DataProvider/QueryClient wiring with mocked network/AppState: a fresh offline launch sends no requests; offline/background transitions cancel work and polling; stale foreground/reconnect resumes refresh; late responses cannot repopulate a previous session.
- Quote/portfolio tests retain complete last-known snapshots after invalid, stale, synthetic, regressed-timestamp, network, and provider failures. Partial initial portfolios remain valid. Header tests use intentionally different server totals and cash to prove the app does not recompute or add cash. Domain tests cover short positions, GBX, non-USD base currencies, unavailable FX/prices, and partial coverage.
- Watchlist tests cover local selection, empty/deleted lists, account-scoped preferences, delayed preference reads, quote provenance, pull-to-refresh of both list metadata and quotes, and navigation to instruments. Read-only transport tests use GET requests; no server selection/trade/chart-setting writes were added.
- On the installed Pixel_10 development client, fresh hosted sign-in loaded real holdings. Portfolio and Watchlists pull-to-refresh remained usable, live named lists loaded, and background/resume retained the watchlist before returning to Portfolio. A further native check switched the locally selected list, restored the original selection, and opened an instrument from the list. Deletion/failure cases use controlled fixtures in tests, not changes to the user's live lists. No new APK, dependency, cloud build, or backend change was needed.

Checkpoint: commit M3 and pause. Selected-instrument polling, remaining search/chart behavior, and physical-device feature/release checks remain in M4-M5.

## M4: Search and instrument chart

Depends on M3.

Deliverables:

- [x] Add debounced search with cancellation, empty/error states, and result navigation.
- [x] Show instrument price, daily change when available, and the current holding when present.
- [x] Build the native SVG close-price chart and the agreed range selector, defaulting to `1M`.
- [x] Add nearest-point touch inspection and accessible price/time text.
- [x] Implement focused-instrument refresh using the backend cadence and shared market-request limit.

Acceptance:

- [x] Rapid search/range changes cannot render superseded responses.
- [x] Chart tests cover empty, single-point, flat, sparse, and real multi-point series.
- [x] Demo data is never plotted as real history; absent real history has an unavailable state.
- [x] Touch inspection identifies the expected observation; selected refresh stops on blur/background/offline.
- [x] Android back navigation, safe areas, long instrument names, text scaling, and gesture interaction work on a real device (user-confirmed after the M4 checklist).

M4 evidence (2026-09-17):

- TypeScript, ESLint, all 100 tests across 13 suites, and the Metro/Hermes Android export pass. Search integration tests cover the 300 ms/two-character threshold, immediate cancellation while replacement input is debouncing, late responses, offline/empty/error states, retry recovery, and navigation. Instrument tests cover backend cadence, non-overlapping slow requests, range cancellation, default/reset to `1M`, daily change/holding presentation, and rejection of synthetic history.
- Selected charts use the existing query cache and three-request market queue. Blur removes the screen's subscription without cancelling another owner of the same query; background/offline also cancel network work. Backend cadence defaults to five seconds when absent/invalid, with a one-second minimum. No polling runs in the explicitly labeled development sample session.
- Chart tests cover empty, single, flat, sparse/multi-point series, touch and accessibility actions, and retaining an inspected observation through live updates. Sparse dates retain temporal spacing. Inspection includes the year; `ALL` explains that provider history may be bounded. Missing/synthetic history is not replaced with generated data in real sessions.
- The installed Pixel_10 development client completed hosted sign-in and live search-to-instrument navigation. A real provider chart loaded; `ALL` showed the bounded-history explanation, touch/drag changed the inspected observation, vertical scrolling starting over the chart worked, and Android Back returned to search. A further emulator check at 150% system text displayed a 56-character instrument name, range controls, chart labels, and safe-area spacing without clipping; the original font scale was restored. Native captures are in ignored `artifacts/m4`. No new APK, cloud build, dependency, backend change, or server-setting write was needed.
- The user confirmed milestone completion after the physical-phone checklist covering search, chart gestures/ranges, Android Back, long names, and enlarged text. Accept this as user-reported M4 device validation, distinct from the agent-operated emulator checks; no phone model or raw traces were supplied.

Checkpoint: commit M4. The user explicitly requested the next milestone, authorizing M5 in the same turn.

## M5: Personal Android release

Depends on M1-M4. iOS validation remains follow-up work.

Deliverables:

- [ ] Complete automated checks and document exact commands/results.
- [ ] Validate the real HTTPS deployment, mobile issuer/client configuration, callback URI, and account identity.
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
