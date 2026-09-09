# Community ranks medals + subscription plan frames

**Status:** Approved (brainstorm 2026-08-26)  
**Date:** 2026-08-26  
**Scope:** Replace circular plan-tier portrait rims with **escalating SVG scallop frames** everywhere circular patron portraits already show a plan/staff aura; restyle Community ranks **top-3 podium** into **3D gold / silver / bronze medal pillars** with numbered badges.  
**Builds on:** [`2026-05-22-community-watch-leaderboard-design.md`](./2026-05-22-community-watch-leaderboard-design.md) (ranking rules, ledger tap — **visual podium only** changes), [`2026-07-25-avatar-plan-aura-design.md`](./2026-07-25-avatar-plan-aura-design.md) (tier source, staff win, Still = none — **rim shape and hover** change)  
**Reference:** Fitness-challenge podium (3D pillars + numbered badges). Scalloped portrait edges in that mock are **subscription frames**, not rank chrome.

## Summary

Two independent visuals share the same portraits:

1. **Plan frames** — Attuned / Immersed / Devoted / staff get a scalloped (seal-shaped) SVG frame instead of today’s circular conic rim. Still stays a plain circle. Every surface that already uses `PatronPortraitWithAura` picks this up.
2. **Rank medals** — Community Film / Shows / Episodes / Reviews podiums become 3D medal pillars (gold 1st, silver 2nd, bronze 3rd) with a silver **1 / 2 / 3** badge. Count stays inside the pillar and still opens the ledger. Rank list rows from #4 and month recap do not change.

Frames never encode podium place. A Devoted patron in 3rd still wears the Devoted frame; a Still patron in 1st stays frameless on a gold pillar.

## Locked decisions (brainstorm 2026-08-26)

| Topic | Decision |
|-------|----------|
| Rank surface | Community ranks **podium only** (Film / Shows / Episodes / Reviews top 3) |
| Rank rows #4+ | Unchanged (flat circular portraits) |
| Month recap podium | Unchanged |
| What scallops mean | **Subscription identity**, not 1st / 2nd / 3rd |
| Frame surfaces | **Everywhere** circular `PatronPortraitWithAura` already paints a plan/staff rim |
| Frame vs current rim | **Replace** the circular aura (do not stack) |
| Still (free) | **Plain circle** — no scallop |
| Shape ladder | **Escalates:** Attuned 8 large scallops → Immersed denser → Devoted ornate (second outer ring) → staff unique slate seal |
| Color language | Keep today’s gold → brighter gold → rainbow Devoted → cool slate staff (not the reference teal/coral) |
| Staff vs plan | Staff seal **wins** (existing `resolveAvatarAuraVisual`) |
| Hover | **Light CSS sheen only** (`@media (hover: hover)`). **No WebGL**. Reduced motion: sheen off |
| Build | **SVG silhouettes + CSS medal pillars** |
| Online / away dot | Stays on the **inner photo** (not a scallop bump) |
| Pillar look | 3D **gold / silver / bronze** Sense medals, silver numbered badges |
| Count | Stays **inside the pillar**; tap → existing ledger |
| Rank text | **1st / 2nd / 3rd** labels above portraits **go away**; the badge covers that |
| Identity | Display name + `@handle` stay under the portrait; taps → profile (portrait too) |
| 1–2 patrons | Stay **centered**; drop Members empty `flex-1` side slots |
| API | **No change** — `planTier` / `staffRole` already on payloads |
| Native | Out of scope |

## Problem

1. Community ranks podium is a flat inset wash. It does not read as a **stage**.
2. Plan identity on portraits is a thin circular rim. It does not match the scalloped “seal” language patrons expect from the subscription ladder, and it does not escalate in **shape**.
3. Rank color and plan color must not be the same channel. Mixing them (teal = 1st) would make a free patron in first look “unranked” and a Devoted patron in third look like a medal.

## Goals

