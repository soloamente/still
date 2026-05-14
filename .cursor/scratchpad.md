# Still — 70mm Cinematic Direction Plan

## Background and Motivation

Still is already designed as a cinephile diary with an explicit "cinema atmosphere"
layer (film grain, vignette, marquee ticker, film-strip rail, genre-driven hero
glow, "lobby chatter / now showing" copy, arthouse vs multiplex presets). The user
feels the site still isn't immersive enough and wants more personality connected
to film as a medium.

Direction confirmed via interview on 2026-05-13:

- **Vibe**: 70mm epic / Kubrick-Villeneuve — wide cinematic framing, heavy
  vignette, deep blacks, ultra-quiet UI, big posters.
- **Scope**: Everywhere — global tokens, motion, typography, shell chrome.
- **Ingredients**: editorial display type, real letterboxing, scene-cut page
  transitions, film stock detail (sprockets/edge codes/flicker), per-film color
  world, end-credits patterns, ticket-stub artifacts, subtle audio.
- **Constraints**: None — use judgment (so: still WCAG AA, still respect
  `prefers-reduced-motion`, perf budget within reason, audio strictly opt-in).

The goal is a meaningful visual shift, not a subtle polish.

## Key Challenges and Analysis

### 1. Typography is the single biggest gap

`globals.css` aliases `--font-serif` to Inter (`--font-proxima-nova`). The
`font-serif` and `font-editorial` utilities therefore render in a UI sans face,
which is the loudest reason the system doesn't read as "cinematic". One file
(`diary-entry.tsx`) imports Playfair Display inline, proving the absence is
already being papered over case-by-case. A real editorial display face needs to
live at the token layer.

Recommended face: **Fraunces** (Google Fonts, variable axis for `opsz`,
`SOFT`, `WONK`; free; Letterboxd-adjacent cinematic gravitas). Alternatives:
PP Editorial Old (paid, sharper editorial cut), GT Sectra (paid, more
"prestige drama"), Migra (paid, Kubrick-adjacent).

### 2. Per-film color world requires sync-time work

Today's `accentFromGenres` is a static genre→hex lookup, only used for the
hero glow. A true per-film color world needs:

- **Extraction**: server-side at TMDB sync time using `node-vibrant` + `sharp`,
  pulled from poster (preferred) or backdrop. Persist 3 colors per movie:
  `accent` (vibrant/warm), `accent_muted` (darker), `accent_text` (legible).
- **Theming**: a `MovieThemeProvider` (server component, no JS) injects per-film
  CSS vars at the page root. Buttons, hero glow, scrollbar, dividers, link
  underlines, focus rings — all subtly bend to the film.
- **Fallback**: if palette absent (new film, sync miss), fall back to existing
  genre accent.

Cost: one-time DB migration adding three columns to `movies` + extension to
`tmdb-sync.ts` to compute palette on insert/update.

### 3. Page transitions: Next 16 view-transitions API is the right tool

Already on Next 16 + React 19. Use the stable `next/view-transitions` API
(unstable_ViewTransition export wrapped via project shim). Fade-to-black 180ms
between route swaps; iris-out only on movie page entry. Falls back gracefully
on Firefox/older Safari (no transition, instant nav — acceptable).

### 4. Audio is the riskiest ingredient

Autoplay policies, user trust, accessibility. Mitigations:
- Default OFF. Toggle in settings: "Theater audio (experimental)".
- WebAudio with gain envelope (fade-in 600ms, never abrupt).
- All clips CC0 from freesound.org, ≤50KB each, lazy-loaded.
- Three clips only: projector hum (loops on movie pages), reel clack (on log),
  soft curtain whoosh (on first page load post-opt-in).
- Hard-mute on `prefers-reduced-motion: reduce` AND no audio API on iOS Low
  Power Mode.

### 5. Scope is large — must phase aggressively

Each phase below is shippable on its own and delivers visible value. We do not
move to phase N+1 until N is verified by the human planner.

### 6. Existing "arthouse" preset is conceptually fine but underused

Keep `data-cinema-preset="arthouse"` as the default and use the same hook for
70mm tuning rather than introducing a new preset name. (Adding "imax" or "70mm"
would just be a third arbitrary label. The aesthetic IS arthouse 70mm — that's
what the picks say.) Existing `multiplex` preset stays as a louder mode.

## High-level Task Breakdown

Each task block below has explicit success criteria the Executor can self-verify
before reporting completion. One task at a time. Human Planner confirms before
moving on.

### Phase 1 — Foundation: editorial type, true black, letterbox primitive

**1.1 Add Fraunces display face + `font-display` token**
- Add `Fraunces` to `apps/web/src/app/layout.tsx` via `next/font/google` with
  `variable: "--font-fraunces"`, `display: "swap"`, axes `opsz 9..144`,
  `wght 300..700`.
