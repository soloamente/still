# Avatar Plan Auras — Tiered Hover Effects Replacing the Diary Metal BorderBeam

**Status:** Approved (brainstorm 2026-07-25)
**Date:** 2026-07-25
**Builds on:** `2026-07-04-sense-subscriptions-design.md` (plan tiers), `packages/plans` (`resolveEffectiveTier`), `apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx`

## Summary

Retire the always-animating diary-volume **BorderBeam** ring on patron portraits and replace it with **plan-tier avatar auras**: a static gradient rim as the rest-state tier cue, plus a **hover-only** effect that scales from a chill CSS sheen (Attuned) through a golden-hour glow loop (Immersed) up to a cursor-reactive WebGL chromatic/iridescent shader (Devoted). Free tier (**Still**) gets no rim and no effect.

**Approach:** Hybrid ladder — CSS for Attuned/Immersed, lazy-mounted hand-rolled GLSL canvas for Devoted, zero idle cost for everyone.

## Brainstorm decisions (locked)

| Topic | Decision |
|-------|----------|
| Tier source | **Subscription plan tier** (`resolveEffectiveTier`: `planOverride ?? subscriptionTier ?? "still"`), not diary volume |
| Trigger | **Hover/press only** — no ambient animation at rest |
| Rest state | **Static gradient rim** per paid tier (brass / gold / iridescent); Still = nothing |
| Implementation | **Hybrid** — CSS effects for Attuned + Immersed, WebGL fragment shader for Devoted |
| Dependencies | **None new** — inline GLSL in a tiny canvas component |
| BorderBeam | Removed from portraits; `border-beam` package stays (search pill) |
| `diaryMetalTier` | Stays on the wire short-term; avatars stop consuming it; cleanup is a later pass |
| Touch (`hover: none`) | Rim only in v1 — no press-triggered variant |
| Visibility | Plan tier becomes **publicly visible per patron** (cosmetic flair, intentional) |

## Problem

`PatronPortraitWithMetalTier` runs a `BorderBeam` pulse on every qualifying avatar, everywhere avatars render (feed, leaderboards, drawers, presence rows). That is:

1. **Costly** — many simultaneous looping animations on list-heavy screens.
2. **Semantically stale** — it rewards diary volume, while the product now has a paid tier ladder (Still → Attuned → Immersed → Devoted) with no visual identity on portraits.
3. **Flat** — one effect regardless of tier; no "epic" ceiling for Devoted.

## Goals

1. **Tier legibility at rest** — a glance tells the tier without any motion.
2. **Zero idle cost** — nothing animates until pointer intent.
3. **A real ladder** — Attuned feels subtle, Immersed feels rich, Devoted feels legendary.
4. **Graceful degradation** — software GPU, reduced motion, no-WebGL, and touch all get sensible fallbacks.
5. **One shader max** — hover exclusivity guarantees at most one WebGL context alive.

## Non-goals

- Press-triggered effects on touch devices (v1 is rim-only there).
- Patron settings to disable auras (viewer or owner) — revisit if feedback demands it.
- Removing `diaryMetalTier` from API payloads (separate cleanup).
- Any change to plan gating/entitlements logic or Polar flows.
- Auras on non-circular portraits (banner tiles etc.) — circular portraits only, matching current BorderBeam behavior.

---

## Data model

### Tier type

Reuse **`PlanTierId`** from `@still/plans` (`"still" | "attuned" | "immersed" | "devoted"`) — no new union. The web already imports `PlanTierId` (see `fetch-me-profile.ts`).

### Server: `planTier` on patron-shaped payloads

New helper `apps/server/src/lib/patron-plan-tier.ts`:

```ts
/** Batch effective plan tiers for avatar aura hydration — one profile query per page. */
export async function fetchPlanTiersForUserIds(
  userIds: readonly string[],
): Promise<Map<string, PlanTierId>>;

export function planTierForUserId(
  userId: string,
  tiers: Map<string, PlanTierId>,
): PlanTierId; // defaults to "still"
```

