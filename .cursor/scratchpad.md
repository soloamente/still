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

### Secondary initiative (2026-05-14): product design system & screen IA

The product direction is a **Letterboxd-class diary + social layer**, with more
features (lists, chat, badges, richer home) and a **modern, enjoyable** feel so
people return often. A **Mobbin (web)** pass surfaced recurring patterns: thin
icon rail or labeled sidebar, pill search with removable scope tags, chip-based
browse, tab + filter toolbars for libraries, masonry/timeline for personal
media, centered profile heroes with stat-tabs, optional friend-activity column,
floating primary composer. **Planner goal for this track:** define a **coherent
design system** (tokens, layout primitives, key screens) that stays compatible
with the existing **cinematic / 70mm** identity (Fraunces display, theater
surfaces, grain, optional audio) without fighting it — *atmosphere on the
canvas, clarity in the controls.*

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

### 7. Design system reboot vs. cinematic maximalism (2026-05-14)

**Tension:** Heavy chrome (vignette, grain, tickets, credits) can **compete**
with scanability if every surface is decorative. **Resolution:** treat UI in
layers — **(A)** shell chrome and hero moments carry cinema; **(B)** lists,
forms, settings, and dense feeds follow **quiet** patterns (consistent radius,
spacing, one accent, predictable hit targets). **Technical anchor:** shadcn
`base-lyra` + `packages/ui` tokens; avoid one-off components where a primitive
(`AppShell`, `FilterToolbar`, `ContentGrid`) would unify behavior.

**Success for Track B** is not “more screens” but **fewer decisions per
interaction**: navigation depth, filter discoverability, empty states that
invite the next log, and mobile-first tap targets (≥44px) without breaking
desktop density.

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

### Track B — Design system & screen IA (Mobbin-informed, 2026-05-14)

Executor runs **one sub-task at a time**; human Planner confirms before the
next. Each item has self-verifiable success criteria.

**B.1 — Audit & principles doc (in-repo only: scratchpad + code comments)**

- Inventory primary routes: landing, home, diary, movie, profile, lists,
  reviews, search, watchlist, chat, settings.
- For each: note layout pattern (rail vs top nav), density, duplicate CTAs,
  a11y gaps (focus order, heading hierarchy).
- Write **5–7 non-negotiable principles** (e.g. one global accent, display type
  only for titles/H1–H2, chips for filters, popovers for dense filters).
- **Success:** bullet audit + principles appended under this track in
  `scratchpad.md` (Executor section cross-link); no behavior change.
- **Delivered 2026-05-14 (Executor):** see `Executor's Feedback` → *B.1 complete*.

**B.2 — Token & elevation pass (globals / theme)**

- Formalize **surface ladder** (`canvas` → `raised` → `popover`) compatible
  with `#020202` theater floor; ensure borders/contrast work on per-film tinted
  pages (`.movie-themed`).
- Document spacing scale usage for **page gutters vs card gutters** (avoid
  arbitrary `p-4`/`p-6` mix).
- **Success:** Storybook or static page not required; instead `globals.css`
  comments + token names used by ≥3 representative components; `tsc`/build
  green.
- **Delivered 2026-05-14 (Executor):** elevation tokens + `@theme` utilities
  (`surface-canvas` / `surface-raised` / `surface-overlay`); `--card` /
  `--popover` mapping; `AppNav`, `ActivityItem`, `CommandPalette` + diary/home
  empty states use `bg-surface-*`; `(app)/layout` gutter comment; `user-menu`
  drops redundant `bg-card` on dropdown (uses `bg-popover`). `bun run build`
  green — if Link/redirect route types falsely fail, delete `apps/web/.next` and
  rebuild (stale `RouteImpl` cache).

**B.3 — `AppShell` primitive (navigation contract)**

- Choose **default:** icon rail + labeled section header *or* collapsible
  sidebar (Mobbin: Threads/Sora vs Grain/Suno). Pick one for MVP consistency.
- Spec: breakpoints where rail becomes drawer; where FAB / bottom bar appears
  (if any).
- **Success:** single shell component wraps `(app)` layout; no duplicate nav
  markup; keyboard landmark (`nav`, `main`).
- **Delivered 2026-05-14 (Executor):** `AppShell` in `components/app/app-shell.tsx`
  wraps chrome + `main#main-content`; `(app)/layout.tsx` only auth/profile gates;
  `appShellMainContentMinHeightStyle` + `APP_SHELL_BOTTOM_RESERVE_CSS` for person
  page vertical centering; docblock states bottom-bar contract (no rail→drawer).

**B.4 — Search + filter primitives**

- **Global search:** pill, optional scope tag (“Movies”, “People”), clear action.
- **Browse/discover:** chip row + optional advanced drawer (genre/year/service).
- **Success:** `/search` and one browse surface (e.g. home or new `/explore`)
  use the same primitives; applied filters show as dismissible chips.
- **Delivered 2026-05-14 (Executor):** `SearchPillField` + `FilterChipRow` /
  `FilterChipLink` / `FilterChipButton` (`components/ui/`); `SearchClient` uses
  pill + scope “Films” + dismissible query chip; `/movies/popular` +
  **`/movies/upcoming`** share `MovieCatalogSurfaceChips` + `PopularMoviesInfinite`
  `catalogKind`; `fetchMoviesUpcoming` in `still-api-fetch.ts`; search skeleton
  pill-shaped. Advanced drawer deferred to later browse work.

**B.5 — Core screens (priority order — adjust with human)**

1. **Home / following** — feed card anatomy (avatar, film line, rating, poster
   thumb, actions); optional right rail “friend activity” (collapsible).
   - **Delivered + human verified 2026-05-14:** `ActivityItem` + `FeedPersonAvatar`,
     `HomeFriendActivityRail`, `deriveFriendRailEntries`; nested review/list links
     removed; stable feed keys.
2. **Discover** — grid + chips + sort; empty genre state.
   - **Delivered 2026-05-14 (Executor):** `/movies/discover` + `GET /api/movies/discover` +
     `GET /api/movies/genres`; `MovieDiscoverToolbar` (genre rail + sort chips);
     `PopularMoviesInfinite` `catalogKind="discover"`; `MovieCatalogSurfaceChips`
     adds **Discover**; home empty CTA → discover; empty catalogue panel when
     TMDb returns zero rows.
3. **Film detail** — hero + tabs (reviews / lists / related); sticky log CTA.
   - **Delivered 2026-05-14 (Executor):** `MovieDetailExploreTabs` (Reviews / Lists /
     Related + empty states); `GET /api/movies/:id/lists`; hero **MovieActions**
     moved to **sticky** dock (`bottom` aligned with `AppShell` nav reserve);
     lists tab surfaces public lists containing the title.
4. **Quick log** — modal or bottom sheet: film → date → rating → note →
   submit; disabled-until-valid.
   - **Delivered + human verified 2026-05-14:** `QuickLogRoot` / `useQuickLog`; `MovieActions` Log opens sheet; `postLog` payload + validation as shipped (see Executor feedback B.5.4).
5. **Diary** — month grouping + list/masonry toggle for user stills only.
   - **Delivered + human verified 2026-05-14:** month buckets sorted **newest first**; rows within month by `watchedAt` desc; invalid dates → **Undated** section; `DiaryPageClient` toolbar (**Tickets** = ticket grid / **Stills** = CSS-column masonry of poster tiles + optional rating); preference `localStorage` `still.diary.layout`; `DiaryStillTile` for masonry-only; rows without joined `movie` skipped server-side.
6. **Lists** — Savee-style row: title + count + horizontal poster strip.
   - **Delivered + human verified 2026-05-14:** `withCoverPosterPaths` in `apps/server/src/lib/list-cover-posters.ts` — wired to `GET /api/lists` + `/popular` + `/me` + `/by-user/:userId`, list `POST`/`PATCH` return, and profile `lists` query; **`ListRowStrip`** (`apps/web/…/list-row-strip.tsx`) + **`toListBoardRow`** (`lib/list-board-row.ts`); `/lists` index + profile **Lists** section use bordered single-column rows (title, counts, likes, updated, optional description, overlapping poster strip from real `poster_path`); removed broken `ListCard` TMDB `movieId.jpg` URLs.
7. **Profile** — centered header + stat tabs + content grid.
   - **Delivered + human verified 2026-05-14:** centered hero (avatar overlap, display name, @handle, bio, stats row, actions); **`?tab=`** section tabs (`filmography` + `sectionOrder` rails with content); semantic **`<table>`** filmography; single **content grid** panel per tab; Biome-a11y-friendly vs prior `role="table"` on `div`.
8. **Notifications** — grouped list, read state.
9. **Settings** — left sub-nav sections.
   - **Delivered (Executor 2026-05-15):** `(app)/me/layout.tsx` + **`MeAccountNav`** (`me-account-nav.tsx`) — **vertical** “Account” links on **`md+`** (icon + label + short description); **horizontal** underlined tabs on **`<md`** (profile-tabs pattern); wraps **`/me/settings`** and **`/me/customization`**.

- **Success per screen:** responsive at `sm`/`md`/`lg`; one a11y pass (labels,
  focus); loading/empty/error states specified and implemented where missing.

**B.6 — Motion & delight budget**

- Align with user rules: interaction motion **≤200ms**; route transitions may
  stay cinematic but **lists/grids** avoid gratuitous stagger.
- **Success:** checklist in scratchpad Lessons + no new `prefers-reduced-motion`
  violations.
- **Delivered + human verified 2026-05-14:** `--aker-duration` / `--aker-duration-slow` **0.2s**; Framer dialogs/sheets/onboarding **0.2s** + `useReducedMotion`; `AppNav` + landing poster rail; ticket stub filter **200ms**; **Lessons** entry — see Executor **Track B.6** log.

**B.7 — Planner sign-off**

- Human reviews Track B on staging: “easy + beautiful enough to return daily.”
- **Success:** explicit Planner note in scratchpad closing Track B or listing follow-ups.
- **Recorded 2026-05-14:** Executor section **“Human: B.6 signed off + Track B.7 Planner sign-off”** — Track B implementation arc closed for shipped B.3–B.6 + B.5.4–B.5.8 scope; **follow-ups** listed there (B.5.2/B.5.3/B.5.9, nav parity, B.1/B.2, Phase 8 manual). *(**2026-05-15 / 2026-05-16:** those follow-ups closed in Executor — **Human: B.5.2 / B.5.3 / B.5.9 signed off**, **Human: B.1 / B.2 signed off**.)*

