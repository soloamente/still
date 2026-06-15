# Sense — Letterboxd Pillars Roadmap Design

**Status:** Approved — implementation plan ready (2026-06-13)  
**Date:** 2026-06-13  
**Parent:** [2026-05-29-sense-product-roadmap-design.md](./2026-05-29-sense-product-roadmap-design.md)  
**Approach:** **B — Parallel workstreams** with dependency waves (all twelve pillars active; sequencing within tracks)  
**Horizon:** Immediate — all pillars in flight concurrently, not deferred to post-launch tiers

## Summary

This spec maps the twelve **Letterboxd obsessive-usage pillars** to Sense's existing product and defines what to **build next** to close retention gaps. Sense already ships a Letterboxd-class diary + social layer (movies, TV, Community, taste signature, pinned reviews, activity heatmap, taste-matched rail, public SEO lists, voice reviews). The largest gaps are **visible taste curation at profile top**, **in-app Journal**, **Year in Review / Wrapped**, **Members directory**, and **streaming availability alerts**.

**North star (unchanged):** *Someone looks at their profile and thinks: this is actually me — and returns after every watch to maintain it.*

**Letterboxd equation adapted for Sense:**

> Self-expression + social validation + genuine utility + aesthetic pleasure + cultural credibility = daily habit

Sense remains a **taste-as-identity platform** (not “a better Letterboxd”) while adopting Letterboxd’s emotional mechanics.

## Brainstorm decisions (locked)

| Topic | Decision |
|-------|----------|
| Scope | Full roadmap across all 12 pillars |
| Horizon | All pillars active now (parallel tracks) |
| Identity showcase | **Pinned-mix** — up to 4 slots: film, TV, or pinned review (Sense-native, not films-only) |
| Detail community stats | **Compact summary** — average + count; **no ratings histogram** |
| Journal | **Full in-app Journal** (`/journal`, staff-authored MVP) |
| Personal stats | **Full Year in Review / Wrapped** (shareable OG card) |
| Members discovery | **Full Members directory** (patron leaderboards by contribution) |
| Watchlist | **Streaming availability alerts** (in-app all patrons; email Pro-only) |

## Pillar inventory — shipped vs gap

| # | Pillar | Sense today | Gap | Track |
|---|--------|-------------|-----|-------|
| 1 | Identity through taste | Taste signature, pinned reviews (3), activity heatmap, compare taste, OG taste cards, diary metal tiers | **High** — no profile **showcase strip**; `favoriteMovieIds` onboarding-only | Identity |
| 2 | Diary as ritual | Quick log, venue, rewatch, diary lobby, streaks, voice reviews | **Low** — post-watch micro-moment | Ritual |
| 3 | Wit as currency | Engagement-ranked reviews, likes/dislikes, voice reviews | **Medium** — viral one-liner surfacing | Social |
| 4 | Lists as expression | Public SEO lists, ranked Favorites, curator spotlights, list quality | **Low** — minor discovery polish | Social |
| 5 | Peer-driven discovery | Activity feed, divergence rows, taste rail, following ratings | **Low** — copy + cold-start polish | Social |
| 6 | Film page completeness | Rich detail, community average + count, reviews carousel, streaming | **Low** — add watch/watchlist social proof counts | Ritual |
| 7 | Browse filters | Home lobbies, ⌘K search, tags, venue/run chips | **Low** — catalogue stat line | Platform |
| 8 | Journal / cultural voice | `/changelog`, editorial cold-start | **High** — no in-app Journal | Platform |
| 9 | Gamification / self-knowledge | Achievements, streaks, activity signature | **High** — no Wrapped | Identity |
| 10 | Cinematic design | Dark UI, poster-first, Mobbin clarity | **Ongoing** — motion polish pass | Cross-cutting |
| 11 | Members as discovery | People search, Film/TV title ranks | **High** — no patron directory | Social |
| 12 | Watchlist + alerts | Watchlist lobby | **High** — no streaming notifications | Platform |

