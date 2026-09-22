# Worthfolio Mobile inspection — 2026-09-22

The app has a coherent visual identity and a solid foundation for a personal portfolio companion. The next work should improve trust in the displayed data, watchlist write consistency, and everyday navigation before adding larger analytics features. This is an inspection and proposal, not implementation or milestone acceptance.

## Evidence and limits

- Reviewed the working tree at `35ecc72`, including the four pre-existing modified source/test files. Those files were left intact.
- TypeScript and ESLint pass. All **177 tests in 21 suites** pass.
- Inspected the installed Android development client on `emulator-5554`, at 1080×2424 and density 420. Live screens covered Portfolio, Watchlists, a held instrument, chart dragging, and the membership sheet. Sample mode covered Search, result navigation, Account, sheet dismissal, and return navigation.
- Checked sign-in and sample Portfolio at 130% font scale. Restored 1.0 and read it back after relaunch; resolution and density remained unchanged.
- Screenshots and UI dumps are local, ignored artifacts under `artifacts/inspection-2026-09-22/`. They include private account content and are not embedded in this report.
- During live inspection, a Back action returned to the launcher; reopening showed sign-in. Cause was not established. The equivalent membership-sheet Back action passed in sample mode. Do not treat this as either a confirmed navigation defect or a passing authenticated lifecycle check. Font-scale changes also recreated the development activity and reset the in-memory sample session.
- No authenticated writes, fresh provider login, physical-phone/iOS validation, TalkBack walkthrough, native widget lifecycle test, dependency compatibility audit, or release build was performed. The existing development binary was not independently matched to the exact source revision. The app was left at sign-in after layout testing.

## Priority findings

### 1. Fix misleading API errors — confirmed, small change

`src/api/client.ts:57` combines nullish coalescing and a conditional without grouping the fallback. A non-empty server error becomes the conditional's truthy test instead of the displayed message.

An isolated execution of the actual transpiled client with mocked fetch reproduced this: HTTP 500 with `{ error: "Provider temporarily unavailable" }` produced **“This action is not allowed for your mobile session.”** No network request or real token was used.

Group the fallback explicitly or extract a status-to-message function. Add behavioral coverage for 400/403/500 responses with and without an error body. The existing green suite does not catch this case.

### 2. Protect watchlist edits against stale membership — code-derived risk, high impact

`src/api/data.tsx:112` constructs and PUTs a complete symbols array from the supplied cached watchlist. `src/features/InstrumentScreen.tsx:35` takes that list from bootstrap, while the Watchlists screen can have a newer independent watchlists response.

Example: mobile holds `[A]`; web adds B; mobile adds C using its old list and sends `[A,C]`. If the backend applies replacement semantics without version checks, B is lost. Separately, an older in-flight bootstrap/watchlists response can overwrite the local success update; the mutation currently neither cancels those reads nor reconciles them afterwards.

Use one current membership source, refresh when opening the chooser, and coordinate outstanding reads with mutation completion. Add tests for response-order races. Full concurrent-edit protection requires an atomic membership operation or server version/precondition check; a preliminary refetch alone cannot guarantee it. Backend behavior was not verified through live writes.

TanStack documents invalidating related queries after successful mutations; apply that deliberately alongside the existing response-based cache updates. [Official mutation invalidation guidance](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations).

### 3. Revisit the exception states for portfolio totals — product decision with correctness implications

`src/features/PortfolioScreen.tsx:60` passes amounts to the overview but omits `pricedPositions`, `totalPositions`, and `asOf`. Partial valuations therefore receive the same headline presentation as complete valuations. An accepted initial snapshot with no priced holdings can display numeric zero rather than an unavailable total.

This is intentional in current tests (`src/__tests__/portfolio.test.tsx:20` and `:89`), so it should be reconsidered as a product decision, not described as an accidental regression. It also conflicts with the older design's coverage requirements. The widget already treats zero priced holdings as unavailable in `src/widget/bridge.ts`.

Keep the clean normal header. For exceptions, show a compact **Partial value · 8/10 holdings priced** notice and **Unavailable** when none can be valued. Put the summary's own observation time in a disclosure. Do not imply that separately refreshed row percentages and portfolio totals are one simultaneous snapshot.

### 4. Preserve the instrument quote when changing chart range — code-derived behavior

`src/features/InstrumentScreen.tsx:28` uses one range-keyed market response for both the quote header and history. Selecting an uncached range makes that response empty, so the already-known name/logo/price/daily change may disappear until history loads, or remain unavailable when only that range fails.

Keep the latest valid quote for the same symbol separately from the selected history. Let only the chart show loading or failure. Preserve currency/source/session boundaries and never label old candles as the newly selected range. Watchlists already separates quote data from weekly history and provides a useful pattern.

### 5. Make delayed data explain itself — observed and code-confirmed

Live Portfolio showed **Updates delayed** while retaining holdings, which is useful failure behavior. The notice does not identify affected quotes or expose the retained snapshot's age. `PortfolioRefresh` reduces all symbol failures to one shared error, so a screen can also inherit a warning originating elsewhere in the combined refresh round.

`src/features/WatchlistsScreen.tsx:35` displays only `stale` outside the details disclosure; provider delay and row update errors are normally hidden. Weekly-history failures can leave a percentage unavailable without a visible explanation while regular quotes still work.