1. Glance at Community ranks top 3 and read **place** from pillar height + numbered badge + medal material.
2. Glance at any circular portrait and read **plan** from scallop density / staff seal (or none).
3. Keep every existing tap: count → ledger, handle / name / face → profile, online dot labels, staff-over-plan.
4. Stay sharp from ~32px (feed) to profile-hero size. No idle animation. No new APIs.

## Non-goals

- Month recap podium restyle
- Scallops on rank list rows from #4
- New plan hues or a fourth paid silhouette
- Re-enabling Devoted WebGL. Delete unused `avatar-aura-devoted-canvas.tsx` in this pass.
- Native / Expo frames
- Changing who appears on boards, how counts work, or ledger contents
- Announcing the frame to screen readers

## Architecture

```text
planTier / staffRole  (already on web payloads)
        │
        ▼
resolveAvatarAuraVisual()     unchanged: staff | plan | none
        │
        ▼
AvatarAura                    SVG path as CSS mask on the metal layer only; circular photo well; optional sheen
        │
        ▼
PatronPortraitWithAura        circular portraits only (existing gate)
        │
        ├── feed, profile, account menu, search, drawers, presence, podium…
        │
community-ranks-podium.ts     medal gradients, heights, badge, floor glow
        │
        ├── HomeLeaderboardPodium      Film / Shows / Episodes
        └── MembersLeaderboardPodium   Reviews (and other members sorts)
```

**Failure domains stay split.** A missing SVG or CSS token must fall back to a **plain circle**, not hide the photo. A missing `planTier` already resolves to Still. Invalid `staffRole` already parses to non-staff.

## Subscription frames

### Who gets a frame

| Visual | Shape | Fill |
|--------|--------|------|
| Still / none | No frame | — |
| Attuned | 8 large rounded scallops | Warm gold (`avatar-aura-rim--attuned` tokens) |
| Immersed | **16** denser scallops | Brighter gold (`--immersed` tokens) |
| Devoted | 16 inner scallops **plus 8** smaller outer lobes | Rainbow conic (`--devoted` tokens) |
| Staff | Distinct seal: square-ish petals, cool slate repeating-conic | Existing `--staff` tokens |

Staff with a paid plan still shows **only** the staff seal.

Non-circular portraits (`isCircularPatronPortraitClass` false) stay unframed — same as today’s rim gate.

### Construction

- Four inline SVG silhouettes (React components next to `avatar-aura.tsx`) as **filled outer paths**. The photo is a **circle clip** inside, not an SVG mask (masks clip hover sheen inconsistently). Fill uses existing CSS custom properties so themes keep working.
- Inner photo well stays a **circle** with a thin inner hairline (canvas-colored stroke) so the photo does not melt into the metal.
- Frame is `aria-hidden`. Portrait alt / name behavior unchanged.
- `FeedPersonAvatar` already sets `overflow-visible` when `hasAvatarAuraVisual`; keep that so scallops are not clipped.

### Motion

- Rest: static.
- Hover (fine pointer only): a short CSS sheen across the frame (≤200ms). No scale on the portrait.
- `prefers-reduced-motion: reduce`: no sheen.
- Touch: rest frame only (no press sheen).

### Online dot

`PatronOnlineDot` stays absolutely positioned on the **inner circular well**, bottom-end as today. Do not park it on a lobe.

## Community podium

### Layout

Order remains **2nd · 1st · 3rd** with `items-end`. 1st is the tallest pillar, then 2nd, then 3rd (existing height tokens, restyled as 3D blocks).

Only filled slots render. **Members** must match Film/Shows: no empty `flex-1` placeholders that shove one or two patrons off-center.

Tray stays `HOME_COMMUNITY_RANKS_PODIUM_TRAY_CLASSNAME` (`bg-card`). Rows from #4 stay `HOME_COMMUNITY_RANKS_ROW_CLASSNAME`.

### Pillars