- In `packages/ui/src/styles/globals.css`:
  - Add `--font-fraunces-stack: var(--font-fraunces, "Fraunces"), ui-serif, Georgia, serif;`
  - Add new utility class `.font-display` and new theme token `--font-display`.
  - Keep `font-serif` aliased to Inter for backwards compat for now (we will
    decide page-by-page whether a heading is "display" or "serif").
- Success: `<h1 className="font-display">Still</h1>` renders in Fraunces in dev,
  no FOUT, build passes.

**1.2 Migrate top-level page headings from `font-serif` to `font-display`**
- Files: landing `page.tsx` h1 + h2, `movie/[id]/page.tsx` h1, `home/page.tsx`
  Section titles, `BrandMark` wordmark, `diary-entry` ticket title (drop the
  inline Playfair_Display import — replace with `font-display`).
- Tagline/long-form copy stays on `font-editorial` (still Inter — that's
  correct, editorial body is a different job).
- Success: visual diff shows display headlines in Fraunces sitewide; no
  Playfair_Display inline imports remain in `apps/web/src/`.

**1.3 Refine black scale + heavier vignette default**
- In `globals.css`:
  - Add `--surface-theater: #020202` (deeper than `--surface-canvas`), used as
    the body background.
  - Bump `:root` defaults: `--cinema-vignette-spread: 180px`,
    `--cinema-vignette-alpha: 0.55`. Multiplex preset bumps proportionally.
  - New utility `.cinema-theater-floor`: bg `--surface-theater` with subtle
    radial vignette inset baked in.
- Success: body background is visibly darker (just shy of pure black, never
  banded), hero edges feel more "house lights down".

**1.4 `<Letterbox>` primitive**
- New file: `apps/web/src/components/cinema/letterbox.tsx`.
- Props: `aspect` (`"2.39"` | `"2.35"` | `"1.85"` | `"21:9"`, default `"2.39"`),
  `bars` (default `true`, draws 16px true-black bars top + bottom on desktop,
  10px on mobile), `children`, `className`.
- Uses CSS `aspect-ratio` + `overflow: hidden`, never JS.
- Success: drop in around landing hero rail and movie page backdrop, get
  letterbox bars + scope crop without ratio drift.

**1.5 Apply letterbox to landing hero, movie hero, profile cover (if it exists)**
- Wrap `LandingPosterRail` in letterbox 2.39:1.
- Movie hero `<section>`: backdrop image gets letterbox 2.39:1; poster overlaps
  the lower bar by 30% (Villeneuve poster-overlap pattern).
- Profile page hero (if present): 21:9 letterbox.
- Success: hero sections read as widescreen frames, not banners.

**Phase 1 deliverable**: Open the site and the typographic + framing change is
the first thing you feel. Estimate: 2–4 hours executor time.

### Phase 2 — Per-film color world

**2.1 Schema migration: add palette columns to `movies`**
- File: `packages/db/src/schema/movie.ts`. Add `accentVibrant`, `accentMuted`,
  `accentText` as nullable text columns.
- Generate migration via `bun run db:generate` (or equivalent — check
  package.json scripts).
- Success: migration file exists, schema typecheck passes.

**2.2 Palette extraction at TMDB sync time**
- File: `apps/server/src/jobs/tmdb-sync.ts`. After fetching/storing a movie's
  poster URL, fetch the poster bytes (cap at w342 size) and run `node-vibrant`
  to get `Vibrant`, `DarkMuted`, and a contrast-safe text color via WCAG ratio
  check against `#070707`.
- Persist to the three new columns.
- Skip + log if poster URL missing or extraction throws.
- Success: re-running the sync on a sample of 10 movies populates the three
  columns with valid hex strings.

**2.3 `MovieThemeProvider`**
- New file: `apps/web/src/components/movie/movie-theme-provider.tsx`. Server
  component (no `"use client"`). Takes `accent`, `accentMuted`, `accentText`
  props and renders a `<div style={{ "--movie-accent": …, "--movie-accent-muted": …, "--movie-accent-text": … }}>` wrapper.
- Update `movie/[id]/page.tsx` to use this instead of the inline `style` block,
  and pass palette from DB (fall back to `accentFromGenres` if columns null).
- Success: movie page DOM has the three CSS vars on the article wrapper.

**2.4 Wire palette into chrome elements**
- In `globals.css`, add a `.movie-themed` scope that lets these vars bleed into:
  - `::selection` background
  - focus ring color (override `--ring` inside scope)
  - scrollbar thumb (inside scope)
  - any `.movie-hero-glow` overrides (already partly done)
  - link underline color on body copy inside the page
- Don't override button accent color — buttons stay desert-orange app-wide
  (consistency > novelty).