**Track B deliverable:** a **usable** product skin: predictable navigation,
fast filtering, readable feeds, profiles that feel premium — **on top of** the
existing cinematic identity rather than replacing it.

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

**Manual QA playbooks:** **8.1**, **8.3**, and **8.4** have Executor-written checklists in **`### Phase 8.1 prep`**, **`### Phase 8.3 prep`**, and **`### Phase 8.4 prep`** (same file, below this list).

- [ ] 8.1 Cross-browser smoke *(**Phase 8.1 prep** — Chrome · Safari · Firefox · iOS Safari)*
- [x] 8.2 Reduced-motion audit — code sweep (globals + `cinema-ticket-link` + loaders)
- [ ] 8.3 Lighthouse perf *(**Phase 8.3 prep** — mobile vs last tagged release, like-for-like build mode)*
- [ ] 8.4 a11y contrast on per‑film palette *(**Phase 8.4 prep** — `.movie-themed` extremes + WCAG probe)*
- [x] 8.5 `globals.css` token map prose + stray path cleanup + button focus parity
- [x] 8.6 `next build` green: Suspense shells for `/sign-in` + `/search`; `prefers-contrast` focus boost on `.movie-themed` controls *(Executor verified `bun run build` in `apps/web/`)*

### Phase 8.1 prep — Cross-browser smoke checklist *(Executor 2026-05-16)*

**Browsers:** Chrome · Safari · Firefox · iOS Safari — same signed-in account (staging or local).

**Per browser (ordered pass)**
1. **`/home`** — feed scrolls; at **`lg+`**, friend-activity rail expands/collapses; no horizontal overflow around **390px** width.
2. **`/movies/popular` → `/movies/upcoming` → `/movies/discover`** (chips) — on Discover, exercise genre + sort + scroll; **← Lobby** returns home; confirm infinite footer still sane.
3. **`/movies/[id]`** (pick a real id) — hero legible; sticky dock clears bottom **`AppNav`**; switch among **Reviews / Lists / Related** once each.
4. **⌘K / Ctrl+K** — palette opens; choose **Discover films** shortcut (lands on **`/movies/discover`**).
5. **`/notifications`** on a **narrow** viewport — bell visible in **`AppNav`**; list scrolls; one row interaction if you have data.
6. **`/me/settings` ↔ `/me/customization`** — mobile tab strip vs **`md+`** left rail; **`aria-current`** / active chrome reads correctly.
7. **`/achievements`** — **Badges** / **Goals** tab chips; back pill returns to last browse context; no horizontal overflow at **390px**.

**Pass criteria:** no blank shell, no stuck modal/palette, bottom **`AppNav`** remains tappable (≥ ~44px targets), **Firefox** tolerates absent **View Transitions** (instant nav is OK).

### Phase 8.3 prep — Lighthouse mobile perf *(Executor 2026-05-16)*

**Tool:** Chrome **Lighthouse** (DevTools) or hosted **PageSpeed Insights** against the staging origin.

**Setup**
- Preset: **Mobile** + default throttling; first run in a **clean profile** (or hard-reload with cache disabled) so scores are comparable run-to-run.
- Compare **like vs like**: **`next start`** (or production deploy) vs the **same** for the last **git tag** you care about — do **not** compare **`next dev`** to **`next start`**.

**URLs to capture (mobile)** — adjust host to staging:
1. **`/`** (marketing — largest paint is usually hero / poster rail).
2. **`/home`** (signed-in lobby — feed + rails).
3. **`/movies/[id]`** — pick a **poster-heavy** film (large hero image).
4. **`/diary`** — long ticket list (scroll cost).

**Log per URL:** **Performance** score, **LCP** (element + time), **CLS**, **TBT** (or **INP** if shown), Chrome version, build mode.

**Pass gate (relative, default):** no **> ~5 pt** drop in **Performance** on **`/home`** vs last tagged baseline **without** an obvious cause (new hero asset, removed `priority`, slower API); **LCP** not worse by **> ~500ms** on same network/hardware. *(Planner may tighten numbers.)*

### Phase 8.4 prep — Per-film palette contrast *(Executor 2026-05-16)*

**Scope:** Pages under **`.movie-themed`** (film detail and any chrome that inherits per-film CSS vars) — **WCAG AA** for text and controls that patrons actually read.

**Pick 3 films** (swap ids for real rows in your DB): **high-chroma** poster, **muted / brown** poster, **dark-on-dark** edge case if you have one.

**Per `/movies/[id]`**
1. Chrome **Rendering → Emulate CSS `prefers-contrast: more`** — buttons, links, and focus rings remain visible on hero + dock.
2. **Axe** (or another contrast tool) on **primary CTA**, **hero link**, **body/meta** near accent-tinted regions — export or screenshot failures.
3. **Keyboard:** **Tab** from first focusable through hero + into **MovieDetailExploreTabs** — no focus trapped or invisible behind hero.

**Pass criteria:** no **critical** contrast failures on the **read title → rate / log → open tabs** path; **`prefers-contrast: more`** remains shippable.

### RadialToolkit — Catalogue lobbies (Scope A)
- [x] RT.A Spec + plan approved *(2026-05-22)*
- [x] RT.1 Recipe builder + tests (`catalogue-radial-items`)
- [x] RT.2 `CataloguePosterTile` shell
- [x] RT.3 Add-to-list from radial (`useAddToListRadial`)
- [x] RT.4 `PopularMoviesInfinite` + `/home`
- [x] RT.5 `/watchlist`
- [x] RT.6 `/diary` (film + TV group poster)
- [x] RT.7 Build, `graphify update`, `AGENTS.md` *(awaiting human QA **ok**)*

### Track B — Design system & screen IA *(**B.1–B.7** + **B.5.1–B.5.9** human-verified per scratchpad where shipped; Phase 8 manual QA still open)*
- [x] B.1 Route audit + written principles (scratchpad + code) *(human verified 2026-05-16)*
- [x] B.2 Token & elevation ladder (surfaces, gutters, `.movie-themed` harmony) *(human verified 2026-05-16)*
- [x] B.3 `AppShell` / navigation contract for `(app)` *(human verified 2026-05-14)*
- [x] B.4 Search + filter primitives (global pill, chips, advanced drawer) *(human verified 2026-05-14; drawer deferred)*
- [x] B.5 Core screens (…) — **one screen per Executor milestone** *(**B.5.1–B.5.9** human-verified **2026-05-15** where shipped: **B.5.2** Discover, **B.5.3** film detail, **B.5.9** settings sub-nav — user **ok** **2026-05-15**; **B.5.4–B.5.8** as previously verified **2026-05-14**.)*
- [x] B.6 Motion budget checklist (≤200ms interactions; reduced-motion clean) *(human verified 2026-05-14)*
- [x] B.7 Planner / human sign-off on Track B *(Planner note 2026-05-14 — see Executor; staging “daily return” bar met for shipped scope, follow-ups listed)*

## Executor's Feedback or Assistance Requests

### 2026-05-22 — App themes (Theater · Lobby Light · Noir) *(Executor)*

**Shipped:** Spec `docs/superpowers/specs/2026-05-22-app-themes-design.md` + plan `docs/superpowers/plans/2026-05-22-app-themes.md`. Registry (`app-themes.ts` + server mirror), CSS `html.theme-*` blocks, `AppThemeShell` + `next-themes` (`still-app-theme`), Settings **Appearance** section, account menu chips, profile pref validation on PATCH, bundled cinema defaults + override flag.

**Fix 2026-05-22 (Theater = Light):** React hydration was resetting `<html class>` to font vars only, dropping `theme-lobby-light` / `.dark`. **`RootHtmlClassSync`** + **`root-html-appearance.ts`** merge fonts + palette; **`ThemeFlashGuardScript`** applies stored palette before paint.

**2026-05-22:** Removed patron-facing **Cinema atmosphere** (Quiet theater / Multiplex booth) — UI, profile prefs, `data-cinema-preset`, preset-specific CSS. Appearance is **color theme only**; legacy keys stripped on profile PATCH.

**Human / Planner:** Settings **Appearance** + avatar menu chips — **Theater / Light / Noir** only. Reply **`ok`** when signed off.

### 2026-05-22 — RadialToolkit catalogue lobbies (Scope A) *(Executor)*

**Shipped:** `CataloguePosterTile`, `buildCatalogueRadialItemSpecs` (+ tests), `useAddToListRadial`; wired into **`PopularMoviesInfinite`** (`catalogueRadialSurface` + `signedIn`) on **`/home`**, **`/watchlist`**, and **`DiaryLobbyGrid`** / **`DiaryTvGroupCell`**. Build + unit tests pass.

**Human / Planner:** RMB-hold on lobby posters on `/home` (Movies/TV), `/diary`, `/watchlist` — confirm menus match surface (watchlist **Remove** destructive; movies **Add to list**). Reply **`ok`** when signed off.

### 2026-05-20 — Auto Favorites list + profile filter *(Executor)*

**Shipped:** Migration **`0007_system_favorites_list`** (`list.system_kind`, `list_item.id` PK + `tv_id` XOR); **`favorites-list-sync.ts`**; logs POST/PATCH/DELETE hooks; lists API guards + TV join on GET `/:id`; profile **`?favorites=1`** with **All | Favorites** chips; social **Favorites** tab → `?tab=movies&favorites=1`; list detail read-only for system list + TV posters; add-to-list picker excludes system list.

**Human / Planner:** Heart a film/TV on detail → confirm **Favorites** list appears under Lists; profile **Movies** → **Favorites** chip filters grid; unfavorite removes list item. Reply **`ok`** when signed off. **Follow-up (not blocking):** backfill script for existing `log.liked` rows.

### 2026-05-20 — Search dialog catalogue tags **V2.1** *(Executor)*

**Shipped (code):** Extended **`search-query-tags`** (`genre` / `curated`, **`deriveCatalogueFilterBundle`**, serialize/parse v2); **`search-curated-tags`**; **`useSearchDialogGenres`**; **`useCatalogueTagSearch`** (replaces structured hook in **`home-sticky-search`**); movie + TV discover **`genre`/`keywords`/`company`** (comma AND); **`GET /api/tv/genres`**; removed **“Studios filter Films only”** copy; studio suggestions allowed on TV media tag. **Tests:** `search-query-tags.test.ts` — 14 pass.

