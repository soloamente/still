# Discord activity — Pro funding announcement + gate

**Status:** Approved (brainstorm 2026-08-11)  
**Date:** 2026-08-11  
**Apps:** `apps/web`, `apps/server`, `packages/plans`  
**Related:** [`2026-07-28-discord-profile-activity-design.md`](./2026-07-28-discord-profile-activity-design.md), [`2026-07-06-sense-support-campaign-dialogs-design.md`](./2026-07-06-sense-support-campaign-dialogs-design.md), [`2026-07-04-sense-subscriptions-design.md`](./2026-07-04-sense-subscriptions-design.md)

## Summary

Announce Discord profile activity (Listening / Playing) as a **Pro perk that ships when Sense can fund the presence VPS**. Live public progress shows how many **paying Polar** subscribers exist toward a tunable target. Hitting the target does **not** auto-enable the feature — Connect Discord stays off until production Discord/Lanyard is configured and `DISCORD_ACTIVITY_ENABLED` is on. When live, Discord activity is available to **all Pro members** (Attuned+), not the free Still tier.

The existing growth/mobile **support campaign** dialog stays as-is. Discord funding uses soft surfaces (Pricing, Settings) plus a What's New slide that queues behind that campaign.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Who unlocks for | **All Pro** (Attuned / Immersed / Devoted) — **not** every patron / Still |
| Pre-ship UX | Teaser + live progress + Pricing CTA; Connect Discord **disabled** |
| Progress metric | **Paying Polar only** — `polar_subscription_id` set + `subscription_status` in `active` \| `past_due`; **exclude** staff/`plan_override`-only Pro |
| Progress visibility | **Everyone** — public Pricing + Settings (unsigned see the bar on Pricing) |
| Unlock trigger | **Staff/ops** — enable production after VPS; progress is informational only |
| Support campaign | **Keep** mobile/growth campaign unchanged |
| Second announcement | What's New slide (behind support campaign while it replaces What's New) + Settings + Pricing |
| Architecture | Public funding API + shared strip UI + `discord_activity` plan feature |

Supersedes the Discord v1 lock **"Tier gating: None"** in the 2026-07-28 spec: production Discord activity is Pro-gated once announced this way.

## Problem

Discord activity needs a dedicated VPS (self-hosted Lanyard + presence guild). That cost should be funded by Pro subscriptions. Patrons need an honest story: the feature is real and coming for Pro, progress is visible, and Connect does not pretend to work before production infra is live.

## Goals

1. **Clear Pro ask** — Discord activity for every Pro member once Sense can run the presence server.
2. **Live public progress** — aggregate Polar-paid count vs target, no PII.
3. **Honest Connect state** — no OAuth while production is off; Settings still explains the feature.
4. **Pricing parity** — Discord listed as a planned Attuned+ perk with coming-soon → exists on unlock day.
5. **Leave mobile campaign alone** — Discord does not replace the growth/support dialog.

## Non-goals

- Auto-enabling Connect when `current >= target`.
- Free / Still access to Discord activity after unlock.
- Changing support-campaign copy or video.
- Provisioning the VPS / Lanyard stack in this ship (ops outside the app).
- Showing Discord activity on feed, ranks, or listing presence (unchanged from 2026-07-28).

---

## Product behavior

### Funding strip (shared)

Component: `DiscordActivityFundingStrip` (name flexible).

| Element | Behavior |
|---------|----------|
| Title | Discord activity for Pro |
| Body | Short founder-plain line: Listening / Playing on profile; ships for every Pro member once the presence server is funded |
| Progress | `N of T Pro members` + bar; `tabular-nums`; progressbar semantics (`aria-valuemin` / `now` / `max`) |
| CTA | **Support with Pro** → `/pricing`; if viewer already has Polar billing, prefer **Manage plan** / portal path used elsewhere on Pricing |
| When `productionEnabled` | **Unmount** the funding strip — do not keep a filled funding bar after ship |

Surface depth: canvas-on-card / raised card tokens — **no** decorative borders, rings, or shadows (Sense overlay chrome rules).

### Pricing (`/pricing`)

- Mount funding strip in the first viewport (above or immediately under the tier grid) so unsigned visitors see progress.
- Catalogue / tier feature lists: **Discord activity** on Attuned+ with existing **Coming soon** treatment while production is off; remove coming-soon when production is on.
- Staff `plan_feature` row: `buildStatus: planned` → `exists` on unlock day (same day as env flag).

### Settings → Profile

Today `MeDiscordConnect` returns `null` when `featureEnabled` is false. Change to three states:

| State | UI |
|-------|-----|
| Production **off** | Teaser card = funding strip + **no** working Connect (omit button or disabled with explanation) |
| Production **on** + Pro | Existing Connect / activity toggle / disconnect |
| Production **on** + Still | Locked card: included with Pro + Pricing CTA; no OAuth |

### What's New + changelog

- One What's New slide (new release `id`) describing Discord-for-Pro + funding; link/CTA toward `/pricing` or changelog.
- While `SENSE_SUPPORT_CAMPAIGN_ENABLED` is true, the support campaign continues to replace What's New — Discord slide ships when the campaign is turned off or the next What's New bump after.
- Add matching `/changelog` entry in the same release.