- Single `profile` query selecting `subscriptionTier` + `planOverride`, resolved via `resolveEffectiveTier`. **No `planFeatureGrant` join** — grants affect features, never tier, so this is cheaper than `loadPatronEntitlementsForUserIds`.
- Mirrors the shape/callsite pattern of `fetchDiaryLogCountsForUserIds` / `diaryMetalTierForUserId` so it slots into the same batch hydration points.

Attach **`planTier: PlanTierId`** next to `diaryMetalTier` in every payload builder that currently carries it:

- `listing-engagement-query.ts` (engagement drawer rows)
- `leaderboard-query.ts`, `members-leaderboard-query.ts`, `members-leaderboard-items-query.ts` (Community ranks, Members)
- `profile-search.ts` (⌘K People), `profiles.ts` / `profile-media.ts` (profile payloads, follows)
- `movie-following-ratings.ts` (From people you follow)
- `listing-presence.ts` (viewing-now rows)
- `feed-rating-divergence.ts`, `creator-recognition.ts`, `month-recap-query.ts` (feed + spotlight rows)
- `routes/reviews.ts`, `routes/movies.ts` (review authors, comment authors)

Web payload types mirror the field (`fetch-listing-engagement.ts`, `home-leaderboard-types.ts`, `members-leaderboard-item-types.ts`, `profile-search-query.ts`, `fetch-listing-presence.ts`, `month-recap-types.ts`, `patron-nav-user.ts`, `home-friend-rail.ts`, …). Missing/undefined `planTier` decodes as `"still"` so stale caches never crash.

---

## Component architecture

### Rename

`PatronPortraitWithMetalTier` → **`PatronPortraitWithAura`** (`patron-portrait-with-aura.tsx`). Mechanical rename across ~25 call sites; props stay compatible except:

- `diaryMetalTier?: DiaryMetalTier | null` → **`planTier?: PlanTierId | null`**
- `BorderBeam` import and `diary-metal-tier.ts` beam mapping removed from the component. `isCircularPatronPortraitClass` moves to (or is re-exported from) the aura module.

Presence dot, `showOnlineStatus`, `presenceState`, and the fills-parent sizing logic are untouched.

### New module `apps/web/src/components/profile/avatar-aura/`

| File | Job |
|------|-----|
| `avatar-aura.tsx` | Client wrapper: rest rim + hover intent state machine + per-tier effect layer |
| `avatar-aura-tier.ts` | Tier → rim gradient / effect config maps, `resolveAvatarAuraTier` (unknown → `"still"`) |
| `avatar-aura-devoted-canvas.tsx` | `next/dynamic({ ssr: false })` WebGL canvas, imported on first Devoted hover only |

GLSL lives inline in the canvas file as template strings. Keyframes for sheen/glow live in `packages/ui/src/styles/globals.css` (`@layer components`, prefixed `avatar-aura-*`).

### Rest rim

Thin conic-gradient ring rendered as a wrapper with ~1.5px padding behind the circular portrait (`rounded-full`, gradient background, portrait clipped inside). No pseudo-element hacks — works at every size from 24px feed bylines to the 176px profile hero because padding is absolute, not proportional.

| Tier | Rim |
|------|-----|
| Still | none (component renders portrait exactly as today) |
| Attuned | warm brass conic gradient, low contrast |
| Immersed | golden conic gradient, slightly brighter stops |
| Devoted | iridescent conic gradient (subtle oil-slick multi-hue) |

### Hover state machine (`avatar-aura.tsx`)

- Pointer-enter starts an **~80ms intent timer** (kills churn when sweeping a cursor across a feed). Timer fires → `hoverActive: true`.
- Pointer-leave: Attuned lets its one-shot sweep finish; Immersed fades its loop out over ~200ms; Devoted keeps the canvas mounted for **~300ms grace** (re-enter reuses it), then unmounts.
- All hover effects gated behind `@media (hover: hover)` (CSS) / pointer-type check (JS for the canvas mount).

---

## The ladder (visual spec)

### Attuned — "projector sweep"