- Success: viewing two different movie pages side-by-side, the selection
  color, focus ring, and scrollbar visibly differ per film.

**Phase 2 deliverable**: every movie page wears its own film's color.

### Phase 3 — Scene-cut transitions + projector boot

**3.1 Adopt `next/view-transitions`**
- Wrap `(app)/layout.tsx` with `unstable_ViewTransition` (or stable export in
  current Next 16.2.0 — verify exact import path).
- Add a CSS rule in `globals.css`:
  ```css
  @media not (prefers-reduced-motion: reduce) {
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation-duration: 180ms;
      animation-timing-function: var(--aker-ease);
    }
    ::view-transition-old(root) { animation-name: cinema-fade-out; }
    ::view-transition-new(root) { animation-name: cinema-fade-in; }
  }
  ```
- Define `cinema-fade-out` (opacity 1→0 over a black overlay) and
  `cinema-fade-in` (opacity 0→1).
- Success: navigating from `/home` to `/movies/...` cross-fades through black
  instead of pop-in.

**3.2 Iris-out on movie page enter (progressive enhancement)**
- Add `view-transition-name: hero-iris` to the movie page hero `<section>`.
- Define a circular `clip-path` keyframe that grows from 0% to 100% radius.
- Falls back to plain fade on browsers without VT support.
- Success: opening a movie page from elsewhere visibly irises out from center.

**3.3 Projector boot on first paint**
- New component: `apps/web/src/components/cinema/projector-boot.tsx`. Client.
- On mount, if `sessionStorage.cinemaBooted` is unset: render a fixed full-screen
  black overlay with a 5-frame opacity flicker (0→0.95→0.2→1→0) over ~360ms,
  then unmount and set the flag.
- Skip entirely on `prefers-reduced-motion: reduce` or repeat-views (BFcache).
- Mount once in `(app)/layout.tsx`.
- Success: refresh the app shell, see a brief projector-startup flicker, then
  the page resolves; navigate elsewhere and back without seeing it again.

**Phase 3 deliverable**: navigation feels like cuts between scenes; first
visit feels like the house lights coming down.

### Phase 4 — Film stock detail

**4.1 Edge codes on `.cinema-film-strip-rail`**
- Extend the existing CSS rail with optional `data-edge-code` attribute that
  renders small monospace numbers (`24 · 25 · 26 …` or `KODAK · 5219 · 24P`)
  inside each "perf" using `::before` counters.
- Class variant: `.cinema-film-strip-rail--coded`.
- Success: diary list with `coded` rail shows tiny frame-stamp text along the
  perf rail.

**4.2 `<FrameStamp>` component**
- New file: `apps/web/src/components/cinema/frame-stamp.tsx`.
- Renders fixed-position small label at top-left of a parent, e.g.
  `4-PERF · 70MM · CINEMASCOPE` or `STILL · REEL 1 · 24FPS`. Uses
  `font-mono`, opacity 0.4, letter-spacing 0.3em. Decorative (`aria-hidden`).
- Used on movie page hero and landing hero.
- Success: hero corners show subtle frame-stamp text without competing with
  the title.

**4.3 Subtle projector flicker on hero entry**
- CSS-only keyframe `cinema-projector-flicker`: 6 small opacity/brightness
  blips over 480ms. Applied via class `.cinema-hero-flicker` to the hero
  inner image on first render.
- Use `animation-play-state: paused` on `prefers-reduced-motion`.
- Success: opening a movie page shows a barely-perceptible flicker on the
  backdrop, then settles.

**Phase 4 deliverable**: film-medium texture without becoming Halloween/grindhouse.

### Phase 5 — Credits patterns

**5.1 Profile page → filmography layout**
- Restructure `profile/[handle]/page.tsx` to lead with a credits-styled
  filmography: section header `FILMOGRAPHY`, then a 3-column grid (YEAR ·
  TITLE · ROLE/RATING), small-caps year column tabular-nums, title in
  `font-display`, third column muted.
- Below filmography: existing reviews/lists in sub-sections styled like
  "ALSO CREDITED FOR".
- Success: a profile reads top-to-bottom like an IMDb-meets-end-credits doc.

**5.2 `<CreditsCrawl>` component**
- New file: `apps/web/src/components/cinema/credits-crawl.tsx`. Client.
- Accepts `lines: { role: string; people: string[] }[]`, renders a vertically
  scrolling end-credits crawl (CSS-only animation, slow). Pauses on hover/focus.
- Honor reduced-motion: static stacked layout instead.
- Success: drop in at the bottom of any movie page (`tmdbJson.credits.crew`)
  to see a crawl that pauses on hover.

**5.3 Long review → "and that's a wrap" closing credits**
- In `reviews/[id]/page.tsx`, append a `CreditsCrawl` with author + likers +
  commenters styled as "WRITTEN BY / READ BY".