### After production is on

- Connect and activity APIs require Pro entitlement (`discord_activity` / Attuned+), in addition to `isDiscordActivityEnabled()`.
- Profile / account-menu activity rows only for owners who are Pro (and pass existing visibility rules).
- Still patrons never connect; they only see upgrade copy.

---

## Architecture

```text
Public GET /api/discord-activity/funding
  → countPolarPayingSubscribers()  // cached ~60s
  → target from DISCORD_ACTIVITY_PRO_TARGET (or constant)
  → productionEnabled = isDiscordActivityEnabled()
  → { current, target, productionEnabled }

Pricing / Settings / What's New
  → fetch funding payload
  → DiscordActivityFundingStrip

Unlock day (ops)
  → VPS + Lanyard live
  → Discord env set
  → DISCORD_ACTIVITY_ENABLED=true
  → plan_feature discord_activity planned → exists
  → teasers hide; Connect works for Pro only
```

### Counting rules

Include a profile when:

- `polar_subscription_id` is non-null / non-empty, **and**
- `subscription_status` is `active` or `past_due` (aligned with Polar sync “still paying / recoverable”).

Exclude:

- Pro only via `plan_override` or staff grants with **no** Polar subscription id.
- `canceled` / missing status / null Polar id.

`current` may exceed `target`; the bar clamps visually at 100% while the label can still show the true `N of T`.

### Plan feature

Add `PlanFeatureKey` **`discord_activity`** with `MIN_TIER_FOR_FEATURE` = **`attuned`**. Wire labels in `plan-feature-gate` and catalogue seeding/staff UI as needed. Enforcement on connect + activity mutation paths when production is enabled.

### API shape

```ts
type DiscordActivityFundingPayload = {
  current: number;
  target: number;
  productionEnabled: boolean;
};
```

- **Auth:** none (public).
- **Cache:** short TTL aggregate only — never return handles, emails, or subscription ids.
- **Errors:** 200 preferred with cached/stale data when possible; clients that fail the fetch show static copy + CTA without a fake zero bar (skeleton once, then soft “Progress unavailable” fallback).

### Production flag

Reuse `isDiscordActivityEnabled()` (`DISCORD_ACTIVITY_ENABLED` **and** full Discord/Lanyard infra). Funding `productionEnabled` mirrors that helper so Connect cannot appear “on” without infrastructure.

### Target constant

Tunable via env e.g. `DISCORD_ACTIVITY_PRO_TARGET` with a safe default placeholder (implementation picks a default such as `50` unless product sets otherwise before ship). Changing the target does not require a migration.

---

## Interface notes (better-interface)

- Progress is **text + bar**, not color alone.
- Verb-first CTAs (`Support with Pro`); no guilt copy.
- Settings teaser is always discoverable while production is off (do not hide the whole Discord section).
- Pricing strip must not fight tier CTAs for hierarchy — one funding composition, then plans.
- Respect `prefers-reduced-motion` on any bar fill animation (instant fill under reduced motion).

---

## Testing

| Area | Cases |
|------|--------|
| Counter | Active Polar counted; `past_due` counted; override-only excluded; canceled excluded; null Polar id excluded |
| Route | Public 200 shape; no PII fields; `productionEnabled` tracks `isDiscordActivityEnabled()` |
| Strip | Progressbar accessible name; clamp at target; fallback when fetch fails |
| Settings | Teaser when flag/infra off; Connect for Pro when on; Still locked when on |
| Gating | Still cannot connect when production on; Pro can |
| Pricing | Coming soon ↔ live feature row |

## Unlock day checklist (ops)

1. Presence VPS + Lanyard healthy; Discord bot + guild configured.
2. Set all Discord/Lanyard env vars on server (and web only if required today — prefer server-only).
3. Set `DISCORD_ACTIVITY_ENABLED=true`.
4. Flip plan feature `discord_activity` to `exists` / clear coming-soon on Pricing.
5. Smoke: Pro Connect works; Still sees upgrade; funding strip gone or post-ship quiet state.

## Files (expected)

| Area | Likely touch |
|------|----------------|
| Server | `count-polar-paying-subscribers.ts`, funding route, Pro gate on `me-discord` / activity paths |
| Env | Optional `DISCORD_ACTIVITY_PRO_TARGET` in `@still/env` |
| Plans | `discord_activity` on `PlanFeatureKey` + min tier map |
| Web | Funding strip, Pricing mount, `MeDiscordConnect` teaser states, What's New + changelog |
| Tests | Counter, route, strip/settings gating |

## Success criteria

1. Unsigned visitor on `/pricing` sees live `N of T` progress and a Pro CTA.
2. Signed-in Still patron in Settings sees Discord teaser, not a working Connect, while production is off.
3. Progress count matches Polar-paid rules (no staff-only inflation).
4. Enabling production + Pro unlocks Connect; Still remains gated.
5. Mobile support campaign behavior unchanged.