## Architecture — four parallel tracks

```text
Track Identity     Showcase strip → profile hierarchy → Year in Review
Track Social       Viral reviews rail → Members directory → list discovery polish
Track Platform     Journal MVP → streaming alerts → catalogue stat line
Track Ritual       Post-log micro-moment → detail social proof counts
Cross-cutting      Motion polish (transitions-dev + make-interfaces-feel-better)
```

Tracks share **Wave 0** prerequisites before feature work begins.

### Wave 0 — Shared prerequisites

| Deliverable | Purpose |
|-------------|---------|
| Migration `profile.showcase_items` jsonb | Identity showcase data model |
| `product_event` instrumentation | `showcase_edit`, `post_log_celebrate`, `viral_review_tap`, `journal_read`, `wrapped_view`, `wrapped_share`, `members_follow`, `streaming_alert_sent` |
| OG infra audit | Confirm Satori patterns support Wrapped + Journal OG |

**Exit:** migration journaled; events flowing in dev; no P0 blockers on profile page perf (paginate filmography before stacking heavy hero widgets — existing constraint).

---

## Pillar 1 — Identity through taste (Profile Showcase Strip)

### Problem

`profile.favoriteMovieIds` is collected at onboarding and exported in data settings, but **never shown on the profile hero**. The profile Favorites tab uses diary hearts (`log.liked`) — a different concept. Visitors cannot read patron identity at a glance.

### Design — pinned-mix showcase

**Placement:** Directly under `ProfileTasteSignature`, above the stats row in `ProfilePatronHeader`.

**Slots:** Up to **4** patron-curated identity items, ordered by patron. Each slot is exactly one of:

| Kind | Display | Tap action |
|------|---------|------------|
| `movie` | Poster | Movie detail |
| `tv` | Poster | TV detail |
| `review` | Poster + headline excerpt (1 line) | Review reader |

**Rules:**

- Owner sees empty slots as **“Add to showcase”** affordances; visitors see filled slots only.
- Showcase items are **independent** from diary hearts — no forced sync with `log.liked`.
- TV parity: showcase is not films-only.
- Max 4 enforced server-side on `PATCH /api/profiles/me/showcase`.
- Duplicate kinds/ids rejected (same film twice, etc.).

**Data model:**

```typescript
// profile.showcase_items jsonb — max 4
type ShowcaseItem =
  | { kind: "movie"; id: number }   // tmdbId
  | { kind: "tv"; id: number }     // tmdbId
  | { kind: "review"; id: string }; // review uuid
```

**Migration:** On read, map legacy `favoriteMovieIds` → first N `{ kind: "movie", id }` slots when `showcase_items` is empty. Do not delete `favoriteMovieIds` until export/import paths are updated.

**Edit surfaces:**

- Own profile: inline **Edit showcase** on hero (opens sheet with slot picker — search films/TV/reviews).
- Settings → Profile: same editor.
- Review reader: **Add to showcase** when owner and slot available.

**UI:**

- Horizontal poster row, `rounded-2xl` tiles, `outline` image depth (black/white 10% per design tokens).
- Section label: **“On my mind”** or **“Showcase”** (final copy at implementation).
- Staggered enter on edit save; `active:scale-[0.96]` on tiles.
- `prefers-reduced-motion`: no stagger.

### Success criteria

- Patron with showcase fills ≥1 slot; visible on own + visitor public profiles.
- Legacy `favoriteMovieIds` patrons see films migrated on first profile load.
- Private profile: showcase hidden to non-owner (same gate as filmography).

### Out of scope (Pillar 1 v1)

- Auto-suggested showcase from taste signature.
- Animated poster crossfades.

---

## Pillar 2 — Diary as ritual

### Problem

Logging is fast and functional; the **post-watch Pavlovian moment** (return immediately after a film to record) is under-emphasized.

### Design — post-log micro-moment

After successful Quick Log or diary save (new log, not edit-only):