**Human / Planner (V2.1 exit):** Open **`/home`** search → type **`hor`** → Tab → **Horror** pill → poster grid (discover, no title). Try **Anime** curated + **A24** on Films/TV. Recents: **`A24 · Horror · Anime · marty`**. Reply **`ok`** to advance **V2.2** (TV search company filter) or note gaps.

**Pending:** V2.2–V2.4 per **`docs/superpowers/plans/2026-05-20-search-dialog-catalogue-tags-v2.md`**; TV text search + studio still movie-only until V2.2.

**Hotfix (2026-05-20):** Genre suggestions temporarily fetch **`en-US`** labels + module cache (so `hor` → Horror regardless of region-derived locale). **Planner:** **V2.5** added to end of v2 plan — Settings **catalogue language** pref, localized genre Tab/recents, optional UI i18n (Task 13). Revert hardcoded English when V2.5 ships.

### 2026-05-20 — Search dialog catalogue tags **V2.5 + V2.2/V2.4** *(Executor)*

**Shipped:** **Settings → Catalogue language** (`catalogTmdbLanguage` pref, `MeCatalogLanguageSelect`); server `getTmdbLanguageForUser` (explicit → watch region → `en-US`); genre fetch uses patron language (`useCatalogTmdbLanguage` + per-language cache); **TV search** `?company=` + discover fallback; over-filter empty copy + **3+ tag** hint; removed `use-structured-catalog-search.ts`. **Tests:** 20 pass (`search-query-tags`, `profile-preferences`).

**Human / Planner:** **ok** (2026-05-20) — V2.5 locale + TV studio search + polish signed off.

**Planner:** Catalogue tags v2 core (**V2.1–V2.5**) complete for shipped scope. Optional stretch **Task 13** (UI message i18n) remains in plan if product wants Settings/search chrome translated later.

### 2026-05-20 — TV watching progress *(Planner — brainstorm complete)*

**Approved design (hybrid approach 3):** `tv_watch` tracker + scoped diary (`show` / `season` / `episode`); patron toggles **season vs episode** progress mode; statuses **watching · paused · abandoned · finished · rewatching**; in-app **`tv.new_episode`** notifications; anime = TV on TMDb (no separate community).

**Docs:**
- Spec: `docs/superpowers/specs/2026-05-20-tv-watching-progress-design.md`
- Plan: `docs/superpowers/plans/2026-05-20-tv-watching-progress.md` (phases **W.1–W.4**)

**Human:** **yes** (2026-05-20) — design §1–§3 approved; spec + plan written.

**Next:** Human **`ok`** on **W.1** → **`go`** for **W.2** (TV detail UX). Apply migration `0006_tv_watch` locally (`cd packages/db && bun run db:migrate`).

### 2026-05-20 — TV watching progress **W.1** *(Executor)*

**Shipped:** `tv_watch` + `tv_watch_episode` schema; `log.log_scope` / `season_number` / `episode_number`; `validateTvLogScope` in `@still/db`; `GET /api/tv/:id/seasons` + `season/:n`; `GET/POST/PATCH /api/tv-watch/*` (start, status, mark episode, mark-next, seasons); logs POST/PATCH scope validation. Migration **`0006_tv_watch.sql`**. **Tests:** 4 pass (`packages/db/src/tv-log-scope.test.ts`). **Server build:** green.

**Human / Planner:** Run `db:migrate`, smoke API (below), reply **`ok`** for W.2.

### 2026-05-20 — TV watching progress **W.2** *(Executor)*

**Shipped:** `TvDetailWatchProvider` + `useTvWatch`; hero **Start watching** / **Mark next episode** / status chips / continue line; **Your progress** section (season vs episode modes, checklists, mark season complete); `still-api-fetch` tv-watch helpers; About tab **Progress** nav rail entry. Files: `tv-detail-primary-actions.tsx`, `tv-detail-progress-panel.tsx`, `tv-detail-watch-context.tsx`, `tv-detail-client-root.tsx`, `tv/[id]/page.tsx`.

**Human / Planner:** Open `/tv/[id]` (signed in) → **Start watching** → toggle episodes → **Mark next episode** → switch status **Paused** → **Progress** section in About. Reply **`ok`** for **W.3** (scoped Quick Log + diary chips).

### 2026-05-20 — TV watching progress **W.3** *(Executor)*

**Shipped:** `TvLogScopePicker` in Quick Log (Episode / Season / Whole show + season/episode selects); scope state on create + PATCH; `coerceDiaryLogRows` normalises `log_scope` / season / episode from **`GET /api/logs/me`**; diary poster grid **`scopeLabel`** chip (`S02E04`, `Season 2`); `TvLogScopeChip` on ticket stubs; edit flows pass scope (`diary-log-edit-button`, `use-tv-detail-user-state`). Files: `tv-log-scope-picker.tsx`, `tv-log-scope-display.ts`, `tv-log-scope-chip.tsx`, `quick-log-sheet.tsx`, `diary-entry.tsx`, `diary/page.tsx`, `movie-poster.tsx`.

**Human / Planner:** Quick Log on a series → pick **Episode** + season/episode → save → **`/diary`** shows scope chip on poster; **Edit log** reopens with same scope. Reply **`ok`** for **W.4**.

### 2026-05-20 — Diary TV grouping (in-place expand) *(Executor)*

**Shipped:** Client-side **`buildDiaryLobbyGridItems`** (`diary-lobby-grouping.ts`) — films one tile per log; TV logs group by **`tmdbId`**. **`DiaryLobbyGrid`** + **`DiaryTvGroupCell`**: collapsed poster shows **most specific scope** + **`N diary entries`** subline; tap **flips** card (poster front → log list back, same 2∶3 footprint); scope/date/rating rows → Quick Log edit; **Open series** / **Add diary entry** on back; one flipped group at a time (outside click + Escape). **`formatTvLogScopeLabel`** → **Whole series** never blank. Spec corrected: patron chose flip **(3)**, not row-span — `docs/superpowers/specs/2026-05-20-diary-tv-grouping-design.md`. Tests: `diary-lobby-grouping.test.ts` (2 pass).

**Human / Planner:** On **`/diary`**, two logs same series → one tile; tap → **card flips** (grid does not grow); back shows labeled rows; flip back via poster-side tap or ↺ on back. Reply **`ok`** when verified.

### 2026-05-20 — TV watching progress **W.4** *(Executor)*

**Shipped:** `apps/server/src/jobs/tv-new-episode-sync.ts` — scans `tv_watch` (`watching`/`rewatching` + `notify_new_episodes`), dedupes `tv.new_episode` per episode, one stub per show per pass; scheduled every **6h** in `apps/server/src/index.ts` (`TV_EPISODE_SYNC_ENABLED` env, default on). **`notifications.ts`** — `tv.new_episode` href → `/tv/{id}#tv-section-progress`. Notification icons: **`Tv`** in list + dropdown. **`fetch-tv-watch-me-server.ts`** + **`HomeContinueWatchingRail`** on **`/home`** (signed-in, `watching,rewatching`, limit 12, hidden when empty).

**Human / Planner:** (1) Start watching two series → **`/home`** shows **Continue watching** with **Next: S…E…** captions. (2) Pause one → it drops off the rail. (3) With notifications on, after a recent episode airs, bell shows **New episode · {show}** → opens TV detail **Progress** section. Reply **`ok`** when verified.

**Project Status Board (TV progress):**
- [x] W.1 Schema + API core (`tv_watch`, log scope, seasons routes, tv-watch CRUD) — **Executor 2026-05-20**; human **`ok`**
- [x] W.2 TV detail UX (start watching, status, progress panel) — **Executor 2026-05-20**; human **`ok`**
- [x] W.3 Scoped Quick Log + diary chips — **Executor 2026-05-20**; human **`ok`** **2026-05-20**
- [x] Diary TV grouping (lobby flip) — **Executor 2026-05-20**; human **`ok`** **2026-05-20**
- [x] W.4 Notifications job + continue-watching rail — **Executor 2026-05-20**; human **`ok`** **2026-05-20** (nested `<a>` + rail polish)

### 2026-05-20 — Search V2.5 recents locale round-trip *(Executor)*

**Shipped:** `home-search-recent-storage.ts` — v2 localStorage rows store `tags` + `freeText` + display `label`; genre pills refresh names from current `catalogTmdbLanguage` on read/restore (legacy string rows migrate on read). Wired in `home-sticky-search.tsx`. **Tests:** `home-search-recent-storage.test.ts` (4 pass) + `search-query-tags.test.ts` (20 pass).

**Human / Planner:** Settings → **Español** → search `ter` → save recent → switch back to English → pick recent chip → genre id **27** still applies with updated label. Reply **`ok`** or note gaps. **TV progress W.1–W.4** closed for shipped scope.

### 2026-05-20 — TV lobby **Ongoing / Completed** right rail *(Executor)*

**Shipped:** TV **Ongoing** → discover `with_status=0` (Returning), **Completed** → `ended` (3) — fixes overlap from old `on_the_air` sheet. Upcoming discover unchanged. TV **left:** **Latest | Popular** only. TV **right:** **Ongoing | Completed | Upcoming** | sep | **Filters**; **In cinemas / At home** only when **`run=upcoming`**. Slices are mutually exclusive (`?run=`). Example: `/home?browse=tv&sort=popular&run=upcoming`. Legacy `?sort=ongoing|upcoming` still maps. **Tests:** 6 pass across `home-catalog-run` + `home-catalog-sort`.

**Human / Planner:** TV → **Upcoming** (right) shows first-air grid; cannot combine with Ongoing/Completed; **Popular** + **Completed** uses ended discover. **Human `ok` 2026-05-21** on overlap fix (Returning vs Ended).

**Follow-up (Executor 2026-05-21):** `/tv/discover?status=returning|ended` now forwards to API; lobby persist restores `?run=`; home footnote link works.

### 2026-05-22 — Community watch leaderboards *(Executor)*

**Shipped:** **Film ranks** + **TV ranks** on `/home?browse=community` — five centered community chips; **`?period=week|month|year|all`** (persisted); tier-card podium + list from #4; server **`/api/leaderboard/films|tv`** + per-patron **`…/logs`** (public profiles only, every log in window); **`PatronWatchLedgerDrawer`** (filmography-style poster grid); client refetch with patron IANA **`tz`** after SSR (**`fetchCommunityLeaderboard`**); **`home-leaderboard-interactive.ts`** — subtle hover on **@handle** (underline) and **count** (soft wash + **`DetailMotionButton`** press). **Tests:** `leaderboard-period`, `home-community-feed`, `home-leaderboard-period` — **12 pass**. **`bun run build`** in **`apps/web`** — **exit 0** (also fixed unrelated TS: `normalizeTmdbImagesBundle`, `HomeLobbySearchParams.period`, onboarding profile cast, auth **`Field`** motion prop pick).

