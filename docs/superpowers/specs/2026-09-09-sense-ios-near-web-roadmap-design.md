# Sense iOS — Near-Web Roadmap

**Date:** 2026-09-09
**Status:** Approved design (program roadmap), pending per-slice specs
**App:** `apps/ios` (new — SwiftUI)

## Context

Sense is a large web product: catalogue lobbies (`/home` Movies · TV · Community),
search, movie/TV detail, Quick Log and the diary, lists and watchlist, reviews,
profiles, notifications, settings, onboarding, billing, achievements, quotes, and
year-in-review. The API is Elysia (`apps/server`), the web app is Next.js
(`apps/web`), and auth is Better Auth (`packages/auth`).

A React Native attempt exists at `apps/native` (Expo). Its Phase 1 shipped a
five-tab shell and an Activity feed (`docs/superpowers/specs/2026-06-04-mobile-foundation-activity-feed-design.md`);
the other four tabs are still "coming soon" stubs and cards do not navigate.

The decision now is to build a **true native iOS app in SwiftUI** instead of
continuing Expo, targeting **near-web** feature coverage over a series of slices.
This document is the program roadmap: what the app is, what order it is built in,
and what is out of scope. It does **not** spec any screen. Each slice gets its own
spec → plan → build cycle.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Stack | True native SwiftUI, talking to the existing Elysia `/api` | Store-quality feel; no RN bridge; the API is already the product boundary. |
| Platform order | iOS first; Android (Jetpack Compose) only after an iOS v1 is usable | Two native UIs cannot be built at once; ship one well. |
| Target coverage | Near-web — every patron surface is on this roadmap | The app should be a real Sense client, not a companion. |
| Visual language | Hybrid — system `TabView` / `NavigationStack` / sheets, with Sense content and tokens | Feels at home on iOS while still reading as Sense (posters, heroes, 0–10 scores). |
| Auth | Email/password + Sign in with Apple + Discord | Matches the website, plus Apple (required once a third-party login is offered). |
| Expo app | Deleted (in slice 1) | One mobile track; `apps/native` would otherwise rot as a second, half-built client. |
| Backend | Existing Elysia `/api`; no rewrite, no native BFF | Web and iOS share one contract; slices add endpoints only when a screen genuinely needs one. |
| Delivery order | Home-first | Same front door as the website; the catalogue is the surface patrons open the app for. |

## Scope

**In scope (across the whole program)**

Every patron-facing surface, delivered slice by slice: auth and app shell, Home
(Movies · TV · Community), search, movie/TV detail, Quick Log, diary, watchlist,
lists, profiles, reviews, notifications, settings (including Data), onboarding,
billing, achievements, quotes, and year-in-review / month recap.

**Out of scope (whole program)**

- **Staff panel** — stays web-only, permanently.
- **Android** — a separate program after an iOS v1 is usable.
- **The Expo app** — removed, not maintained in parallel.
- **Pixel parity with the web** — the iOS app reinterprets Sense in system chrome;
  it does not reproduce web layouts (radial toolkits, hover states, WebGL auras).
- **Rewriting the Elysia API** or introducing a mobile-only backend.
- **iPad-specific layouts, push notifications, widgets, App Clips** — none are on
  this roadmap; if wanted they become their own specs later.

## Visual language

Hybrid. The chrome is Apple's, the content is Sense's.

- **System:** `TabView`, `NavigationStack`, navigation titles, `.sheet` /
  `.presentationDetents`, SF Symbols, system materials, swipe-back, Dynamic Type,
  pull-to-refresh, context menus (the native answer to the web radial toolkit).
- **Sense:** background / card / accent tokens, poster grids and poster tiles,
  detail heroes with backdrops and stills, the 0–10 patron score scale, plan-tier
  portrait treatment, and Sense copy conventions (Theaters vs At home, patron,
  Community score).
- One theme with light and dark. The web palette picker (Calm / Lucid / Pensive /
  Cozy / Dreamy) is not ported in early slices; if it ships it gets its own spec.

## Slice order

Each slice is a separate spec → plan → build cycle. Later slices may be reordered
as the product learns, but the first five are settled.