- **1st:** gold 3D block (dark recessed top, gold face) — not the fitness-app white plastic.
- **2nd:** silver 3D block.
- **3rd:** bronze / desert-orange 3D block (keep desert-orange in the mix so 3rd still reads Sense).
- Silver **circular badge** on the face with **1**, **2**, or **3**. Accessible name is still “1st” / “2nd” / “3rd” (`communityRanksPodiumSlotLabel`).
- Soft **floor glow** under the three pillars: CSS radial gradient, `pointer-events: none`. **No `backdrop-blur`** (software GPU).
- Remove the muted **1st / 2nd / 3rd** text currently above each portrait.

### Interactions (unchanged)

| Target | Action |
|--------|--------|
| Portrait, display name, `@handle` | `/profile/[handle]` |
| Pillar count + “View log” / members CTA | Existing ledger drawer (`openPatronWatchLedger` / `openPatronMembersLedger`) |

Press scale on the pedestal control stays (`active:scale-[0.98]` / `DetailMotionButton`). Enter stagger stays; reduced motion skips translate.

### Shared tokens

Keep one module: `apps/web/src/lib/community-ranks-podium.ts`. Both podiums import it. Do not fork medal CSS into members vs home.

## Data flow

No server, schema, or Eden changes. Leaderboard and profile payloads already include `planTier` and `staffRole`. Missing or unknown `planTier` → Still (plain). That is already `resolveAvatarAuraTier`.

## Error handling

| Case | Behavior |
|------|----------|
| SVG / mask fails to paint | Photo still renders as a plain circle |
| Software GPU | Floor glow stays a flat radial (no blur). Sheen is CSS `linear-gradient` only — no WebGL probe |
| Empty podium | Existing: render nothing when there is no first-place entry |
| One or two entries | Center the filled columns |

## Testing

- Keep `avatar-aura-tier.test.ts` resolver + staff-win tests. Class names may stay `avatar-aura-rim--*` (paint changes in CSS/SVG).
- Add / extend tests that the four paid/staff visuals map to distinct frame identifiers (Attuned ≠ Immersed ≠ Devoted ≠ staff).
- Pedestal helpers: 1st tallest, badge label, medal class per slot.
- Members podium: with only one entry, no extra flex placeholders in the tree (query / snapshot).
- Existing leaderboard period / eligibility tests stay green. No new API tests.

## Files (expected)

| Path | Change |
|------|--------|
| `apps/web/src/components/profile/avatar-aura/avatar-aura.tsx` | SVG frame wrapper + sheen |
| `apps/web/src/components/profile/avatar-aura/*-frame.tsx` (or one sprite module) | Four silhouettes |
| `packages/ui/src/styles/globals.css` | `.avatar-aura-rim*` paint for scallops; sheen |
| `apps/web/src/components/profile/avatar-aura/avatar-aura-devoted-canvas.tsx` | Delete (unused) |
| `apps/web/src/lib/community-ranks-podium.ts` | Medal surfaces, badge, glow, drop visible slot label from tiles |
| `apps/web/src/components/home/home-leaderboard-podium.tsx` | Badge instead of 1st text |
| `apps/web/src/components/members/members-leaderboard-podium.tsx` | Same + drop empty side slots |
| `apps/web/src/components/home/community-ranks-podium-count.tsx` | Unchanged behavior; classes come from tokens |

`PatronPortraitWithAura` should not need a new public API if `AvatarAura` owns the frame.

## Amendment to prior specs

- **2026-05-22** “tier-card podium” rest-state is **replaced** by medal pillars for Community ranks top 3 only. Ranking rules, period, ledger, and eligibility do not change.
- **2026-07-25** rest-state **circular** rim is **replaced** by SVG scallops. Hover WebGL stays **retired**. A light CSS sheen is the only hover (narrower than that spec’s Attuned/Immersed/Devoted effect ladder). Shape, not hover theater, carries the plan ladder.