**Human / Planner:** `/home?browse=community&sort=film-ranks&period=month` — podium + rows; tap **@** → profile; tap **count** → drawer with posters; switch **Week / Year** and return — period persists; **TV ranks** same flow. Reply **`ok`** when verified.

### 2026-05-21 — Community lobby on `/home` *(Executor)*

**Shipped:** Replaced “coming soon” placeholder with live community feeds — **Lists** (public list poster grid), **Reviews** (recent public reviews + `ReviewCard`), **Diary** (`GET /api/logs/recent` + `ActivityItem`), **Activity** (following feed or `/api/feed/discover` + friend rail). **`HomeCommunityLobby`**, **`HomeCommunityEmpty`**, server **`/api/logs/recent`**, enriched **`/api/reviews/recent`** with profile. Sort chips no longer say “coming soon”.

**Human / Planner:** `/home` → **Community** → cycle **Lists / Reviews / Diary / Activity**; confirm rows or centered empty states. Reply **`ok`** when verified.

### 2026-05-21 — Community Reviews + Activity polish *(Executor)*

**Shipped:** **`ReviewCard`** — optional **`listing`** with left **`FeedListingThumb`** (poster from `/api/reviews/recent` `movie` join). **`ActivityItem`** — poster-first row layout, no **`MoviePoster`** elevation (fixes clipped action buttons); list rows use **`coverPosterPaths`** from feed API. Server: **`feed-items.ts`** (`feedAtMs`, `enrichFeedListRows`, ISO `at`); **`/api/feed/discover`** sort fixed (`Number(Date)` → **`feedAtMs`**). Community catalogue shell **`overflow-visible`** (was clipping feed chrome).

**Human / Planner:** `/home?browse=community&sort=reviews` — each review shows film poster on the left; **Activity** tab — posters load, right-side actions not cut off. Reply **`ok`** when verified.

### 2026-05-21 — Community feed polish: borders, ratings, avatars *(Executor)*

**Shipped:** **`ActivityItem`** / friend rail — borderless **`bg-background`** + shadow (matches **`ReviewCard`**); **`FeedPersonAvatar`** + friend rail use **`PatronPortraitAvatar`** / **`profilePatronAvatarImageUrl`** (fixes private Blob **403** in terminal). Ratings use **`DiaryLogRatingLabel`** / **`formatStoredLogRatingDisplay`** (0.0–10.0, not raw tenths → **47.5**). **`AGENTS.md`** documents rating + avatar contracts.

**Open (not blocking):** Search V2.5 Task 13 UI i18n stretch; Phase **8.1 / 8.3 / 8.4** manual QA.

### 2026-05-21 — Build green + type fixes *(Executor)*

**Shipped:** `bun run build --filter=web` **exit 0** after fixes: `tmdb.ts` gunzip cast, `app-scroll-to-top` expanded width state, `tv-detail-primary-actions` diary `onClick` wrapper, `MyTvLog` scope fields, `fetch-tv-watch-me-server` cast. **Tests:** search + catalog **26 pass**.

**Human / Planner:** Open **`/achievements`** (Badges / Goals, back pill) → **`ok`**. Or run Phase **8.1** checklist from scratchpad.

### 2026-05-21 — `/achievements` lobby verify prep *(Executor)*

**Shipped:** Unit tests **`achievements-lobby-tab.test.ts`** (5 pass) — `parseAchievementsLobbyTab`, `buildAchievementsLobbyHref`, `isAchievementsLobbyTabId`. **`bun run build --filter=web`** exit 0. HTTP smoke: **`/achievements?tab=goals`** → **200** on dev (**307** when unauthenticated redirect applies).

**Human / Planner:** Signed in → **`/achievements`** — **Badges** grid (earned vs locked tooltips); **Goals** tab (`?tab=goals`) — progress rows; back pill label matches last browse (e.g. **Lobby** from `/home`). **Human `ok` 2026-05-21** — verified.

### 2026-05-21 — Continue watching: TV browse only *(Executor)*

**Shipped:** **`/home`** — **`HomeContinueWatchingRail`** and **`fetchTvWatchMeServer`** only when **`browse=tv`** (hidden on **Movies** / **Community**). **`home-continue-watching-rail.tsx`** docstring updated; **`AGENTS.md`** notes TV-only rail.

**Human / Planner:** Signed in with active TV watches → **Movies** on `/home` has **no** Continue watching strip; switch to **TV** → rail appears with **Next: S…E…** captions. **Human `ok` 2026-05-21** — verified.

### 2026-05-20 — Search dialog catalogue tags **V2.5 planned** *(Planner)*

**Added to** `docs/superpowers/plans/2026-05-20-search-dialog-catalogue-tags-v2.md` **and** design spec § Patron locale (now implemented — see Executor entry above).

### 2026-05-20 — Search dialog tagged query **Phases 2–3** *(Executor)*

**Shipped:** **`GET /api/movies/search?company=`** (TMDb filter + discover title fallback); **`GET /api/lists/search`** (own lists, auth); **`useStructuredCatalogSearch`** + **`SearchDialogListResults`**. Combined flow: A24 pill + Films + **`marty`** hits company-scoped movie search; **lists** tag searches patron lists (sign-in prompt when logged out).

**Human / Planner:** Retest A24 + marty; add **lists** tag + title filter. Reply **`ok`** for Phase 4 (serialized recents) or note issues.

### 2026-05-20 — Search dialog tagged query **Phase 4 + closure** *(Executor)*

**Shipped:** **`serializeStructuredQuery`** / **`parseRecentStructuredQuery`** (recents round-trip); open-animation height/overflow fixes (content-fit panel, skeletons, horizontal clip). **Task 10 closure:** TV media tag blocks studio Tab suggestions; **`searchResultsStatusMessage`** in **`aria-live`** regions; focus returns to search pill on close; **`motion/react`** import; **Recent searches** **`sr-only`** heading.

**Planner:** Tagged-query plan **Phases 1–4 complete** per **`docs/superpowers/plans/2026-05-20-search-dialog-tagged-query.md`**. No Phase 5 in scope — run **manual test checklist** in that plan (§ Manual test checklist) then mark feature signed off.

**Human / Planner:** Full checklist (A24+marty, lists, recents, reduced motion) → reply **`ok`** for Planner sign-off on tagged search.

### 2026-05-20 — Search dialog tagged query **Phase 1** *(Executor)*

**Shipped:** Token field in **`HomeStickySearch`** — **`search-query-tags.ts`**, **`SearchTagPill`**, **`SearchTokenField`**. Human verified pill padding + tag UX (**ok**).

### 2026-05-20 — `/achievements` lobby remake *(Executor)*

**Shipped:** `/achievements` rebuilt on the **profile/diary lobby shell** — `AchievementsTopBar` (back pill), `rounded-[2.5rem] bg-card` tray, **Badges / Goals** tab chips (`?tab=goals`), patron intro line. **Badges** panel loads full **`/api/badges/catalog`** with earned state from **`/me`** (milestone tray glyphs, locked tiles muted). **Goals** panel merges **`/api/achievements/catalog`** + **`/me`** progress (divide-y rows, no card borders; hidden goals stay secret until progress/unlock). Shared glyphs in **`milestone-badge-glyph.tsx`**; **`profile-patron-milestones.tsx`** imports the same module.

**Human / Planner:** Open **`/achievements`** — switch **Badges** / **Goals**, hover earned vs locked badges, confirm back pill returns to last browse context. **Human `ok` 2026-05-21** — verified.

### 2026-05-20 — Marketing landing: Mobbin-pattern remake *(Executor)*

**Shipped:** Root **`/`** rebuilt to match Mobbin marketing IA on Still’s dark canvas — floating pill nav (`shadow-mobbin-xl`, `rounded-full`, `bg-card`), centered hero with emblem + dual CTAs, social-proof band, large **rounded-top preview shelf** with poster marquee + home-lobby grid radii, zig-zag **2×2 feature** panels (no 3-column row). New modules under **`apps/web/src/app/_marketing/`** (`landing-nav`, `landing-hero`, `landing-preview`, `landing-poster-marquee`, `landing-features`, `landing-footer`, `landing-social-proof`). **`landing-poster-rail.tsx`** import switched to **`motion/react`** (legacy rail unused on page).

**Mobbin reference:** MCP **`search_screens`** — Mobbin web landing (centered hero, pill nav, trusted-by strip, rounded product shelf).

**Human / Planner:** Log out (or incognito) and open **`http://localhost:3001/`** — scroll **preview** + **features**, check nav anchors and sign-up CTAs. Reply **`ok`** when the Mobbin rhythm + Still tokens feel right.

### 2026-05-19 — TV diary + watchlist parity *(Executor)*

**Shipped:** `tv` table + migration **`0003_conscious_quicksilver`**; `log` / `watchlist_item` support **exactly one of** `movie_id` or `tv_id` (CHECK + partial unique indexes). Server: **`ensureTvCached`**, **`POST /api/logs`** accepts **`movieId` XOR `tvId`**, **`GET /api/logs/me/by-tv/:tvId`**, watchlist **`POST`** same XOR, **`DELETE /api/watchlist/tv/:tvId`**, **`GET /api/watchlist/check/tv/:tvId`**, feed + profile queries join **`tv`**. Web: **`TvDetailPrimaryActions`**, **`useTvDetailUserState`**, **`QuickLog`** + **`still-api-fetch`** for TV, diary/watchlist lobbies + **`ActivityItem`** + profile filmography handle mixed rows.

**Human / Planner:** Run **`bun run db:migrate`** in **`packages/db`** (direct Postgres `DATABASE_URL`) before QA. Verify: log a show from **`/tv/[id]`**, see it on **`/diary`** and **`/watchlist`** with correct **`/tv/`** links; home feed log rows for TV.

**Verify (Executor):** `apps/server` **`bun run check-types`**, `apps/web` **`bunx tsc --noEmit -p tsconfig.json`** → **exit 0**.


**Shipped:** **`HomeCatalogSortChips`** — third tab **Upcoming** for **Movies** only (TV unchanged). **`home/page.tsx`** — **In cinemas + Upcoming** seeds from **`fetchMoviesUpcoming`**; **At home + Upcoming** seeds from **`fetchMoviesDiscover`** (`flatrate`, **`primary_release_date.asc`**, **`release_gte`** = UTC today) with **`discoverReleaseGte`** passed through **`PopularMoviesInfinite`** for paging. **`HomeCatalogViewModeToolbar`** — Filters targets **`/movies/upcoming`** vs discover with **`release_gte`**. **`home-lobby-url`** docstring mentions **Upcoming**.