- Success: long reviews end with a real credits sequence.

**Phase 5 deliverable**: reading a profile or a long review feels like the
credits at the end of a film.

### Phase 6 — Watchlist + ticket primitive

**6.1 Extract `<TicketStub>` primitive from `DiaryEntry`**
- New file: `apps/web/src/components/cinema/ticket-stub.tsx`.
- Generalized ticket: poster top, color stub bottom, punched notches, optional
  rating/note/badge slots, optional `tearDirection` prop.
- Refactor `DiaryEntry` to compose `TicketStub`.
- Success: existing diary visual unchanged; new component covers the same UI
  in fewer lines.

**6.2 Watchlist as ticket stack**
- `watchlist/page.tsx`: render watchlist items as `TicketStub`s in a fanned
  grid. On hover, the hovered ticket lifts and shifts neighbors slightly
  (CSS-only via `:has` + transform).
- Success: visually, the watchlist reads as "tickets I've collected", not
  "items in a queue".

**6.3 Home "Coming attractions" as ticket strip**
- Replace the simple poster grid in `home/page.tsx` "Coming attractions"
  section with a horizontal ticket-strip variant of `TicketStub` (compact
  prop).
- Success: home gains a tangible texture distinction between sections.

**Phase 6 deliverable**: the watchlist feels like a physical object.

### Phase 7 — Audio (opt-in)

**7.1 Settings toggle**
- Add `theaterAudio` boolean to user preferences (DB column on `profile` or
  `user_preferences` — pick what exists; do not add a whole table for one
  flag).
- Surface in `/me/settings`: switch with copy "Theater audio (experimental) —
  projector hum on film pages, soft clack on logs. Default off."
- Success: toggling persists round-trip.

**7.2 `useCinemaSound` provider** *(implemented as `useCinematicAudio` inside `sound-provider.tsx`)*
- New file: `apps/web/src/components/cinema/sound-provider.tsx`. Client.
- WebAudio context, lazy-loaded only after first user gesture AND toggle on.
- API: exposed `useCinematicAudio()` with `play(name)`, `stopSound(name)`, looping teardown helpers.
- Clips bundled in `apps/web/public/audio/`: `projector-hum.ogg`, `reel-clack.ogg`, `curtain.ogg`. CC0, ≤50KB.
- Hard-mute on `prefers-reduced-motion`.
- Success: with toggle on, navigating to a movie page starts projector hum
  faded in over 600ms; logging a film triggers a single reel-clack.

**Phase 7 deliverable**: opt-in audio layer feels like a real cinema, never
forced on anyone.

### Phase 8 — Polish + verify

- **Manual / release QA** (Planner): cross-browser sweep, Lighthouse Δ vs baseline, WCAG probes on darkest `MovieThemeProvider` palettes.
- **Automated Executor pass** (repo): authoritative `globals.css` header taxonomy; removed brittle absolute reference to DESIGN.md sources; **`prefers-reduced-motion`** freezes `.animate-spin` + ticket links (`a.cinema-ticket-link`); accented **button** `:focus-visible` inside `.movie-themed` matches anchors; **`@media (prefers-contrast: more)`** stacks a white outer ring on keyed focus inside tinted film shells; **`/sign-in` + `/search`** wrap `useSearchParams` clients in `<Suspense>` with lightweight fallbacks so `next build` (static prerender) succeeds.
- **Optional later**: prune any remaining duplicate `arthouse` tuning if still redundant once defaults equal 70 mm presets.

**Phase 8 deliverable**: ship-ready after manual matrix + Lighthouse/contrast checkpoints above.

## Project Status Board

### Phase 1 — Foundation
- [x] 1.1 Add Fraunces display face + `font-display` token *(awaiting human verify)*
- [x] 1.2 Migrate top-level headings from `font-serif` to `font-display` *(awaiting human verify)*
- [x] 1.3 Refine black scale + heavier vignette default *(awaiting human verify)*
- [x] 1.4 `<Letterbox>` primitive *(awaiting human verify)*
- [x] 1.5 Apply letterbox to landing hero, movie hero, profile cover *(awaiting human verify)*

**Phase 1 complete — awaiting Planner/human sign-off before Phase 2.**

### Phase 2 — Per-film color world
- [x] 2.1 Schema migration: add palette columns to `movies` *(SQL: `0001_abnormal_black_bolt.sql`; run `bun run db:migrate` when DB reachable)*
- [x] 2.2 Palette extraction at TMDB sync time
- [x] 2.3 `MovieThemeProvider`
- [x] 2.4 Wire palette into chrome elements (`globals.css` `.movie-themed`)

