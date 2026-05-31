# Sense — Product Roadmap & Launch Design

**Status:** Approved — Phase 1a implementation in progress (2026-05-29)  
**Date:** 2026-05-29  
**Product name:** **Sense** (patron-facing at launch; codebase may remain `still` until post-launch rebrand wave)  
**Approach:** **Launch Tier 0** — complete strategy Tier 0 on top of the existing movies + TV + Community product, then Tier 1–3 per strategy doc  
**Stage:** Pre-launch (no meaningful public user base yet)

## Summary

Sense is a **retention-first social identity platform for taste** (not “a better Letterboxd”). The codebase today implements a Letterboxd-class **diary + social layer** with **movies, TV, Community**, achievements, cinematic chrome, and in-flight home performance work. This spec maps [`sense-media-platform-strategy.md`](../../../sense-media-platform-strategy.md) to **what to ship before launch** vs **first 90 days → 12 months**, while **keeping the current catalogue scope** and adding missing Tier 0 pillars.

**Closing directive from strategy (Section 15):** *Build the place where someone's taste feels real, recognized, and worth displaying.*

## Strategic frame (from strategy doc)

### Retention stack — build toward Tier 4 from day one

| Tier | Hook | Sense today | Launch target |
|------|------|-------------|---------------|
| 1 | Utility (log, rate, search) | Strong base | Keep excellent (&lt;30s log) |
| 2 | Content (lists, reviews) | Shipped | Keep + list quality rules (Tier 1) |
| 3 | Social (follows, feed, overlap) | Community shipped | Cold-start editorial + people search |
| 4 | Identity (taste signature, prestige, expression) | **Gap** | **Tier 0 focus** |

Most logging apps stall at Tier 2. Sense launch must make **identity** legible in the first session.

### Habit loop (Section 1)

Every core action (log, rate, review, list) should have a **social echo** that returns asynchronously. Launch does not require full feed algorithms for this, but does require: shareable cards, profile worth visiting, and editorial surfaces that show disagreement and voice—not empty feeds.

### Deliberate divergences from strategy doc

| Strategy recommendation | Sense decision | Rationale |
|---------------------------|----------------|-----------|
| Launch **movies + anime**; defer TV | **Keep movies + TV**; anime Tier 1+ | TV + Community already built; avoid surface-area reset pre-launch |
| Full monorepo rename pre-launch | **Phased rebrand (C)** | Patron-facing “Sense” at launch; `@still/*` → `@sense/*` month 1 post-launch |
| Remove quantity stats from profiles | **De-emphasize at launch**; full badge scarcity pass Tier 1 | Existing `watch_N` badges remain until Phase 2 refactor; **freeze new quantity badges** at launch |

## North star & launch definition

### North star

**Someone looks at their profile after weeks/months and thinks: *this is actually me.***

Downstream: retention, virality, monetization (Section 12)—all follow identity depth.

### Launch gate (Tier 0 complete)

A new patron can:

1. See **Sense** (not Still) on all patron-facing surfaces.
2. **Import** from Letterboxd (Anilist if ready without delaying launch).
3. Get an **auto-generated taste signature** on profile (rule-based v1).
4. Complete **onboarding v2** with taste seeding and a first-session “knows me” moment (Section 14).
5. See a **rich feed with zero follows** (editorial cold-start, Section 6 migration triggers).
6. **Log in &lt;30 seconds** and use diary, lists, reviews, movies/TV browse, Community.
7. **Share a taste card** that signals identity (Section 2 Loop 1).
8. Use **search** including people (in-flight work completes before launch).

Plus **Phase 0** exit: home browse instant navigation shipped; core flows smoke-tested; retention metrics instrumented.

### Not required for launch (defer per strategy Section 8–9)

- Rivalry / taste comparison (Tier 1)
- Completionist challenges (Tier 1)
- Rare badge system **rewrite** (Tier 1—but freeze new quantity badges)
- Streaks without protection (Tier 1, with shields)
- Taste-matched discovery engine (Tier 2)
- Anime / MAL depth (Tier 1 optional wedge)
- Profile themes / creator analytics / collaborative lists (Tier 3)
- Forums, streaming affiliates, paywalled social (Section 8)

## What we keep vs add

### Keep (existing product)

- Movies + TV lobbies, detail, diary, watchlist, `tv_watch` progress
- Community: Lists, Reviews, Activity, Film ranks, TV ranks, period toolbar
- Lists, reviews, quick log, patron ratings (0.0–10.0 display scale)
- Achievements lobby + badge evaluator (refactor in Tier 1)
- Onboarding shell (bio + favorites)—**extend**, don’t replace
- Cinematic / 70mm atmosphere + Mobbin-informed control clarity (Track B)
- Sticky browse + search, profile filmography, notifications shell