**Verify (Executor):** `apps/web` **`bunx tsc --noEmit`**, `apps/server` **`bun run check-types`** → **exit 0**.

**Human / Planner:** On **`/home`** (Movies), cycle **Latest / Popular / Upcoming** × **In cinemas / At home**; open **Filters** from **Upcoming + In cinemas** → **`/movies/upcoming`**; from **Upcoming + At home** → discover with ascending primary date + **`release_gte`**.

### 2026-05-17 — Home lobby: streaming vs theatrical overlap *(Executor)*

**Shipped:** **`/home` Movies + Popular + Streaming** now uses **TMDb discover** with **`with_watch_monetization_types=flatrate`** + **`watch_region`** (from optional **`TMDB_WATCH_REGION`** env, else **`US`**) instead of raw **`/movie/popular`**, so the rail skews toward titles with **subscription streaming** in that region. **Theatrical** rails (**now playing** / **upcoming**) get a short **footnote** explaining that many films stream the same week, so overlap with Streaming is expected. **`GET /api/movies/discover`** accepts **`monetization`** + **`watch_region`**; **`/movies/discover`**, **`MovieDiscoverToolbar`**, **`PopularMoviesInfinite`**, and **Filters** on home preserve the new query. **`packages/env`:** optional **`TMDB_WATCH_REGION`** (ISO alpha-2).

**Verify (Executor):** `apps/web` **`bunx tsc --noEmit`**, `apps/server` **`bun run check-types`**, **`biome check`** on touched files → **exit 0**.

**Human / Planner:** Spot-check **`/home`** (Movies, Popular, Streaming) vs Theaters; open **Filters** from Streaming+Popular — should land on discover with **`monetization=flatrate`**. Reply **`ok`** when behaviour matches intent.

### 2026-05-18 — `/diary` lobby: **In cinemas / At home** stay on diary *(Executor)*

**Shipped:** **`HomeCatalogViewModeToolbar`** uses **`usePathname()`**; on **`/diary`** venue chips use **`buildDiaryLobbyHref({ order, venue })`** (no **`buildHomeLobbyHref`** redirect). **`buildDiaryLobbyHref`** + **`parseDiaryLobbyVenue`** in **`diary-lobby-order.ts`** — default venue follows home **Popular** (**streaming**); diary **Filters** link mirrors that slice (**`/movies/now-playing`** vs discover **`flatrate` + popularity**). **`DiaryCatalogOrderChips`** preserves **`?venue=`** when changing **`?order=`**. **`diary/page.tsx`** reads **`venue`** for **`catalogueWaveKeyOverride`** only (no per-log venue in DB yet — grid still shows all logged films).

**Verify (Executor):** repo root **`bun run build --filter=web`** → **exit 0**.

**Human / Planner:** On **`/diary`**, tap **In cinemas** / **At home** — URL should stay under **`/diary`** with **`?venue=`**; order chips should keep the active venue. Reply **`ok`** when it matches intent.

### 2026-05-15 — User `executor`: Section kicker — quiet Mobbin-style labels *(Executor)*

**Shipped:** **`apps/web/src/components/ui/section.tsx`** — section kickers drop **forced uppercase** + **desert-orange** micro-marquee styling; they render as **sentence-case** strings from each call site, **`11px` / `font-medium` / `tracking-wide` / `text-muted-foreground`**, with slightly more vertical air (**`mb-1.5`**, section stack **`space-y-5`**). Applies everywhere **`Section`** is used (home, diary, catalogue billboards, movie detail tabs, etc.).

**Verify (Executor):** repo root **`bun run check-types --filter=web`** → **exit 0**.

**Human / Planner:** Spot-check **`/home`**, **`/movies/popular`**, **`/diary`** — kickers should read as quiet metadata, not orange ticker tape. Reply **`ok`** when it matches intent. **Project Status Board:** **8.1 / 8.3 / 8.4** remain **manual** (prep sections already in this file).

### 2026-05-16 — User `go`: Catalogue **← Lobby** a11y + comment parity *(Executor)*

**Shipped:** **`/movies/popular`**, **`/movies/upcoming`**, **`/movies/discover`** — **`aria-label="Back to home lobby"`** on the header **Lobby** link (visible **← Lobby** unchanged); **upcoming** / **discover** RSC comments aligned with **popular** (seed page, cookie jar, **`blockedReason`**).

**Verify (Executor):** repo root **`bun run check-types`** + **`bun run build --filter=web`** → **exit 0**. *(Turbo may warn on querying **`apps/web/.next/dev/lock`** symlink metadata — benign when dev server touched that path.)*

**Human:** user **`ok`** **2026-05-16** — **popular / upcoming / discover** billboard **← Lobby** (**`aria-label`**, touch-safe hover tint, RSC comment parity) **human verified**; does **not** close **Phase 8.1** (full cross-browser matrix still manual).

### 2026-05-16 — User `go`: Phase 8 board ↔ prep cross-links *(Executor)*

**Shipped:** **Phase 8** status list — intro line + each open row (**8.1**, **8.3**, **8.4**) now points at its **`### Phase 8.* prep`** playbook in the same scratchpad so the Project Status Board is navigable without hunting.

**Verify (Executor):** repo root **`bun run check-types`** + **`bun run build`** → **exit 0**.

### 2026-05-16 — User `go`: Phase 8.3 + 8.4 manual prep *(Executor)*

**Shipped:** Scratchpad sections **Phase 8.3 prep — Lighthouse mobile perf** and **Phase 8.4 prep — Per-film palette contrast** — repeatable scripts + default pass gates so **8.3** / **8.4** can be ticked without ad-hoc notes.

**Verify (Executor):** repo root **`bun run check-types`** + **`bun run build`** → **exit 0** (cache hit).

### 2026-05-16 — User `go`: Phase 8.1 prep + regression *(Executor)*

**Shipped:** Scratchpad **Phase 8.1 prep — Cross-browser smoke checklist** (route matrix + pass criteria) so **8.1** has a repeatable human script across **Chrome · Safari · Firefox · iOS Safari**.

**Verify (Executor):** repo root **`bun run check-types`** + **`bun run build`** → **exit 0** (all cache hit).

### 2026-05-15 — Track B.5.9: Settings account sub-nav *(human verified 2026-05-15)*

**Shipped**
- **`apps/web/src/app/(app)/me/layout.tsx`:** Wraps **`/me/settings`** and **`/me/customization`** in a flex row (`max-w-5xl` … `lg:max-w-6xl`) with shared sub-navigation.
- **`apps/web/src/components/profile/me-account-nav.tsx`:** Client nav with **`usePathname`** — **`md+`**: left **Account** list (Settings / Customize + descriptions, `aria-current`); **`<md`**: horizontal scroll strip with bottom border (matches profile section tab affordance). Icons: **Settings**, **Palette**.

**Verify (Executor):** `cd apps/web && bun run build` → **0**.

**Verify (human)**
- **`/me/settings`** and **`/me/customization`**: narrow viewport shows top tabs; **`md+`** shows left rail; active route highlights correctly; keyboard tab order sensible.

**Human verify:** ok 2026-05-15.

### 2026-05-15 — Command palette: Discover launcher *(Executor)*

**Shipped**
- **`apps/web/src/components/app/command-palette.tsx`:** **`NAV_SHORTCUTS`** adds **Discover films** → **`/movies/discover`** (`Compass` icon) after **Popular films**, matching **`MovieCatalogSurfaceChips`** and the home **Or just explore** CTA.

**Verify (Executor):** `cd apps/web && bun run build` → **0** (2026-05-15).

### 2026-05-15 — User `go`: monorepo verify *(Executor)*

**Ran** (repo root **`C:\Users\adgv\Documents\Projects\still`**): **`bun run check-types`** then **`bun run build`** → **exit 0** (`turbo` **2.9.12** — **`@still/ui`**, **`server`**, **`@still/api-client`** typecheck; **`web`** `next build` **16.2.6**, **`server`** `tsdown`, **`extension`** `wxt build`). *At the time of this run, Turbo warned **`no output files found for task extension#build`** — addressed same day by **`turbo.json`** **`.output/**`** (see **User `go`: Turbo `build` outputs for WXT**).*

**Human / Planner:** ~~Track B rows still open for explicit **`ok`**: **B.5.2** Discover, **B.5.3** film detail, **B.5.9** settings sub-nav~~ — user **ok** **2026-05-15** (see **Human: B.5.2 / B.5.3 / B.5.9 signed off**).

### 2026-05-15 — User `go`: Turbo `build` outputs for WXT *(Executor)*

**Shipped:** Root **`turbo.json`** — global **`build.outputs`** includes **`".output/**"`** so **`apps/extension`** (`wxt build` → **`apps/extension/.output/`**) participates in Turbo cache without **`no output files found for task extension#build`**.

**Verify (Executor):** `bunx turbo build --filter=extension` twice → second run **`cache hit, replaying logs`**; no missing-output warning.

### 2026-05-15 — User `go`: WXT `runner` → `webExt` *(Executor)*

**Shipped:** **`apps/extension/wxt.config.ts`** — renamed top-level **`runner`** to **`webExt`** (same **`disabled: true`**), per WXT 0.20 deprecation (`InlineConfig#runner` → `webExt`).

**Verify (Executor):** `bunx turbo build --filter=extension --force` → **exit 0**; build log no longer prints **`InlineConfig#runner is deprecated`**.

### 2026-05-15 — User `go`: tsdown `noExternal` → `deps.alwaysBundle` *(Executor)*

**Shipped:** **`apps/server/tsdown.config.ts`** — replaced deprecated **`noExternal: [/@still\/.*/]`** with **`deps: { alwaysBundle: [/@still\/.*/] }`** so workspace **`@still/*`** packages stay inlined per tsdown ≥0.21.

**Verify (Executor):** `bunx turbo build --filter=server --force` → **exit 0**; log no longer shows **`noExternal` is deprecated**.

### 2026-05-15 — User `go`: tsdown quiet `onlyBundle` hint *(Executor)*

**Shipped:** **`apps/server/tsdown.config.ts`** — under **`deps`**, set **`onlyBundle: false`** so tsdown stops suggesting a whitelist while the server bundle still intentionally inlines **`node_modules`** (alongside **`alwaysBundle`** for **`@still/*`**).