Add a compact status beside the relevant price, plus a tappable explanation with affected symbols, observation time, and retry. Keep provider delay, failed refresh, and offline state distinct. Do not turn ordinary cached responses into alarming errors. Move Instrument's important delay/time indicator close to the price; it currently appears below the chart.

## Visual and interaction improvements

| Surface | Observation | Recommended change |
| --- | --- | --- |
| Portfolio | Strong balance hierarchy and aligned numbers; header, controls, and explanation occupy much of the first viewport. | Retain the hero card, tighten supporting spacing, and combine redundant period explanations. Keep touch targets generous. |
| Asset rows | Long names visibly truncate, including at 130% text. Names, subtitles, and extended quotes are forced to one line. | Allow two-line names and wrap financially important quantity/currency information when needed. Make the whole row, including P&L metadata, tappable. |
| Watchlists | Selector, sort/period controls, reset caption, count, and details action create a tall toolbar. | Integrate count into the selector area and streamline secondary controls. Preserve a clear active list and selected period. |
| Instrument | Chart scale and stable inspected-close area work well; position information follows quote metadata. | Put Your position before detailed provenance. Distinguish Latest close from an actively inspected historical close. Add an explicit return-to-latest action. |
| Trade markers | Buy/sell markers already exist. | Make a marker reveal trade date, side, execution price, and quantity when the contract supports it. Clearly distinguish execution price from the candle close used to position the marker. |
| Search | Clear input and readable results; the idle screen offers only instructions. | Show session-only recent instruments and a clear indication when a result is already held or watched. |
| Account/sign-in | Both still promise read-only mobile access despite implemented membership writes. | Describe the actual boundary: portfolio viewing plus watchlist membership editing. Correct the literal `browser?s` typo in the session disclosure. |

Keep scalable text enabled and solve clipping through layout. React Native documents the interaction between line limits, truncation, and font scaling in its [Text reference](https://reactnative.dev/docs/text).

The floating Tools gear and input-method toolbar in some captures belong to the development environment; they are not release-app design findings.

## Suggested features, in delivery order

Effort is relative: Small = focused client work; Medium = several client surfaces or contract validation; Large = backend/product work and broader verification.

| Feature | User benefit | Effort and dependency |
| --- | --- | --- |
| Hide balances | Open the app comfortably in public; mask totals, position values, and P&L together. | Small. Keep app masking separate from the widget's explicit visibility setting. |
| Portfolio value / Open P&L sorting and filters | Find largest holdings, biggest unrealized gains/losses, shorts, or unavailable valuations. | Small–Medium. Reuse existing position semantics; distinguish P&L from instrument price movement. |
| Recently viewed instruments | Reopen an instrument without repeating a search. | Small. Start in session memory; persistence needs an explicit preference/privacy decision. |
| Remember chart range and improve trade inspection | Make repeated instrument research faster and existing markers more useful. | Small–Medium. Keep preferences local and range return values based on real observations. |
| Quick membership action from Search | Add or remove an instrument without opening its detail screen. | Medium. Reuse the existing sheet after resolving membership consistency; verify the hosted authorization exception. |
| Read-only activity timeline | Understand the trades behind a position, with filters and links back to charts. | Medium. Bootstrap already includes trade annotations, but complete history, quantity, fees, currency, and pagination need contract validation. |
| Allocation and concentration view | See which holdings, currencies, or asset classes dominate exposure. | Medium–Large. Obtain authoritative backend aggregates and explicit long/short, missing-price, and FX semantics. |
| Portfolio performance and benchmark comparison | Understand portfolio change over time. | Large. Requires authoritative history and agreed cash-flow-adjusted return semantics. Instrument candles or current open P&L cannot substitute for portfolio performance. |
| Price alerts | Monitor chosen thresholds without opening the app. | Large. Requires a separate notification/background architecture; do not extend foreground polling to simulate reliable alerts. |

Watchlist creation/renaming is another reasonable extension after membership editing is reliable, but it adds new write permissions and should be scoped separately. Light/system theme can follow a real user preference; the current dark theme is already consistent. Additional chart indicators and decorative row sparklines would be lower priority than the features above.

## Code and delivery improvements

- Preserve the existing separation of thin routes, session lifecycle, transport/schema validation, quote queue, refresh coordination, and presentation. No broad rewrite is warranted from this review.
- Add targeted tests for the error-message reproduction, watchlist races, and quote preservation across chart-range failures. If the portfolio exception policy changes, update its intentional absence assertions rather than merely adding contradictory tests.
- Update `scripts/android-smoke.py`: it still expects an inline “On my radar” target and the removed “Your account” heading. Its assumptions no longer match the current picker/Account flow; it was not run as a passing end-to-end check.
- Reconcile `AGENTS.md`, `design.md`, `README.md`, `RELEASE.md`, and `milestones.md`: M20–M25 are documented complete while some entry points still say M20 must not start; follow-up acceptance notes lag committed watchlist/chart changes. Record current approved behavior and retain historical device-evidence limitations.
- Split dense JSX into readable sections during related feature work. Prioritize reviewability around mutation/error handling and financial labels rather than formatting the whole repository.

Recommended next package: **correct API errors, harden watchlist updates, agree on compact valuation exceptions, and preserve quotes across chart ranges**. Follow with toolbar/row refinements and the first three small features. Larger analytics and notifications should remain separately scoped proposals.
