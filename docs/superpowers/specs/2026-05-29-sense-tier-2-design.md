# Sense — Tier 2 (Months 3–6) Design

**Status:** Draft — Planner approved for breakdown (2026-05-29)  
**Parent:** [2026-05-29-sense-product-roadmap-design.md](./2026-05-29-sense-product-roadmap-design.md)  
**Strategy source:** [sense-media-platform-strategy.md](../../../sense-media-platform-strategy.md) §2 Loop 3–4, §4 prestige, Tier 2 table

## Summary

Tier 1 shipped identity hooks (taste signature, overlap, challenges, streaks, curator v1, list quality). **Tier 2** grows **organic discovery** (SEO lists), **profile depth** (activity signature, pinned reviews), **taste-native discovery** (not popularity-only), and **feed friction** (rating divergence). Curator recognition **v1** stays; v2 analytics defer to Tier 3.

## Recommended build order

| Wave | ID | Feature | Why this order |
|------|-----|---------|----------------|
| **A** | ST.1 | **Public SEO list pages** | Strategy: High V, Low U; Loop 3. Unblocks Google → sign-up. **Prerequisite fix:** lists today live under `(app)` auth layout — crawlers and guests cannot index. |
| **B** | ST.2 | **Activity signature** | Tier 4 identity on profile; reuses diary timestamps; no new graph infra. |
| **C** | ST.3 | **Pinned / signature reviews** | Roadmap profile scan #4; small schema + profile UI. |
| **D** | ST.4 | **Taste-matched discovery v1** | High moat; depends on taste signature + log density. Start rule-based (“patrons like you”), not ML. |
| **E** | ST.5 | **Feed divergence rows** | Loop 4; builds on follow graph + ratings. |
| **Defer** | ST.6 | Director / creator deep-dives | Medium differentiation; large TMDb surface — after discovery v1. |
| **Defer** | — | Curator analytics dashboard | Tier 3 (§7 Weakness 6). SN.11 covers designation + spotlights. |

## ST.1 — SEO-indexed public list pages

### Problem

- `apps/web/src/app/(app)/lists/[id]/page.tsx` has `generateMetadata` but sits behind **`(app)/layout.tsx`** → redirects to `/sign-in`.
- `GET /api/lists/:id` returns **private** lists to anonymous callers (no `isPublic` gate) — must harden before public URLs.

### Approach

1. **API:** `GET /api/lists/:id` — if `!isPublic`, return 404 unless `user` is owner (or future collaborator).
2. **Public route group** (no auth layout): e.g. `app/(marketing)/lists/[id]/page.tsx` or `app/l/[id]/page.tsx` — server-fetch public list via cookie-less `serverApi` / public fetch helper.
3. **Read-only list detail** — reuse list hero + film grid; hide owner edit/radial/reorder; show **like count** + **Sign in to like** + **Sign up** CTA (Mobbin-style, no border chrome).
4. **Metadata:** `title`, `description` (≥40 chars lists from SN.10), `openGraph` + `twitter`, `robots: { index: true }` only when public + described; `canonical` URL.
5. **OG image (optional v1.1):** static template with list title + cover mosaic (reuse list OG patterns if any).
6. **`app/sitemap.ts`:** paginate public list IDs (`GET /api/lists?limit=&cursor=` already public-only).
7. **`app/robots.ts`:** allow `/lists/` or `/l/`; disallow `(app)` shells.
8. **Redirect:** signed-in patrons hitting public URL → optional 302 to `(app)/lists/[id]` for full chrome (or keep one URL — prefer **single canonical** public URL for SEO).

### Success criteria

- Incognito: open public list URL → 200 HTML with title/description in `<head>`; no sign-in wall.
- Private list URL → 404 (API + page).
- `curl` sitemap includes public list entries.
- Lighthouse SEO basics on sample list (title, meta description, og:title).

### Out of scope (ST.1)

- Programmatic “best X films” landing pages (editorial CMS).
- hreflang / multi-locale.

## ST.2 — Activity signature (profile)

### Concept

GitHub-style **contribution grid** for **diary activity** (logs per day), not generic app opens. One cell = one calendar day; intensity = log count (cap color steps at 4+). **TV logs** count as one activity per day (not per episode) for v1.

### Approach

1. **Server:** `GET /api/profiles/:handle/activity-signature?year=` or embed in profile payload — aggregate `log.watchedAt` by UTC/local day (match diary display TZ patron setting if available; else profile TZ).
2. **Web:** `ProfileActivitySignature` below taste signature / above badges on `profile/[handle]` — 52×7 grid, `aria-label` per week; tooltip on hover/focus with date + count.
3. **Empty states:** sparse year → muted grid; zero logs → omit section.
4. **Other profiles:** public only when profile is public (same gate as filmography).

### Success criteria

- Own profile shows last 52 weeks; tooltips accurate vs diary.
- Visitor on public profile sees same; private profile hides.
- `prefers-reduced-motion`: no cell animation.

## ST.3 — Pinned signature reviews

### Concept

Up to **3** reviews pinned on profile (strategy §4). Ordered by patron.

### Approach

1. Migration: `user_profile.pinned_review_ids` jsonb (max 3) or join table.
2. `PATCH /api/profiles/me/pins` — validate ownership + published reviews.
3. Profile hero: horizontal strip or stacked cards under taste signature — reuse `ReviewCard` compact variant.

### Success criteria

- Pin/unpin from review detail or profile edit affordance.
- Pins appear on profile; max 3 enforced server-side.

## ST.4 — Taste-matched discovery v1

### Concept

Surface titles aligned with **taste signature** + **high-rated logs**, not TMDB popularity alone. v1 = **rule-based scoring** on catalogue candidates (genre overlap, decade, language), exclude already-logged.

### Surfaces (pick one for v1)

- **Home editorial row:** “Because you gravitate toward …”
- **Movie detail:** replace or augment “More like this” second rail for signed-in users.

### Success criteria

- Signed-in user with ≥10 logs sees ≥6 titles not in diary.
- Zero logs → fall back to editorial cold-start (no empty rail).

## ST.5 — Feed divergence rows

### Concept

When followed patrons rated same title with **large spread** (e.g. Δ ≥ 4.0 on 0–10 scale), show inline feed row: titles, both scores, **Weigh in** → movie detail or quick log.

### Approach

1. Server: feed composer query or post-process on `GET /api/feed`.
2. Web: `ActivityDivergenceRow` — flat `bg-background` tile (Community feed rules).

### Success criteria

- Synthetic fixture or seed: divergence row appears once in Activity tab.
- Weigh in navigates to title without full-page freeze.

## Dependencies & risks

| Risk | Mitigation |
|------|------------|
| SEO route duplicates `(app)` list UI | Shared RSC components; one canonical path |
| Private list leak via API | Ship API gate in ST.1 Task 1 |
| Taste discovery cold start | Threshold + editorial fallback |
| Activity TZ bugs | Document UTC vs patron TZ; test DST edge |

## Testing

- **ST.1:** API test anonymous private list → 404; sitemap integration smoke.
- **ST.2:** Unit aggregate by day; fixture profile render.
- **ST.4–5:** Unit scoring / divergence detection fixtures.

## Human QA gates

One **`ok`** per wave after Executor completes success criteria (scratchpad **ST.x.2** rows).