**Verify (Executor):** `bunx turbo build --filter=server --force` → **exit 0**; **`dist/index.mjs`** still **~1.55 MB**; build log no longer prints the **`deps.onlyBundle`** hint or the **Detected dependencies in bundle** list.

### 2026-05-15 — User `go`: catalogue Lobby link touch-safe hover *(Executor)*

**Shipped:** **`/movies/popular`**, **`/movies/upcoming`**, **`/movies/discover`** — **`← Lobby`** link uses **`[@media(hover:hover)]:hover:text-foreground`** instead of bare **`hover:text-foreground`**, plus a short JSX comment (matches Track B touch guidance: no transient hover flash on press).

**Verify (Executor):** `cd apps/web && bun run build` → **0**; **`biome check --write`** on the three pages → clean.

### 2026-05-15 — User `go`: catalogue pages drop useless fragments *(Executor)*

**Shipped:** **`popular`**, **`upcoming`**, **`discover`** movie routes — removed redundant **`<>`** wrappers around **`Section`** body children (Biome **`noUselessFragments`**); **`ReactNode`** accepts multiple siblings without an extra fragment.

**Verify (Executor):** **`biome check --write`** on the three files + **`bun run build`** in **`apps/web`** → **0**.

### 2026-05-15 — User `go`: post–B.5 regression gate *(Executor)*

**Ran:** repo root **`bun run check-types`** + **`bun run build`** → **exit 0** (after user **ok** closed **B.5.2 / B.5.3 / B.5.9**). **`extension`** / **`server`** mostly **cache hit**; **`web`** full **`next build` Next 16.2.6** — no **`no output files found for task extension#build`** (current **`turbo.json`** includes **`.output/**`**).

**Scratchpad hygiene:** Track B board header updated for **B.5** closure; **B.4** “next milestone” text updated; **monorego** log footnoted to **Turbo** **`.output/**`** fix.

### 2026-05-14 — Track B follow-up: notifications nav parity *(human verified 2026-05-14)*

**Shipped**
- **`apps/web/src/components/app/app-nav.tsx`:** Removed **`hidden sm:block`** from the notifications control — **bell is always** in the floating bar (next to overflow, before avatar). Added **`aria-current="page"`** and a subtle **`bg-muted/80`** when `pathname` is `/notifications`.

**Verify (Executor):** `cd apps/web && bun run build` → **0**.

**Verify (human):** `< sm` width: bell visible; one tap → `/notifications`; active state reads on the icon.

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Human: notifications nav parity signed off

User replied **ok** — **Track B follow-up** (always-visible notifications bell in `AppNav`, `aria-current` + active styling on `/notifications`) treated as **human verified** 2026-05-14.

### 2026-05-14 — Human: B.6 signed off + Track B.7 Planner sign-off

User replied **ok go** — **B.6 Motion budget** is **human verified** (2026-05-14): global `--aker-duration` / `--aker-duration-slow` at **0.2s**, Framer sheets/dialogs/onboarding at **0.2s** with **`useReducedMotion`** fast paths, **`AppNav`** pip + hover respecting reduced motion, **landing poster rail** stagger/duration capped, **ticket stub** filter hover **200ms**.

**B.7 — Planner closes Track B (implementation arc)** for the **shipped Executor scope**: predictable `(app)` shell (B.3), search/filter primitives (B.4), core screens **B.5.4–B.5.8** + motion pass (B.6), aligned with the scratchpad **“usable product skin”** goal. **Staging / product bar:** acceptable for **daily return** for this slice; full polish still depends on Phase 8 manual QA and items below.

**Documented follow-ups (not blocking this B.7 note)**
- **B.5.2 / B.5.3 / B.5.9:** user **ok** **2026-05-15** — **human verified** (see Executor **Human: B.5.2 / B.5.3 / B.5.9 signed off**). **⌘K Discover** shortcut shipped 2026-05-15 (**Command palette: Discover launcher**).
- **Nav parity:** ~~notifications bell `hidden sm:block`~~ **addressed + human verified 2026-05-14** — bell always in `AppNav`; user **ok** on narrow-viewport check.
- **B.1 / B.2:** user **ok** **2026-05-16** — **human verified** (see **Human: B.1 / B.2 signed off**).
- **Phase 8:** **8.1** cross-browser smoke (**Phase 8.1 prep**), **8.3** Lighthouse (**Phase 8.3 prep**), **8.4** per-film palette contrast (**Phase 8.4 prep**) — manual; use prep sections before ticking rows.

### 2026-05-14 — Track B.6: Motion budget *(human verified 2026-05-14)*

**Shipped**
- **`packages/ui` `globals.css`:** `--aker-duration` and `--aker-duration-slow` set to **0.2s** (was 0.24s / 0.34s) so token-driven hovers/transitions meet **≤200ms**; comment notes cinematic one-shots (iris ~0.42s, VT ~180ms, flicker ~0.48s) stay explicit exceptions.
- **Framer (dialogs / sheets / onboarding):** enter/exit tweens **0.2s** (was 0.22–0.3s) in `command-palette.tsx`, `review-composer.tsx`; `onboarding-flow.tsx` uses shared **`stepTransition`** + **`useReducedMotion`** (instant when OS requests reduced motion).
- **`app-nav.tsx`:** `useReducedMotion` — disables bar `whileHover` nudge + uses **≤180ms** tweens for the active pip (`layoutId`) instead of springs that could overshoot the budget.
- **`landing-poster-rail.tsx`:** `useReducedMotion` skips stagger and mount tween; otherwise **0.2s** motion, capped stagger delay **0.1s** max; row **`key`** from poster ids (not array index).
- **`ticket-stub.tsx`:** poster filter hover **duration-200** (was 300ms).

**Verify (Executor):** `cd apps/web && bun run build` → **0**.

**Verify (human)**
- Toggle OS “reduce motion”: nav pip + landing poster rail should feel instant or nearly so; hovers on buttons/cards still acceptable.
- Normal motion: UI color/transform transitions feel snappy, not sluggish.

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Human: B.5.8 signed off

User replied **ok** — Track B **B.5.8** (notifications: calendar grouping, `title`/`body`, per-row read + `payload.href` enrichment) treated as **Planner/human verified**. Next Executor milestone when user sends **go**: **B.6 Motion budget** (≤200ms interactions; reduced-motion clean) per Planner.

### 2026-05-14 — Track B.5.8: Notifications *(human verified 2026-05-14)*

**Shipped**
- **Server `GET /api/notifications`:** `withNavigationHints()` merges `payload.href` when absent — follow rows resolve `fromUserId` → `profile.handle` → `/profile/:handle`; chat → `/chat`; badge/achievement → `/achievements`.
- **Inserts:** follow notification includes `href` when the follower has a handle; chat/badge/achievement payloads include `href` for new rows.
- **Web:** `NotificationsList` groups by **local calendar day** (Today / Yesterday / older); shows **`title`** + optional **`body`**; icons by `kind` prefix; **Mark all read** unchanged; **per-row read** via `POST /api/notifications/:id/read` (`postNotificationRead` in `still-api-fetch`) on primary row button + **Open** link; optimistic UI with rollback on failure.
- **Verify (Executor):** `apps/server` `bun run check-types` → **0**; `apps/web` `bun run build` → **0**.

**Verify (human)**
- `/notifications`: sections + unread highlight; tap row text or Open marks read (stays grouped under same day); Mark all read clears highlights.
- Follow / chat / badge notifications show sensible Open targets (profile, chat, achievements).

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Human: B.5.7 signed off

User replied **ok** — Track B **B.5.7** (centered profile hero, `?tab=` section nav, semantic filmography table) treated as **Planner/human verified**. *(Next milestone after subsequent **go**: **B.5.8 Notifications** — now **human verified 2026-05-14**.)*

### 2026-05-14 — Human: B.5.6 signed off

User replied **ok** — Track B **B.5.6** (lists index Savee-style rows + `coverPosterPaths` API) treated as **Planner/human verified**. **B.5.7 Profile** followed in the next **go** and is now **human verified** as well.

### 2026-05-14 — Track B.5.6: Lists index (Savee rows) *(human verified 2026-05-14)*

**Shipped**
- **Server:** `withCoverPosterPaths()` batches `movie.poster_path` for all `cover_movie_ids` on each list row; applied to `GET /api/lists`, `/popular`, `/me`, `/by-user/:userId`, plus `POST /` and `PATCH /:id` responses; profile `GET /:handle` list payload uses the same helper (`list-cover-posters.ts`).
- **Web:** `ListRowStrip` + `toListBoardRow`; `/lists` “Your lists” + “Popular this week” as full-width bordered list; profile Lists rail matches; removed **`list-card.tsx`** (incorrect `…/w185/{tmdbId}.jpg` poster URLs).

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Track B.5.7: Profile layout *(human verified 2026-05-14)*

**Shipped**
- **`/profile/[handle]`:** Centered hero under banner — **avatar** (image or initials) overlaps band, @handle, display name, pronouns, bio, **`<dl>`** stats (followers / following) + location / website, centered actions (Customize / Edit or **Follow**).
- **Section nav:** `?tab=filmography|reviews|lists|favorites` — **filmography** always listed; other tabs only when that rail has rows; order follows **`sectionOrder`**; active link uses **`aria-current="page"`** + bottom border; bar scrolls horizontally on narrow viewports; entire nav omitted when only filmography applies.
- **Panels:** one primary block per tab — **semantic `<table>`** filmography (replaces prior `div role="table"`); empty-ledger CTA; favorites **responsive grid**; reviews **2-col** `ReviewCard` list; lists reuse **`ListRowStrip`**.
- Removed the nested **“Also credited for”** mega-`Section` wrapper.

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Human: B.5.4 + B.5.5 signed off

User replied **ok** — Track B **B.5.4** (quick log sheet) and **B.5.5** (diary Tickets / Stills layout + month ordering) treated as **Planner/human verified**. Next Executor milestone when user sends **go** was **B.5.6 Lists** (Savee-style row + poster strip) — now delivered; next **go**: **B.5.7 Profile** per Planner.

### 2026-05-14 — Track B.5.5: Diary layout *(human verified 2026-05-14)*