### Phase 3 — Scene-cut transitions
- [x] 3.1 Adopt View Transitions (CSS `::view-transition-*`, `experimental.viewTransition`) + `CinemaSceneCut` veil
- [x] 3.2 Iris-out on movie page enter (`cinema-hero-iris` + `view-transition-name: hero-iris`)
- [x] 3.3 Projector boot on first paint (`ProjectorBoot`)

### Phase 4 — Film stock detail
- [x] 4.1 Edge codes on `.cinema-film-strip-rail` (`--coded`, `data-edge-code`)
- [x] 4.2 `<FrameStamp>` component (landing + movie hero)
- [x] 4.3 Subtle projector flicker on hero entry (`.cinema-hero-flicker`)

### Phase 5 — Credits patterns
- [x] 5.1 Profile page → filmography layout
- [x] 5.2 `<CreditsCrawl>` component
- [x] 5.3 Long review → "and that's a wrap" closing credits

### Phase 6 — Watchlist + ticket primitive
- [x] 6.1 Extract `<TicketStub>` primitive from `DiaryEntry`
- [x] 6.2 Watchlist as ticket stack
- [x] 6.3 Home "Coming attractions" as ticket strip

### Phase 7 — Audio (opt-in)
- [x] 7.1 Settings toggle
- [x] 7.2 `useCinematicAudio` / CinemaSound provider

### Phase 8 — Polish + verify
- [ ] 8.1 Cross-browser smoke (manual — Chrome · Safari · Firefox · iOS Safari)
- [x] 8.2 Reduced-motion audit — code sweep (globals + `cinema-ticket-link` + loaders)
- [ ] 8.3 Lighthouse perf (manual — compare mobile score vs last tagged release)
- [ ] 8.4 a11y contrast on per‑film palette (manual — extremes + WCAG probe)
- [x] 8.5 `globals.css` token map prose + stray path cleanup + button focus parity
- [x] 8.6 `next build` green: Suspense shells for `/sign-in` + `/search`; `prefers-contrast` focus boost on `.movie-themed` controls *(Executor verified `bun run build` in `apps/web/`)*

## Executor's Feedback or Assistance Requests

### 2026-05-13 — `/movies/[id]` hero taps (Log / Watchlist / overlap)

**Cause**: Putting `pointer-events: none` on the full-bleed hero wrapper (via `.cinema-vignette`) made the overlapping title / `MovieActions` row unreliable for hit-testing; inset vignette shadow does not need that. Decorative Scope frame stays non-interactive with `pointer-events-none` on the hero `<Letterbox>` root.

**Also**: Overlap strip now uses `relative z-20 isolate pointer-events-auto` so the pulled-up column consistently wins over the Scope frame. `bun run build` in `apps/web` — green (Executor).

**Planner verify**: `/movies/687163` at ~2530×1322. If taps still fail only while Agentation’s toolbar is active, the extension overlay is above the page (stack often shows `_agentation_...`).

### 2026-05-13 — Phase 5 Executor pass (Planner confirm)

**What shipped**
- `CreditsCrawl` (`apps/web/src/components/cinema/credits-crawl.tsx`) + crawl keyframes in `packages/ui/src/styles/globals.css` (pause on hover/focus; reduced-motion collapses to a scrollable stack).
- Profile: Filmography ledger (Year · Title · Score) from deduped `recentlyWatched`; favorites/reviews/lists under **Also credited for**; redundant “recent” rail removed from section order parsing.
- Movie page: crawl block before `CreditsFooter`, fed by `crewRowsToCreditsCrawlLines` with a broader `buildCrewRows(..., 80)` pass for marquee depth vs the compact crew table.
- Review detail API: `GET /api/reviews/:id` now joins author `profile` and returns `likedByProfiles` (≤40 likes, newest first) for crawl copy.
- Long reviews (≥480 chars body): footer **And that’s a wrap** + crawl (Written / Read / Applauded lines).

**Verify**
- `bunx tsc --noEmit -p apps/web/tsconfig.json` and `apps/server` — clean.

Planner: manual spot-check `/profile/[handle]`, `/movies/[id]`, `/reviews/[id]` (long vs short review) plus reduced-motion pref.

### 2026-05-13 — Phase 6 Executor pass (Planner confirm)

**What shipped**
- `TicketStub` (`apps/web/src/components/cinema/ticket-stub.tsx`): poster + perforated stub (`default`/`compact`), optional `stubKicker`, TMDB fragment or HTTPS `poster_url`, `linkHoverGrow` to avoid conflicting transforms in stacks.
- `DiaryEntry` refactored onto `TicketStub` (same visual silhouette).
- `globals.css`: `.watchlist-ticket-stack` `:has(li:hover)` fan/lift choreography + reduced-motion reset.
- `watchlist/page.tsx`: held tickets (`TicketStub`), stack flex wrap; **`linkHoverGrow={false}`** so stack transforms win.
- `home/page.tsx`: **Coming soon** horizontal ticket rail (`compact` stubs); deterministic feed list keys (`idx` instead of `Math.random()`).