### Add for launch (Tier 0 gaps)

| Strategy Tier 0 item | Sense module (target) |
|----------------------|------------------------|
| Bulk import Letterboxd / Anilist | `POST /api/import/*`, import job, settings UX |
| Taste signature | `sense-taste-signature` lib, profile cache, `ProfileTasteSignature` |
| Editorial empty-state feed | `editorial-feed` config + Community/home fallbacks |
| Fast logging | Verify quick-log path; no regression |
| Shareable taste cards | OG/image route + share affordances on profile/log |

| Strategy-aligned launch extras | Notes |
|--------------------------------|-------|
| Onboarding v2 (Section 14) | Quick-rate → taste preview → bio → favorites |
| Profile identity hierarchy (Section 4, 11) | Taste signature above volume stats |
| Notification quality filter (Tier 1 in doc; pull forward) | Default high-signal only (Section 8) |
| Sense patron rebrand | Phased C |

## Phased roadmap

### Phase 0 — Foundation (now → ~2–3 weeks)

**Goal:** Stable, fast core before identity work.

| Workstream | Deliverable | Exit |
|------------|-------------|------|
| Home perf | [Home browse instant navigation](./2026-05-29-home-browse-instant-navigation-design.md) | Pill &lt;100ms; Community core-first |
| Search | ⌘K + people + Go to (in flight) | Films/TV/lists/people work |
| Metrics | D1/D7/D30, time-to-first-log, time-to-first-follow, import completion | Events flowing |
| QA | Profile, diary, Community, import path smoke | No P0 blockers |

### Phase 1 — Launch blockers (Tier 0)

Build order (dependencies):

```
Phase 0
  → 1.1 Sense rebrand (patron-facing)
  → 1.2 Bulk import (Letterboxd)
  → 1.3 Taste signature v1 (+ 1.7 profile hierarchy)
  → 1.4 Onboarding v2 (quick-rate; after import parser exists)
  → 1.5 Editorial cold-start
  → 1.6 Shareable taste cards
  → 1.8 Notification quality defaults
  → LAUNCH
```

#### 1.1 Sense rebrand (phased C)

**In scope at launch:** `BrandMark`, metadata, copy, emails, manifest, share strings, footer/legal where shown.  
**Post-launch month 1:** `@still/*` packages, env prefixes, internal docs, CI labels.  
**URLs:** Keep `/profile/[handle]` and existing routes; domain cutover when ready.

#### 1.2 Bulk import

- **Letterboxd first** (CSV export minimum); Anilist second if ≤ ~1 week slip.
- Async job with progress; idempotent merge (`source: import`).
- On complete: recompute taste signature; toast + optional “First import” badge (one-time, not volume ladder).
- **Undo import** window or support path for bad matches (risk mitigation).

#### 1.3 Taste signature v1

**Inputs:** Logs, ratings, genres, directors, optional contrarian vs TMDB average.  
**Output:** 1–3 sentences; “discovered” language (Section 4).  
**Storage:** `profile.taste_signature_json` + `computed_at` (cache).  
**Compute:** On import done, onboarding done, log threshold crossed; nightly for active users.  
**Low data:** &lt;5 logs → honest placeholder + CTA (quick-rate / import).  
**No LLM in v1** (Section 7 Weakness 2—moat is data + social, not copy AI).

#### 1.4 Onboarding v2 (Section 14)

```
quick-rate (15–20 editorial titles)
  → taste preview (“you gravitate toward…”)
  → bio
  → favorites
  → done → /home with editorial feed
```

**Anti-patterns avoided:** email-before-value, empty feed first screen, generic marketing welcome.

#### 1.5 Editorial cold-start (Section 6, 15)

When `following.length === 0`:

- **Community / home:** featured lists, recent quality reviews, trending activity highlights.
- **Config:** `editorial-feed` JSON or DB slots; manual curation acceptable pre-PMF.
- **Principle:** Social features compelling at **scale zero** (Section 7 Weakness 5).

#### 1.6 Shareable taste cards (Section 2 Loop 1)

- Route: `GET /og/taste/[handle]` or image API (Satori / `@vercel/og`).
- Content: avatar, handle, taste headline, 2 badges, optional review quote.
- **Must feel personal** (badge palette, not one global template)—generic cards kill sharing.
- Share from profile + post-log; copy link + download.