**Shipped**
- **`/diary`:** Server builds **month sections** (with **Undated** fallback for bad timestamps); **newest month first**; logs inside each month **newest first**; drops rows with no `movie` join (cannot render).
- **`DiaryPageClient`:** Toolbar **Tickets** (existing `DiaryEntry` grid) vs **Stills** (CSS `columns-*` masonry + `DiaryStillTile` poster cells, half-star overlay when rated); choice persisted in **`localStorage`** `still.diary.layout`.
- **A11y:** Toolbar `role="toolbar"` + `aria-label`; layout buttons `aria-pressed`; still links expose composite `aria-label` (title · watched date).

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Track B.5.4: Quick log sheet *(human verified 2026-05-14)*

**Shipped**
- **`quick-log-sheet.tsx`** — Zustand `useQuickLog` + `QuickLogRoot`: mobile bottom sheet / desktop centered dialog (Framer Motion **≤200ms**), Escape + backdrop close, `role="dialog"` + labelled title.
- **Flow:** Film (pre-filled from movie page, or TMDb search when `open()` with no `movieId`) → **date** (`type="date"`, default today, noon local → ISO for `watchedAt`) → optional **rating** (`StarRating`) → optional **note** (500 cap) → **Save log** disabled until `movieId` + valid date + note length OK.
- **`AppShell`** mounts `<QuickLogRoot />` next to review composer.
- **`MovieActions`:** **Log** opens the sheet (sound + diary refetch on success via `onSuccess`); heart-without-log still one-tap `postLog` + like.

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Human: B.3 signed off

User replied **ok** — Track B **B.3** (`AppShell` + bottom nav contract) treated as **Planner/human verified**.

### 2026-05-14 — Track B.5.3: Film detail *(human verified 2026-05-15)*

**Shipped**
- **`GET /api/movies/:id/lists`** — public `list` rows joined via `list_item` for this `movieId`, ordered by likes (max 24).
- **`MovieDetailExploreTabs`** (`components/movie/movie-detail-explore-tabs.tsx`) — client tablist (Reviews / Lists / Related) with keyboard arrows, Home/End; Reviews consolidates featured + grid; Lists empty state + create-list link; Related = TMDb rail + `DoubleFeatureSuggestion` or empty copy.
- **`/movies/[id]/page.tsx`** — fetches lists; removes duplicate hero `MovieActions`; **sticky** action dock under hero (`bottom-[max(6rem,…)]` to clear `AppShell` bottom nav); Reception section unchanged above tabs.

**Verify (human)**
- Sticky bar clears bottom nav on narrow + iOS safe-area; log/watchlist/like still work once.
- Tab panels + empty states; lists tab populates when a public list includes the film.
- `bun run build` (`apps/web`) and `bun run check-types` (`apps/server`) → **0** (Executor).

**Human verify:** ok 2026-05-15.

### 2026-05-14 — Track B.5.2: Discover *(human verified 2026-05-15)*

**Shipped**
- **API** (`apps/server`): `tmdbApi.discoverMovies` + `genreMovieList`; `GET /api/movies/discover?page&genre&sort` (whitelist `sort_by`, `vote_count.gte` for vote-average sorts); `GET /api/movies/genres` — routes registered **before** `/:id`.
- **Web** (`still-api-fetch`): `fetchMoviesDiscover`, `fetchMovieGenres`.
- **Route** `apps/web/src/app/(app)/movies/discover/page.tsx`: `searchParams` genre + sort; `MovieDiscoverToolbar` (horizontal genre rail + sort chips, shareable URLs via `discover-catalog-url.ts`); `DiscoverCatalogEmpty` when `total_results === 0`; `PopularMoviesInfinite` supports `catalogKind="discover"` + `key` reset on filter change.
- **`MovieCatalogSurfaceChips`:** third chip **Discover**; home empty-feed **Or just explore** → `/movies/discover`.

**Verify (human)**
- `/movies/discover`, chip genre + sort, pagination, empty edge (e.g. impossible combo if any), TMDB-unconfigured hint.
- `cd apps/web && bun run build` → **0**; `apps/server` `bun run check-types` → **0** (Executor).

**Human verify:** ok 2026-05-15.

### 2026-05-15 — Human: B.5.2 / B.5.3 / B.5.9 signed off

User replied **ok** — Track **B.5.2** (Discover), **B.5.3** (film detail explore tabs + sticky dock), and **B.5.9** (settings account sub-nav) treated as **Planner / human verified** **2026-05-15**. **B.5** status board row marked **complete** for shipped milestones.

### 2026-05-14 — Human: B.5.1 signed off

User replied **ok** — Track B **B.5.1** (home lobby feed anatomy + collapsible friend-activity rail) treated as **Planner/human verified**. *(**B.5.2–B.5.9** closed out with user **ok** **2026-05-15** — see **Human: B.5.2 / B.5.3 / B.5.9 signed off**.)*

### 2026-05-16 — Human: B.1 / B.2 signed off

User replied **ok** — Track **B.1** (route audit + in-repo principles) and **B.2** (token & elevation ladder) treated as **Planner / human verified** **2026-05-16**. Project Status Board rows **B.1** and **B.2** updated.

### 2026-05-14 — Track B.5.1: Home / following *(human verified 2026-05-14)*

**Shipped**
- **Feed cards** (`components/feed/activity-item.tsx`): `FeedPersonAvatar` + byline + film line + rating/meta + **poster thumb on the right** (`MoviePoster` `xs`) + **44px icon action** (film / read review / list). `article` + `focus-within` ring; **removed invalid nested `<Link>`** on review + list rows (whole-card link wrapped profile link before).
- **`feed-person-avatar.tsx`**: profile disc with initials fallback, 44px tap target, ring on focus/hover.
- **Friend activity rail** (`lg+`): `deriveFriendRailEntries` in `lib/home-friend-rail.ts`; `HomeFriendActivityRail` client aside — collapse persists in `localStorage` (`still.home.friendRail.collapsed`); empty copy when no follows data.
- **`home/page.tsx`**: flex row layout for lobby section + rail; **stable list keys** via `activityRowKey` (payload ids, not array index).

**Verify**
- `/home` ≥`lg`: friend rail visible, collapse/expand, list scrolls if many friends; `<lg` rail hidden, feed full width.
- Log / review / list rows: no nested-link warnings in a11y tree; poster + icon actions reachable by keyboard.
- `cd apps/web && bun run build` → exit **0** (Executor verified).

### 2026-05-14 — Human: B.4 signed off

User replied **ok** — Track B **B.4** (search pill, filter chips, `/movies/upcoming`, home lobby links) treated as **Planner/human verified**. *(**B.5** milestones closed **2026-05-15** — **Human: B.5.2 / B.5.3 / B.5.9 signed off**; **B.1 / B.2** closed **2026-05-16** — **Human: B.1 / B.2 signed off**.)*

### 2026-05-14 — B.4 complete: search + browse primitives *(human verified 2026-05-14)*

**Shipped**
- `components/ui/search-pill-field.tsx` — pill search (icon, optional scope, clear controls).
- `components/ui/filter-chip-row.tsx` — `FilterChipRow` (`role="toolbar"`), `FilterChipLink`, `FilterChipButton`.
- `SearchClient`: pill field + static **Films** scope + dismissible **Query · “…”** chip row; `showClearQuery={false}` to avoid duplicate clears.
- `MovieCatalogSurfaceChips` + route **`/movies/upcoming`** (mirrors popular seed + infinite); `fetchMoviesUpcoming`; `PopularMoviesInfinite` gains `catalogKind` + correct footer catalogue label.
- `movies/popular` + `movies/upcoming` render shared chips; search page `Suspense` fallback uses pill-shaped skeleton bar.
- **Home** “Popular this week” header links: **Opening soon** → `/movies/upcoming`, **See all** → `/movies/popular`.

**Deferred:** advanced filter drawer (genre/year/service) — needs API or client filter spec.

**Verify:** `cd apps/web && bun run build` → exit **0**.

### 2026-05-14 — Planner: Track B (design system) added

**Context:** User requested a **full design system redo** for usability and
delight (Mobbin web patterns: rails, pills, chips, library toolbars, profile
layouts). This is **Track B** in `High-level Task Breakdown` and `Project Status
Board`. It **does not** cancel Phases 1–7 (largely done) or Phase 8 manual QA.

**Resolution (human “go”, 2026-05-14):** proceed with **B.1** before Phase 8
manual QA; items **8.1 / 8.3 / 8.4** stay on the board as parallel ship debt.

### 2026-05-14 — B.3 complete: `AppShell` + nav contract *(human verified 2026-05-14)*

**Shipped**
- `apps/web/src/components/app/app-shell.tsx`: single server component for
  projector boot, grain, `AppNav`, `main#main-content` (bottom padding for
  floating bar), `CinemaSceneCut`, gutter wrapper, command palette, review
  composer, badge watcher. Docblock = Mobbin-style **bottom bar** MVP (no
  sidebar rail).
- `apps/web/src/app/(app)/layout.tsx`: auth + profile redirects only; renders
  `<AppShell user={…}>{children}</AppShell>`.
- `APP_SHELL_BOTTOM_RESERVE_CSS` + `appShellMainContentMinHeightStyle` exported
  for pages that need viewport math in sync with `main` padding; `people/[id]`
  imports shared style (removed local duplicate).

**Verify**
- `cd apps/web && bun run build` → exit **0**.

### 2026-05-14 — B.2 complete: token & elevation ladder *(human verified 2026-05-16)*

**Shipped**
- `packages/ui/src/styles/globals.css`: formal ladder `--surface-canvas` →
  `--surface-raised` (was `surface-card-base` / deep graphite) →
  `--surface-overlay` (`#121212` between card and `muted`); `--background` /
  `--card` / `--popover` map to those; header + cinema tuning comments updated;
  `.movie-themed` note (don’t replace panel fills with accent floods).
- `@theme inline`: `--color-surface-canvas`, `--color-surface-raised`,
  `--color-surface-overlay` for Tailwind `bg-surface-*`.
- **Components using explicit `bg-surface-*`:** `AppNav` (raised), `ActivityItem`
  (raised), `CommandPalette` (overlay), `home` `EmptyFeed` + `diary` empty
  dashed panels (raised/40).
- `(app)/layout.tsx`: one-line comment that horizontal gutters are owned there.
- `user-menu.tsx`: remove `className="bg-card"` on `DropdownMenuContent` so
  default `bg-popover` (overlay tier) applies.

**Verify**
- `cd apps/web && bun run build` → exit **0** (Next 16.2.6).

**Note:** First build after route work hit bogus `RouteImpl` errors for real
paths; **`rm -rf apps/web/.next` + rebuild** cleared them — documented in
`Lessons`.