**Verify**: `tsc --noEmit` (web). Manual: `/watchlist` hover focus on one ticket vs neighbors; `/home` carousel on narrow viewports (`snap-x`). Reduced motion: hover stack should stay flat.

### 2026-05-13 — Phase 7 Executor pass (Planner confirm)

**What shipped**
- **Preferences merge** on PATCH `/profiles/me`: shallow merges `preferences` JSON so unrelated keys survive (`apps/server/src/routes/profiles.ts`).
- **`apps/web/public/audio/`**: projector hum, reel clack (+ spare curtain cue) bundled as lightweight Opus.
- **`sound-provider.tsx`**: gesture-gated Web Audio decode, mute on reduced motion, fetches patron preference; **`useCinematicAudio`** exposes `play` / `stopSound` / looping teardown.
- **`movie-projection-hum.tsx`** + `<MovieProjectionHum />` on `/movies/[id]` for looping booth hum (~600 ms linear gain ramp-in).
- **Settings**: `preferences.theaterAudio` persisted + synced to audio context post-save (`settings-form.tsx`, `settings/page.tsx` types).
- **`MovieActions`**: emits `reel-clack` after successful log flows.
- **`Providers`**: `CinemaSoundProvider` under `ThemeProvider`.

**Planner verify**: Toggle in `/me/settings`, open any film route with audio on; quit route hum should fade off; retry with OS reduced motion (expect silence).

### 2026-05-14 — Phase 8 Executor pass (partial automation)

**What shipped**
- **`globals.css`** header **token / surface map** (drops brittle absolute DESIGN.md path); catalogs Phases 1–7 primitives (grain, iris, crawl, stacks, `/public/audio`, etc.).
- **Reduced motion**: freeze **`.animate-spin`** loaders; **`a.cinema-ticket-link`** neutralizes Diary / ticket lifts + poster brighten transitions (`ticket-stub` adds the marker class).
- **a11y**: `.movie-themed button:focus-visible` shares the accented ring recipe with anchors so keyed nav doesn’t regress on tinted film pages.

**Still manual**: 8.1 browser matrix; 8.3 Lighthouse deltas vs baseline; 8.4 saturated poster edge palettes.

### 2026-05-14 — Production build unblock (Executor)

**Issue**: Next static prerender failed — `useSearchParams()` without a Suspense ancestor on `/sign-in` (and the same pattern on `/search` via `SearchClient`).

**Fix**
- `(auth)/sign-in/page.tsx`: `<Suspense fallback={<SignInFormFallback />}>` around `<SignInForm />` (skeleton placeholders + `aria-busy`).
- `(app)/search/page.tsx`: same pattern wrapping `<SearchClient />`.
- **`globals.css`**: under `@media (prefers-contrast: more)`, film-page links/buttons get a stronger double-ring focus shadow for WCAG-ish visibility on neon accents.

**Verify**: `cd apps/web && bun run build` → exit **0** (Next 16.2.6, Turbopack).

**Planner**: Phase 8 still needs human 8.1 / 8.3 / 8.4 before declaring ship-ready.

### 2026-05-13 — `db:migrate` fix (pg + env path + baseline hint)

- **`packages/db`**: `db:migrate` now runs `bun run ./src/migrate.ts` using `pg` + `drizzle-orm/node-postgres/migrator` (avoids Neon serverless / `drizzle-kit migrate` issues; use Neon **direct** `DATABASE_URL`, not pooler).
- **Bugfix**: `migrate.ts` loads `apps/server/.env` via `../../../apps/server/.env` (from `packages/db/src/`).
- **Drift**: If migrate fails with `type "…" already exists` (Postgres 42710), the DB was likely built with `push` without journal rows; the script logs a SQL hint to insert into `drizzle.__drizzle_migrations` or use a fresh DB.

### 2026-05-13 — Task 1.1 complete, awaiting manual verify

**What changed**
- `apps/web/src/app/layout.tsx`: import `Fraunces` from `next/font/google` with
  `variable: "--font-fraunces"`, `axes: ["opsz"]`, `display: "swap"`. Variable
  is added to the `<html>` className alongside Inter/Geist Mono.
- `packages/ui/src/styles/globals.css`:
  - New `:root` token `--font-fraunces-stack` with multi-tier fallback
    (Fraunces → PP Editorial Old → GT Sectra → ui-serif → Georgia → serif).
  - New theme token `--font-display: var(--font-fraunces-stack);` in the
    `@theme inline` block, which auto-generates the Tailwind `font-display`
    utility under v4.
  - New `.font-display` plain-CSS utility with cinematic defaults
    (`letter-spacing: -0.02em`, `opsz: 96`, `SOFT: 30`, `ss01/ss02` features).
  - New `.font-display-sm` sibling for smaller display use (`opsz: 24`).