#### 1.7 Profile identity hierarchy (Sections 4, 8, 11)

- Taste signature **most prominent** after avatar/name.
- Volume stats (**logged N films**) secondary or collapsed.
- Badge cluster: subtle weight (Section 11)—not notification-style popups.
- Pin signature reviews (Tier 2; optional stub field at launch).

#### 1.8 Notification quality filter (Section 8)

**Default on:** follow, reply, mention, badge earned, import done, taste challenge (when Tier 1 ships).  
**Default off / bundled:** generic “[user] liked your review”.  
**Server:** type allowlist + preferences; reputation/mutual boosts for likes if enabled.

### Phase 2 — First 90 days (Tier 1, strategy Section 9)

Aligned to strategy priority table; order within phase by R × V:

| Feature | Strategy notes | Sense notes |
|---------|----------------|-------------|
| **Rare / quality-gated badges** | Prestige core; scarcity | Refactor `badge-evaluator`; stop `watch_1000`-style public prestige; add curated rare badges |
| **Rivalry / taste comparison** | Loop 2; “interestingly different” framing | Friend challenge; referral hook |
| **Completionist challenges** | Loop 3 / Section 3 Principle 4 | Filmographies, festival sets, studio catalogues |
| **Notification filter** | If not fully in launch | Tune from retention data |
| **Streaks + protection** | Section 7 Weakness 4 | Freezes, grace, recovery—never punitive cliff |
| **Advanced anime** | Underserved wedge | Optional; TV remains first-class |
| **Internal `@sense` rename** | Phased C month 1 | Packages, env, docs |

**Also Tier 1 aligned (strategy Sections 5, 13):**

- List quality: title + description for discoverability; per-item annotations.
- Curator spotlights for power users (Section 5—design for top 5% first).
- Review ranking by engagement, not word count (Section 13).

### Phase 3 — Months 3–6 (Tier 2)

| Feature | Strategy R/V/D/U | Purpose |
|---------|------------------|---------|
| Curator / power user recognition | R high | Creator retention |
| SEO-indexed list pages | V high | Organic growth (Loop 3) |
| Taste-matched discovery | D 5, U high | Core moat (Section 5 data network effects) |
| Activity signature on profile | Tier 4 identity | GitHub-graph for media |
| Director / creator deep-dives | Discovery differentiation | |

**Social feed depth (Section 2 Loop 4):** Surface rating divergence between followed users; lightweight “weigh in” from feed.

### Phase 4 — Months 6–12 (Tier 3)

- Profile customization (themes, layouts)—monetization-aligned (Section 12 Tier 1 Pro).
- Creator analytics dashboard (Section 7 Weakness 6).
- Collaborative / social lists.
- Seasonal anime tracking (if anime wedge pursued).
- Advanced taste matching / friend discovery.
- **Monetization:** Pro subscription on expression + depth (themes, analytics, streak shields, unlimited lists)—**never** core log/review/social (Section 12).

## Architecture slices (Phase 1)

### Taste signature

```
logs/ratings (DB) → computeTasteSignature() → profile.taste_signature_json
                              ↓
                    ProfileTasteSignature (web)
```

Shared lib: `apps/web/src/lib/sense-taste-signature.ts` + mirror on server for compute job.

### Import pipeline

```
Upload CSV → import job → TMDB match → upsert log/watchlist/review
                              ↓
                    computeTasteSignature + notification
```

### Editorial feed

```
editorial config → merge with friend feed when follows empty
                 → Community RSC + client highlights
```

### Taste card

```
profile + badges + taste JSON → OG image route → share UX
```

## Growth loops (strategy Section 2) — when they land

| Loop | Launch (Tier 0) | Tier 1+ |
|------|-----------------|---------|
| **1 Taste share** | Taste cards | Card personalization depth |
| **2 Rivalry** | — | Taste challenge |
| **3 List discovery** | Editorial lists | SEO + featured curators |
| **4 Feed friction** | Editorial highlights | Divergence rows, weigh-in |

## Onboarding architecture (Section 14)

| Step | Time budget | Outcome |
|------|-------------|---------|
| Taste seeding (quick-rate) | ~2 min | Taste profile seeded |
| First discovery hit | &lt;3 min total | One surprising rec (rule-based OK v1) |
| Social seed | Optional | Import contacts / find friends |
| First log | &lt;5 min | Fast log + small celebration |
| Profile reveal | End | Nascent profile + taste signature |

## Metrics (Section 1 — instrument Phase 0)