One masked light band (~30° diagonal, soft edges) sweeps across the portrait on hover-enter. ~600ms ease-out, **plays once per enter** (re-triggers on next enter). Implementation: absolutely-positioned gradient overlay clipped to the circle, `transform: translateX` keyframe, `opacity` in/out. Compositor-only.

### Immersed — "golden hour"

While hovered: a warm radial glow breathes (opacity 0.5↔0.8, ~2.4s alternate) plus a horizontal anamorphic flare (thin bright streak) drifting slowly across. Two gradient layers, `transform`/`opacity` only, loops while `hoverActive`, fades out on leave.

### Devoted — "chromatic reel"

On hover (post intent-delay): lazy-mount `avatar-aura-devoted-canvas` absolutely over the portrait (same circle clip). Fragment shader over the avatar texture:

- **Chromatic aberration** — RGB channel offsets radiating from the cursor position (`uMouse` uniform updated on pointermove, lerped in-shader for trail feel).
- **Iridescent film grain** — animated value-noise tinted by a hue ramp, screened over the image at low opacity; evokes light through celluloid.
- Uniforms: `uTime`, `uMouse`, `uResolution`, `uSampler` (avatar bitmap drawn once into the texture on mount).
- One `requestAnimationFrame` loop, canceled on unmount; `preserveDrawingBuffer: false`; context created with `{ alpha: true, antialias: false }`.

Canvas draws the avatar image itself while active (portrait `<img>` stays underneath for instant fallback when the canvas unmounts).

---

## Performance & fallbacks

- **Idle cost is zero** for all tiers — rims are static CSS; no animation, no canvas, no timers at rest.
- **Hover exclusivity** → at most one shader canvas alive across the whole app. Compiled program is cached module-level and reused across hovers within the session.
- **`useSoftwareGpuRendering` or WebGL unavailable** → Devoted hover falls back to a CSS holo-foil imitation: iridescent conic gradient overlay + slow `filter: hue-rotate` loop while hovered.
- **`prefers-reduced-motion`** → rim only, all tiers, no hover motion (rim is the static tier cue, so nothing semantic is lost). Uses existing `usePrefersReducedMotion`.
- **WebGL context loss** (`webglcontextlost`) → silently swap to the CSS fallback for the rest of the session.
- **Touch** (`hover: none`) → rim only.
- Avatar texture upload uses the already-loaded portrait `<img>` element (`texImage2D` from the DOM image) — no second network fetch. If the image is cross-origin-tainted, fall back to CSS holo.

---

## BorderBeam retirement

- `patron-portrait-with-metal-tier.tsx` deleted after rename; `BorderBeam`, `DIARY_METAL_BORDER_BEAM_STRENGTH`, and `diaryMetalBorderBeamColorVariant` usages removed from portrait code.
- `apps/web/src/lib/diary-metal-tier.ts` keeps `isCircularPatronPortraitClass` (or it moves into the aura module) — beam-specific exports deleted once unreferenced.
- `border-beam` package dependency **stays** — the collapsed search pill (`searchBorderBeamColor` theming) still uses it.
- Server `diaryMetalTier` computation/payloads untouched in this pass.

---

## Testing

### Unit (bun)

- `resolveAvatarAuraTier`: known tiers pass through; unknown/null/undefined → `"still"`.
- `fetchPlanTiersForUserIds` / `planTierForUserId`: override wins over subscription tier; missing profile row → `"still"`; empty input → empty map.
- One representative route test asserting `planTier` on the payload (extend `listing-engagement-query` or leaderboard route tests, following the existing `diaryMetalTier` test pattern).

### Manual QA checklist

- Each tier at 24–32px (feed byline), ~64–80px (drawer tiles), 176px (profile hero).
- Rapid cursor sweep across a leaderboard — no canvas churn (intent delay works), no jank.
- Devoted hover on: normal GPU, `useSoftwareGpuRendering` forced, reduced-motion, and a simulated context-loss.
- Touch viewport — rim renders, no hover effects fire.
- Still-tier patron — pixel-identical to a plain `PatronPortraitAvatar`.