1. **Inline celebration strip** below the form (not a blocking modal).
2. Rating display uses **number pop-in** (`transitions-dev` digit animation) on the saved score.
3. Optional **one-line note** field (pre-focused, 280 char max) — saves as review `body` draft or log note if schema supports; else CTA only.
4. Secondary **“Write a review”** pill → review composer with inherited rating.
5. Dismiss on navigate away; no second confirmation step.

**Diary lobby polish:**

- Year / decade summary chips at top of diary filter row (filter in place; reuse diary query params).
- Preserve chronological table satisfaction — no layout overhaul.

### Success criteria

- `product_event: post_log_celebrate` fires on strip show.
- ↑ same-session review compose rate within 7d cohort test.
- Reduced-motion: strip appears without digit animation.

---

## Pillar 3 — Wit as currency

### Problem

`reviewEngagementOrderSql` ranks reviews by likes×2 + comments×3, but **viral one-liners** are not prominently surfaced outside Community Reviews tab.

### Design

| Surface | Behavior |
|---------|----------|
| Community Reviews | Add **“Most liked”** sort chip (week · month · all time) alongside existing period toolbar |
| `HomeViralReviewsRail` | New row on `browse=community` or home when signed in — top 6 reviews where `body.length ≤ 280` OR title-only; show like count prominently |
| Review cards in feed | 2-line body clamp; full wit in reader |
| Notifications | Keep high-signal defaults — no like-chime spam (existing roadmap 1.8) |

**API:** `GET /api/reviews/viral?period=&limit=6` — engagement order + body length filter.

### Success criteria

- Viral rail non-empty in dev with seeded likes.
- Tap → review reader without full-page freeze.
- Period chip changes rail contents.

---

## Pillar 4 — Lists as creative expression

**Mostly shipped.** Incremental additions:

- Community **“Popular lists”** emphasis when `feed=lists` (already likes-ordered; add count in subsection header).
- List detail: title typography bump (`text-balance`, semibold at hero scale).
- Share toast includes list title on copy.

No new schema.

---

## Pillar 5 — Peer-driven discovery

**Mostly shipped.** Principle codification:

- All discovery labels name the source: **“From people you follow”**, **“Popular this week among patrons”**, **“Because you gravitate toward …”** — never “Recommended for you” without explanation.
- Zero-follow patrons: `GET /api/feed/discover` editorial mix (existing).
- Film detail following-ratings rail: keep **+N more** drawer (existing).

No new routes in v1.

---

## Pillar 6 — Film page (compact community summary)

**Per brainstorm decision: no ratings histogram.**

### Additions

- Next to community average + count: **public watches count** and **watchlist count** (aggregates from public logs + watchlist rows).
- Labels: **Community score** / **public ratings** (no product brand prefix — existing rule).
- Voice review player in carousel (shipped).

### Success criteria

- Counts hidden when below privacy threshold (e.g. &lt;3 patrons).
- TV detail parity with movie detail community block.

---

## Pillar 7 — Browse and discovery filters

**Shipped.** One addition:

- Movies/TV lobby header stat: **“{N} films · {M} shows in Sense”** — TMDB-backed cached counts, revalidated daily.

**Defer:** Shuffle sort.

---

## Pillar 8 — Journal (in-app cultural voice)

### Problem

Sense has `/changelog` (release notes) and editorial cold-start rows, but no **Letterboxd-class Journal** positioning Sense as a cultural authority.

### Design — Journal MVP

| Piece | Spec |
|-------|------|
| Route | **`/journal`** — public, indexable (outside `(app)` auth wall) |
| Article route | **`/journal/[slug]`** — MDX or rich HTML body |
| Data | `journal_post` table: `id`, `slug`, `title`, `dek`, `body`, `hero_image_url`, `author_user_id`, `status` (draft/published), `published_at`, `tags[]`, `created_at`, `updated_at` |
| Authoring | **Staff panel** tab — draft · preview · publish (reuse `staff` permissions) |
| Discovery | Home + Community: **“From the Journal”** rail (latest 3 published) |
| Nav | **Journal** in primary nav (desktop rail; mobile discover row) |
| SEO | `generateMetadata`, `robots: index` on published posts; sitemap entry |
| OG | `/og/journal/[slug]` — hero image + title + Sense mark |