| Metric | Use |
|--------|-----|
| D1 / D7 / D30 / D90 by source | Retention health |
| Median time to first social action | Tier 3 proxy |
| % import completed in session | Migration funnel |
| % log within 48h of signup | Onboarding quality |
| Streak distribution (when live) | Cliff analysis |
| Badge unlock → 30-day retention correlation | Gamification quality |

**Pre-PMF north star proxy:** D7 retainers with visible taste signature and ≥10 imported or logged titles.

## Identity & profile prestige (Sections 4, 11)

Launch profile scan order:

1. Avatar + handle  
2. **Taste signature** (identity core)  
3. Badge cluster (scarce > loud)  
4. Pinned / signature reviews (Tier 2)  
5. List portfolio grid  
6. Volume stats (de-emphasized)

**Language:** “Gravitates toward…” not “Horror fan.” **Feel discovered, not labeled.**

## Power users (Section 5)

Launch does not require creator dashboards, but **must not** ship features that insult curators:

- Freeze quantity badge expansion.
- Editorial featuring of high-quality lists in cold-start.
- Tier 1: curator designation, list analytics, bulk import (already Tier 0).

## Psychological triggers (Section 10) — product guardrails

- **Variable reward:** Async social echoes; avoid predictable-only completion toasts.
- **Loss aversion:** No streaks until protection exists.
- **Social comparison:** Rivalry framing “interestingly different.”
- **Endowment:** Import + taste signature + lists = switching cost.
- **Zeigarnik:** Watchlists + challenges (Tier 1)—surface incomplete arcs, don’t nag.
- **Personalized social proof:** “Two patrons like you rated 9/10” (Tier 2 discovery).

## Explicit “no” list (Section 8 + strategy weaknesses)

- Forums / general discussion boards (defer)
- Streaming affiliate primary feature (defer)
- Paywall on log / follow / comment
- Streaks without shields
- New quantity-based prestige badges at launch
- LLM-required taste signature v1
- Algorithm pay-to-play discovery
- Ads on organic content (Section 12)
- MAU as sole health metric—prioritize **weekly loggers + reviewers**

## Risks & mitigations (Section 7, 15)

| Risk | Mitigation |
|------|------------|
| Tier 0 scope creep | Hard launch table 1.1–1.8 only |
| Import bad matches | Idempotency, review summary, undo window |
| Generic taste copy | Templates + contrarian line + confidence states |
| Empty Community | Editorial + seed curator accounts weekly |
| Achievement noise | Freeze quantity badges; Tier 1 scarcity pass |
| Failure arc month 3 (Section 15) | Editorial at zero followers; power user featuring; D7 focus |
| “Better UX” as moat (Weakness 2) | Identity + data + community, not UI alone |

## Testing

### Launch blockers QA

1. New account: quick-rate → taste on profile → no empty Community home.
2. Letterboxd import 500+ rows: no duplicates; signature updates; profile loads &lt;3s.
3. Zero follows: editorial feed scrollable 30s+.
4. Taste card share: preview looks personal; link opens profile.
5. Log flow: search → rate → diary in &lt;30s.
6. Sense branding: no “Still” in patron UI.
7. Home: Movies ↔ Community pill instant (Phase 0).

### Automated

- Unit: `computeTasteSignature` fixtures (sparse, contrarian, genre-heavy).
- Unit: import idempotency hash.
- `bun run build` in `apps/web` and server typecheck—required gate.

## Relationship to other specs

| Doc | Relationship |
|-----|----------------|
| [2026-05-29-home-browse-instant-navigation-design.md](./2026-05-29-home-browse-instant-navigation-design.md) | Phase 0 prerequisite |
| [sense-media-platform-strategy.md](../../../sense-media-platform-strategy.md) | Source strategy; Tier tables and psychology |
| Track B scratchpad (`.cursor/scratchpad.md`) | UI/IA conventions; Sense inherits Mobbin + cinematic layers |

## Rollout waves

| Wave | Scope | Exit |
|------|-------|------|
| **0** | Home instant nav, search/people, metrics | QA perf + search |
| **1a** | Rebrand + import + taste signature + profile hierarchy | Import + profile QA |
| **1b** | Onboarding v2 + editorial + cards + notifications | Full launch gate QA |
| **Launch** | Public Sense | D7 instrumentation live |
| **2** | Tier 1 (90 days) | Rivalry, challenges, badge pass, optional anime |
| **3–4** | Tier 2–3 | Discovery moat, creator tools, monetization |

---

*Next step after human spec approval: implementation plan via `writing-plans` skill (one plan per Phase 0/1a/1b wave recommended).*