**Human verify:** ok 2026-05-16.

### 2026-05-14 — B.1 complete: route audit + principles *(human verified 2026-05-16)*

**Scope:** `apps/web/src/app` routes + shared `(app)` chrome (`layout.tsx`,
`AppNav`). No code changes for B.1 — audit only.

**App shell (shared):** `(app)/layout.tsx` → `main` + full-width horizontal
padding (`px-4` … `2xl:px-16`), bottom padding for **fixed bottom nav**
(`AppNav`: pill bar, `role="navigation"` `aria-label="Main"`, `BrandMark` on
`sm+`, ⌘K search, overflow menu, **notifications bell** in the bar on **all** breakpoints *(Track B nav parity fix 2026-05-14 — was `hidden sm:block`)*). `CommandPaletteRoot`,
`ReviewComposerRoot`, `BadgeWatcher`, grain + `CinemaSceneCut` + `ProjectorBoot`.

**Route inventory**

| Route | Layout / pattern | Density & chrome | CTAs / nav / a11y notes |
|-------|-------------------|------------------|-------------------------|
| `/` (`page.tsx`) | Marketing: theater floor, hero `Letterbox`, anchor nav (`md+`) | High atmosphere | Signed-in users redirect to `/home`. |
| `/onboarding` | Centered `max-w-2xl` column, no `AppNav` | Medium | OK for focused funnel. |
| `(auth)/sign-in`, `sign-up` | Auth layout | Medium | `Suspense` for searchParams consumers (Phase 8). |
| `/home` | Stacked `Section`s: feed, popular grid, upcoming, news/tickets | Medium–high | Secondary “Your diary” duplicates global Diary nav — acceptable nudge. |
| `/diary` | `Section` + per-month `cinema-film-strip-rail--coded` + ticket grid | High (tickets) | Strong empty state → `/search` + *Log*. |
| `/watchlist` | Ticket stack (Phase 6) | High | Coherent with diary metaphor. |
| `/news` | Single `Section` + `NewsStrip` | Low–medium | — |
| `/chat` | Full-bleed `ChatPane` (threads + messages) | High | Primary nav item — good. |
| `/movies/[id]` | Full-bleed hero (flush top), dense metadata + actions | High | Known hero hit-testing constraints (Executor log 2026-05-13). |
| `/movies/popular` | Poster/browse grid | Medium | “Discover” split from home. |
| `/search` | `SearchClient` + skeleton `Suspense` | Medium | Palette + `/search` should share primitives in **B.4**. |
| `/lists`, `/lists/new`, `/lists/[id]` | `Section` + cards / form / detail | Medium | “Lists” in overflow menu + direct URL — discoverability OK for v1. |
| `/reviews/[id]` | Long-form review + credits (Phase 5) | Medium | — |
| `/profile/[handle]` | Banner `Letterbox`, filmography ledger, `Section`s | High | Rich; watch tab order on narrow widths in **B.5**. |
| `/people/[id]` | Person detail, `Section`, filmography-style lists | Medium | Custom `minHeight` to align with floating nav — pattern to centralize in **B.3**. |
| `/notifications` | `Section` + list | Low | **Bell in `AppNav` on all breakpoints** (2026-05-14); avatar menu “Notifications” kept as secondary path. |
| `/me/settings`, `/me/customization` | Shared **`me/layout`**: `MeAccountNav` (vertical `md+`, tab strip mobile) + `max-w-2xl` form column | Medium | **B.5.9** sub-nav — **human verified 2026-05-15**. |
| `/achievements` | Standard page (from overflow) | Medium | — |

**Non-negotiable principles (Track B)** — align implementation in B.2–B.6:

1. **Two visual layers:** *Cinema* (grain, letterbox, film strip, vignette, scene cuts) on shells and heroes; *Utility* (lists, forms, filters) stays calm: predictable spacing, minimal animation, no decorative pointer blocking.
2. **One global accent role:** keep primary CTA / active nav pip on the existing accent token; per-film `.movie-themed` tints chrome but **does not** splinter button semantics (already Phase 2 policy — extend to Track B components).
3. **Typography roles:** `font-display` for page `h1` / major section titles; UI sans for dense labels, scores, and card titles (current direction — formalize in code reviews).
4. **Navigation parity:** every destination reachable on **mobile** without `sm-only` dead ends; if an icon is `hidden sm:block`, provide an equivalent in the always-visible cluster or overflow (**notifications bell** addressed in **`AppNav`** 2026-05-14).
5. **Page gutter contract:** outer horizontal padding comes from `(app)` layout; inner components avoid re-introducing conflicting `mx-auto px-*` unless intentionally breaking full-bleed (document exceptions in **B.2**).
6. **Touch targets:** maintain **≥44px** vertical hit areas on primary nav and global actions (`AppNav` links already `min-h-11` — don’t regress).
7. **Motion budget:** interaction feedback **≤200ms** for hovers/focus; route transitions may stay cinematic; **no** gratuitous list stagger; honor `prefers-reduced-motion` (Phase 8 baseline).

**Mobbin MCP:** use `"image_format": "jpg"` for `search_screens` if the agent environment rejects WebP.

**Human verify:** ok 2026-05-16.

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

- **Track B.6 motion budget:** `--aker-duration` / `--aker-duration-slow` in `packages/ui/src/styles/globals.css` are **0.2s** max for tokenized UI transitions; hero iris, projector flicker, and view-transition durations stay **explicit longer values** where cinematic. Framer **`useReducedMotion`** should gate decorative stagger (e.g. marketing poster rail) and snap onboarding step transitions when the OS requests reduced motion.
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
- **Mobbin MCP** (`search_screens`): some environments fail WebP decode — use
  `"image_format": "jpg"` for reliable screen pulls when researching patterns.
- **Next.js `RouteImpl` / Link href errors after route changes:** if `next build`
  fails TypeScript on valid paths (e.g. `/search`, `/sign-in`) with
  `typedRoutes: false`, delete **`apps/web/.next`** and rebuild — stale generated
  types can linger and contradict the live `app/` tree.
- **Turbo `extension#build`:** WXT writes artifacts under **`apps/extension/.output/`**, not **`dist/`**. Root **`turbo.json`** **`build.outputs`** must include **`".output/**"`** (or a package rule) or Turbo warns and skips caching that task’s outputs.
- **WXT ≥0.20:** top-level **`runner`** in **`wxt.config.ts`** is deprecated — use **`webExt`** (same shape, e.g. **`disabled: true`** to skip auto-launching Chrome during dev/build tooling).
- **tsdown ≥0.21:** top-level **`noExternal`** is deprecated — use **`deps.alwaysBundle`** (same patterns) to force bundling workspace packages like **`@still/*`**. For a **fat server bundle** that inlines many **`node_modules`** deps, **`deps.onlyBundle: false`** silences whitelist-audit noise (see **`apps/server/tsdown.config.ts`**).
- **Phase 8.1 (cross-browser smoke):** repeatable route matrix + pass criteria live in **`.cursor/scratchpad.md`** under **`### Phase 8.1 prep — Cross-browser smoke checklist`** — run it before ticking **8.1** on the Project Status Board.
- **Phase 8.3 (Lighthouse mobile):** prep + default relative pass gates under **`### Phase 8.3 prep — Lighthouse mobile perf`** — log scores against the **same** build mode as the last tagged baseline.
- **Phase 8.4 (per-film contrast):** prep under **`### Phase 8.4 prep — Per-film palette contrast`** — sample **three** **`/movies/[id]`** extremes before ticking **8.4**.
- **Catalogue billboard Lobby link:** **`popular` / `upcoming` / `discover`** header **`← Lobby`** uses **`aria-label="Back to home lobby"`** plus **`[@media(hover:hover)]:hover:text-foreground`** so touch avoids stuck-hover tint and screen readers get a clear target name.

### 2026-05-27 — TV on lists (Planner)

**Approved:** `docs/superpowers/specs/2026-05-27-tv-on-lists-design.md` — Approach A, full parity, split picker meta (`0 titles` empty, `N films · M shows` mixed).

**Plan:** `docs/superpowers/plans/2026-05-27-tv-on-lists.md` (11 tasks: migration → aggregates → API → meta line → shared picker → TV hero → radial → QA).

**Project Status Board:**
- [x] TL.1 DB migration (`cover_tv_ids`, `movie_items_count`, `tv_items_count`) — migration `0008` applied
- [x] TL.2 `refreshListAggregates` + cover poster order
- [x] TL.3 Lists API POST/DELETE/me TV
- [x] TL.4 Web `AddToListMedia` + meta line + radial + TV hero
- [x] TL.5 Build + manual QA — human **`ok`** (2026-05-27)

**Shipped (2026-05-27):** TV on lists — migration `0008`, lists API `tvId`, split picker meta (`0 titles` / `N films · M shows`), `AddToListMedia` on TV detail + catalogue radial. Spec: `docs/superpowers/specs/2026-05-27-tv-on-lists-design.md`.

### 2026-05-27 — TV diary rewatch scope (Executor)

**Approved:** `docs/superpowers/specs/2026-05-27-tv-log-rewatch-scope-design.md` — Approach A (scoped prior counts + auto season diary on mark complete).

**Project Status Board:**
- [x] TR.1 `tv-log-scope-prior.ts` + unit tests
- [x] TR.2 `use-tv-detail-user-state` scoped `priorLogCount` / `priorTvLogs` / `handleEditLog`
- [x] TR.3 `quick-log-sheet` scope-aware rewatch + form scope payload on POST
- [x] TR.4 `tv-detail-primary-actions` show-scoped hero badge
- [x] TR.5 `tv-detail-progress-panel` per-season counts, auto `postLog`, Edit diary
- [x] TR.6 `catalogue-poster-tile` TV show-scoped prior count
- [x] TR.7 `apps/web` build + unit tests pass
- [ ] TR.8 Human manual QA — reply **`ok`** when verified

**Executor's Feedback or Assistance Requests:** Please verify on a TV detail page: (1) log S1 → Quick Log S2 → Rewatch **off**; (2) log S1 again → Rewatch **on**; (3) hero badge counts **show** logs only; (4) mark season complete creates diary row without “Log to diary” toast CTA; (5) complete season with existing log shows **Edit diary**.

**Shipped (code, pending QA):** `apps/web/src/lib/tv-log-scope-prior.ts`, `my-tv-log.ts`, updates to quick log, TV detail hero/progress, catalogue radial TV quick log.