- `font-serif` still aliases to Inter — backwards compatible. No existing
  heading visually changes yet; that's task 1.2.

**Automated checks passed**
- `tsc --noEmit -p apps/web/tsconfig.json` → 0 errors.
- Dev server (Turbopack, Next 16.2.6) recompiled successfully (`✓ Compiled in
  131ms`) and served `/movies/...` with HTTP 200 after the edit.
- Pre-existing module-not-found and hydration errors in the dev log are
  unrelated to this change (untracked WIP `floating-tab-bar.tsx`, pre-existing
  nested-`<a>` in `BrandMark`/`AppNav`). Flagged but not in scope for 1.1.

**Manual verify — please do this and confirm before I move to 1.2**
1. Open any page in the app (e.g. `/home`).
2. In devtools elements panel, inspect `<html>` and confirm it has both
   `--font-inter` and `--font-fraunces` CSS variables resolving to a
   `__className_…` Next.js next/font value.
3. Temporarily slap `className="font-display text-6xl"` on any heading (or
   open a fresh route file and add an `<h1 className="font-display">Test</h1>`)
   — confirm it renders in Fraunces, not Inter. Visually it should feel
   editorial / serif / cinematic, with subtle slab-ish terminals.
4. Confirm no console errors related to font loading.

If verified, say "1.1 ok" or "go" and I'll proceed to 1.2 (migrating actual
top-level headings sitewide). If Fraunces feels wrong, now is the cheapest
time to swap it (e.g. to Fraunces with a different opsz, or to Cormorant,
Newsreader, or a paid face).

### 2026-05-13 — Task 1.2 complete, awaiting manual verify

**Migration policy applied**
- `font-display` (Fraunces) for: every page `<h1>`, every page-section `<h2>`
  via the shared `Section` component + landing's features `<h2>`, BrandMark
  wordmark, DoubleFeatureSuggestion film-title `<h3>`, MovieShareStub
  film-title, DiaryEntry ticket title, Diary month divider, auth marketing
  pull-quote, home empty-state callout, chat sidebar "Chats" header.
- `font-serif` (Inter, unchanged) intentionally kept for: inline movie title
  mentions in the feed, card titles (list-card, review-card, news-strip
  headlines, chat thread titles, profile list titles), small UI labels
  (badges, achievements), review composer header, numeric figures with
  `tabular-nums` on the movie page (scores would look like a phone bill in
  Fraunces), inline `<span>` movie references in review hero.

**Course correction during 1.2 — `.font-display` now uses `font-optical-sizing: auto`**
The 1.1 `.font-display` utility I wrote forced `font-variation-settings: "opsz" 96`,
which would make smaller usages (text-lg, text-xl, text-2xl) look display-cut
and chunky. Browsers have honored `font-optical-sizing: auto` by default since
2019 (Chrome 79+, Firefox 62+, Safari 13+), so a single utility scales
gracefully from text-lg to text-7xl without us juggling sibling classes. I
removed the never-applied `.font-display-sm` sibling I'd added in 1.1.

**Files touched (22)**

Shared components:
- `components/brand-mark.tsx`
- `components/ui/section.tsx` (header + docblock)
- `components/cinema/double-feature-suggestion.tsx`
- `components/cinema/movie-share-stub.tsx`
- `components/diary/diary-entry.tsx` (drops inline Playfair_Display import)
- `components/onboarding/onboarding-flow.tsx` (3 h1s)
- `components/chat/chat-pane.tsx` (sidebar h2)
- `components/list/new-list-form.tsx`

Pages / routes:
- `app/page.tsx` (landing h1 + features h2)
- `app/global-error.tsx`
- `app/(app)/error.tsx`
- `app/(app)/movies/[id]/error.tsx`
- `app/(app)/movies/[id]/page.tsx` (hero h1)
- `app/(app)/home/page.tsx` (empty-state)
- `app/(app)/diary/page.tsx` (month dividers)
- `app/(app)/reviews/[id]/page.tsx` (review h1)
- `app/(app)/lists/[id]/page.tsx`
- `app/(app)/profile/[handle]/page.tsx` (profile h1)
- `app/(app)/me/settings/page.tsx`
- `app/(app)/me/customization/page.tsx`
- `app/(auth)/sign-in/page.tsx`
- `app/(auth)/sign-up/page.tsx`
- `app/(auth)/layout.tsx` (Capra pull-quote)

Plus `packages/ui/src/styles/globals.css` (simplified `.font-display`,
removed unused `.font-display-sm`).