| # | Slice | Delivers | Notes |
|---|---|---|---|
| 1 | **Foundation** | `apps/ios` project, auth (email + Apple + Discord), five-tab shell, tokens, API client; Expo deleted | Specced in `2026-09-09-sense-ios-foundation-design.md`. Tabs other than You are stubs. |
| 2a | **Home: Movies + TV** | Catalogue lobby, sort/venue/run filters, poster grid, paging | Poster taps are inert until slice 4. |
| 2b | **Home: Community** | Lists · Reviews · Activity · Ranks with period filtering | Split from 2a so the catalogue can ship without the whole Community product. |
| 3 | **Search** | Films, TV, people, lists | The native counterpart of the ⌘K dialog, not a port of it. |
| 4 | **Title detail** | Movie/TV About: hero, synopsis, Community score, cast & crew | Quotes and Streaming tabs land here or in a follow-up spec. |
| 5 | **Quick Log** | Center tab and log-from-poster / log-from-detail; rating, venue, date, visibility | Unlocks the daily habit; first write path in the app. |
| 6 | **Library** | Diary, watchlist, lists lobby, list detail | Depends on logging existing. |
| 7 | **You / profile** | Own profile and other patrons' profiles | Hero, filmography, showcase, follows. |
| 8 | **Reviews** | Compose and read | Includes spoiler guard and mention rendering. |
| 9 | **Inbox** | In-app notification inbox (not push) | Deep links into title detail and the review reader. |
| 10 | **Settings** | Appearance, privacy, Discord, Data (import/export/clear/delete) | Account deletion must be reachable in-app. |
| 11 | **Onboarding** | Native sign-up completion | Until this ships, un-onboarded accounts finish on the website (slice 1 gate). |
| 12 | **Billing** | Plans and upgrade | The StoreKit vs Polar-web question is decided in that spec, not here. |
| 13 | **Achievements** | Badges · Goals · Challenges | |
| 14 | **Quotes** | Saved and submitted quotes | |
| 15 | **Year in review** | Wrapped and month recap | Seasonal; can slot earlier if a December lands mid-program. |

## Cross-slice conventions

These hold for every slice and do not need re-deciding per spec.

- **One API contract.** Screens consume the same `/api` endpoints the web uses.
  When a screen needs data the web does not expose, the slice spec says so
  explicitly and justifies the new endpoint.
- **Session.** One signed-in session per device: the app stores the Better Auth
  credential in the Keychain and sends it as a `Cookie` header against a single
  origin (see the foundation spec for why the system cookie jar cannot be used).
  No parallel token scheme is introduced later.
- **Pagination.** Cursor-based, matching the web endpoints; infinite lists load on
  scroll with an explicit retry affordance on failure.
- **States.** Every screen defines loading, empty, error-with-retry, and
  signed-out behavior. "Signed-out" mostly means a sign-in prompt: unlike the web,
  the iOS app does not serve public share routes.
- **Testing.** Pure logic (parsing, cursors, formatting, gates) is unit-tested with
  Swift Testing and runs without a simulator; screens get a written simulator smoke
  checklist per slice.
- **Ratings.** Stored ratings are integer tenths; display is `stored / 10` on a
  0–10 scale, showing `10` rather than `10.0` at the maximum — same rule as the web.

## Risks

- **Two clients drift.** Web ships fast; iOS will lag by construction. Mitigation:
  slices port behavior from the server contract rather than from web components,
  so server-side changes reach both.
- **Program length.** Fifteen slices is a long road. Mitigation: slices 1–5 form a
  usable app (browse, search, look up a title, log it); everything after that is
  additive, and the order can be revisited at any slice boundary.
- **Apple review.** Sign in with Apple is required because Discord login is
  offered, account deletion must be reachable in-app (slice 10), and paid plans
  may require StoreKit (slice 12). The first two are planned; the third is an open
  commercial question deferred to slice 12.

## Open considerations (non-blocking)

- Whether Android reuses this slice order or starts from what iOS learned.
- Whether the web palette picker ever ships on iOS, or the app keeps one theme.
- Whether later slices adopt an offline cache for the diary, or stay network-first.