**Launch content:** Minimum **4 seed articles** published before announcing Journal (staff-authored; no empty launch).

### Success criteria

- Incognito: `/journal` returns 200 with article list; article pages indexable.
- Staff draft → publish → appears on rail within revalidate window.
- `product_event: journal_read` on article view.

### Out of scope (Journal v1)

- Patron-submitted articles.
- Comments on articles.
- Podcast / embed blocks.
- Full CMS media library (hero URL field sufficient for v1).

---

## Pillar 9 — Year in Review / Wrapped

### Design

**Compute job:** `computeYearInReview(userId, year)` — inputs from diary logs + reviews:

| Stat | Output |
|------|--------|
| Total logs | Count |
| Average rating | 0–10 display |
| Top genres | Top 3 by log count |
| Top decade | By release year |
| Busiest month | By `watchedAt` |
| Top 5 films / TV | By rating then recency |
| Longest streak in year | From `user_streak` history |
| Review count | Published in year |

**Surfaces:**

- **`/me/year/[year]`** — own profile year view (signed in).
- **Achievements** tab card: **“Your {year} in film”** (December prompt + year-round access).
- **Share:** `GET /og/year/[handle]/[year]` — Satori Wrapped-style card (avatar, handle, headline stats, 2–3 top posters).
- Copy link + download image affordances on year page.

**Privacy:** Private profile → OG falls back to `/og/default`; year page 404 for visitors.

**Schedule:** Nightly recompute for active patrons in December; on-demand for prior years.

### Success criteria

- Patron with ≥5 logs in year sees non-empty Wrapped.
- Share OG renders in &lt;3s cold.
- `product_event: wrapped_share` on copy/download.

### Out of scope (Wrapped v1)

- LLM-generated personality copy.
- TV-only or film-only split cards (combined v1).

---

## Pillar 10 — Cinematic design + motion polish

Cross-cutting pass applying `make-interfaces-feel-better` and `transitions-dev`:

| Surface | Transition |
|---------|------------|
| Showcase strip edit | Avatar group hover on poster row |
| Post-log rating | Number pop-in |
| Review like toggle | Icon swap (outline ↔ filled) |
| Journal article hero | Panel reveal on enter |
| Wrapped share success | Success check on copy |

**Rules:** `prefers-reduced-motion` guards on all; no `transition: all`; `tabular-nums` on stats; `text-wrap: balance` on showcase heading.

---

## Pillar 11 — Members directory

### Design

| Piece | Spec |
|-------|------|
| Route | **`/members`** (canonical; redirect alias optional) |
| Sort dimensions | **Popular** (diary logs in period), **Most reviews**, **Most lists**, **Most likes received** |
| Period | Week · month · year · all time — reuse `HomeCommunityPeriodToolbar` patterns |
| Row | `PatronPortraitWithMetalTier` + display name + @handle + primary stat + Follow button |
| API | `GET /api/members/leaderboard?sort=&period=&page=&limit=` |
| Privacy | Private profiles omitted from public leaderboard |
| Empty states | Full-height centered copy when no rows in period |

**Distinct from** Film/TV **title** ranks (existing Community leaderboards) — this ranks **patrons**.

### Success criteria

- Sort + period change updates list without full-page freeze.
- Follow from row works; `product_event: members_follow` logged.
- ≥10% of new follows from `/members` within 30d (metric target).

---

## Pillar 12 — Streaming availability alerts

### Design

| Piece | Spec |
|-------|------|
| Settings | Preferred **watch region** (existing) + **Notify when watchlisted titles stream near me** toggle |
| Job | Daily diff: TMDB/JustWatch providers vs patron watchlist per region |
| Notification type | `watchlist_now_streaming` — **in-app default on** |
| Email | **Pro-only** via Resend when title newly available on patron’s services |
| In-app UX | Watchlist tile **“Now on {service}”** pill; notification deep-links to movie/TV detail |