**Automated checks passed**
- `tsc --noEmit -p apps/web/tsconfig.json` → 0 errors.
- No lint warnings on touched files.
- Dev server (Turbopack) hot-reloaded across all 22 file edits with no
  errors, multiple `✓ Compiled in {32,47,50}ms`. `/movies/1317288` continues
  returning 200.

**Manual verify**
1. Hit `/home`, `/diary`, `/movies/<anything>`, `/profile/<handle>`,
   `/lists`, `/sign-in`, `/sign-up`, `/me/settings`, `/me/customization`,
   `/reviews/<id>`, and root `/` (landing). Eyeball that every page H1, every
   "Section" header (Lobby chatter / Now showing / Coming attractions etc.),
   the BrandMark, the diary ticket title, the auth Frank Capra quote, and
   the home empty-state are all in Fraunces.
2. Confirm card titles / inline mentions / numeric scores DID NOT change
   (e.g. the TMDb 9.2/10 on movie pages stays in Inter — that's intentional).
3. Confirm no console errors and no FOUT flash.

If everything reads correctly, say "1.2 ok" or "go" and I'll proceed to 1.3
(refining the black scale + heavier vignette default, the second-biggest
perceptual lever of Phase 1).

### 2026-05-13 — Tasks 1.3, 1.4, 1.5 complete (Phase 1 foundation)

**1.3** — `--surface-theater: #020202`, `--background` uses it; vignette defaults
180px / 0.55 (multiplex 130px / 0.62); `.cinema-theater-floor`; scrollbar border;
`themeColor` `#020202`; `--color-theater` in theme.

**1.4** — `components/cinema/letterbox.tsx` (aspects 2.39, 2.35, 1.85, 21:9).

**1.5** — Landing: `cinema-theater-floor` + Letterbox around poster rail;
`LandingPosterRail` fills frame. Movie: backdrop in Letterbox; content
`md:-mt-24`. Profile: banner in 21:9 Letterbox; no-banner gradient strip.

**Verify**: spot-check `/`, `/movies/:id`, `/profile/:handle` (with banner).
Say **Phase 1 ok** to start Phase 2, or request tweaks.

### 2026-05-13 — Phase 2 (per-film color world) implemented

- Migration `0001_abnormal_black_bolt.sql` adds `palette_accent`, `palette_muted`,
  `palette_foreground` on `movie`.
- `apps/server/src/lib/poster-palette.ts` + `sync-movie-palette.ts`;
  `node-vibrant/node` + poster fetch → Buffer; persists after `cacheDetail` and
  stale refresh job.
- `MovieThemeProvider` + `.movie-themed` chrome (selection, link focus).
- **Run** `bun run db:migrate` when the DB is reachable; then load a film page
  once to extract/store palette.

### Open questions for the Planner before execution begins

1. **Display font final pick** — default plan is **Fraunces** (free,
   variable, sufficient gravitas). If the user prefers PP Editorial Old,
   GT Sectra, or Migra and is willing to fund a license + self-host, I'll
   swap. **Default: Fraunces.**

2. **Audio assets sourcing** — plan is to source three CC0 clips from
   freesound.org and commit them under `apps/web/public/audio/`. If user
   wants custom-recorded or licensed clips, that's a separate task. **Default:
   freesound CC0.**

3. **Phase ordering** — plan ships Phase 1 first (typography + letterbox)
   because it has the largest perceptual ROI per hour. If the user would
   rather see per-film color world (Phase 2) first because it photographs
   well in screenshots, I'll re-order. **Default: 1 → 2 → 3 → … → 8.**

4. **Profile filmography (5.1)** — currently profile shows reviews + lists.
   The "filmography" reframing reorganizes the page. If the user has strong
   feelings about retaining a particular section first, flag it now. **Default:
   filmography → reviews → lists.**

## Lessons

- `packages/db/src/migrate.ts` must load `.env` with **`../../../apps/server/.env`**
  (from `src/`), matching how `drizzle.config.ts` resolves `../../apps/server/.env`
  from the `packages/db/` cwd.
- **`db:migrate`** uses `pg` + programmatic `migrate()`; Neon pooler/serverless
  drivers are a poor fit for migration transactions—prefer the direct connection
  string for CLI migrate.
- If **`drizzle-kit push`** was used, **`__drizzle_migrations`** may be empty while
  objects exist; baseline with hashed rows or reset the DB before `db:migrate`.
- Inter is the current `--font-serif` alias. Any heading using `font-serif`
  to a dedicated `font-display` token is more honest than rebinding
  `font-serif` and keeps backward compat options open.
- `diary-entry.tsx` already imported Playfair Display inline — symptom of
  the missing display face. We'll remove that one-off in 1.2.
- Next 16 + React 19 means stable view-transitions are available; no need
  for framer-motion AnimatePresence at the route level (still fine for
  in-page animations).
- `framer-motion` imports are `from "framer-motion"`, not `motion/react` —
  per user rules.