**Depends on:** `movie-watch-providers.ts`, existing watchlist FK, notification payload href patterns.

### Success criteria

- Synthetic fixture: watchlisted title gains Netflix in region → in-app notification within 24h job.
- Toggle off → no notifications.
- `product_event: streaming_alert_sent` + tap-through to detail.

### Out of scope (v1)

- Price comparison alerts.
- Email for non-Pro patrons.

---

## Build waves (Approach B)

| Wave | Track | Deliverables | Depends on |
|------|-------|--------------|------------|
| **0** | All | `showcase_items` migration, `product_event` keys | — |
| **1a** | Identity | Profile Showcase Strip + API + edit sheet | Wave 0 |
| **1b** | Ritual | Post-log micro-moment | Wave 0 |
| **1c** | Social | Viral reviews rail + API | Wave 0 |
| **2a** | Platform | Journal MVP (schema, staff, routes, seed content) | Wave 0 |
| **2b** | Social | Members directory + API | Wave 0 |
| **2c** | Ritual | Detail social proof counts | — |
| **3a** | Identity | Year in Review compute + pages + OG | 1a |
| **3b** | Platform | Streaming alerts job + notifications | — |
| **3c** | Cross | Motion polish pass | 1a, 1b, 1c |
| **4** | Platform | Catalogue stat line; list discovery polish | — |

Waves 1a–2b may run in parallel across engineers. Journal (2a) and Wrapped (3a) are the longest poles.

## Success metrics

| Metric | Target |
|--------|--------|
| Showcase fill rate | ≥60% of MAU with ≥1 slot within 30d |
| Post-log review compose | ↑ same-session rate vs baseline |
| Viral review rail CTR | ≥5% of Community home impressions |
| Journal monthly reach | ≥5% signed-in DAU visits `/journal` |
| Wrapped share rate | ≥15% of eligible patrons share OG |
| Members-origin follows | ≥10% of new follows from `/members` |
| Streaming alert opt-in | ≥20% of watchlist patrons enable toggle |

## Explicit non-goals

- Ratings histogram on movie/TV detail (brainstorm decision: compact summary only).
- Patron-authored Journal posts (v1).
- Algorithmic feed replacing reverse-chronological peer activity.
- Forced sync between showcase slots and diary hearts.
- Anime-first catalogue pivot.
- Shuffle browse sort.

## Relationship to existing roadmap

This spec **extends** [Tier 0–2 roadmap](./2026-05-29-sense-product-roadmap-design.md) — it does not replace it. Items already shipped (taste signature, pinned reviews, activity signature, taste rail, SEO lists, voice reviews) are **foundational**; this doc covers the **next obsessive-usage layer** inspired by Letterboxd pillar analysis.

**Profile perf constraint (carry forward):** Paginate or lazy-load filmography before adding heavy hero features; showcase strip is lightweight (4 tiles) and acceptable on hero.

## Testing strategy

| Area | Tests |
|------|-------|
| Showcase | Server: max 4, kind validation, legacy migration; Web: empty/filled states |
| Viral reviews | Server: engagement order + length filter |
| Journal | Staff publish permissions; public 200 incognito |
| Wrapped | Compute fixtures for sparse/dense years; OG private fallback |
| Members | Sort orders; private profile exclusion |
| Streaming alerts | Provider diff fixture; toggle respect |

## Open questions (resolve at implementation)

1. Showcase section label copy: **“On my mind”** vs **“Showcase”** vs patron-custom (defer custom).
2. Post-log one-line note: attach to log row vs review draft only.
3. Journal MDX vs stored HTML in `body` — prefer MDX if staff preview already uses React.

---

*Next step after approval: implementation plan via `writing-plans` skill — one plan per track or phased mega-plan per team preference.*
