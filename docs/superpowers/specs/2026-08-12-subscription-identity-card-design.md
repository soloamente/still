# Subscription membership identity card

**Status:** Approved (brainstorm 2026-08-12)  
**Date:** 2026-08-12  
**Apps:** `apps/web`  
**Related:** [`2026-07-04-sense-subscriptions-design.md`](./2026-07-04-sense-subscriptions-design.md)

## Summary

Replace the flat plan-status panel on `/me/settings/subscription` with a **membership identity card**: CSS 3D pointer tilt on the front, explicit flip control to a billing back. Invite & earn stays below. Polar portal / sync behavior is unchanged.

## Locked decisions

| Topic | Decision |
|-------|----------|
| Metaphor | Membership ID card (portrait · name · handle · tier) |
| Tech | CSS 3D + `motion/react` — **not** MetalFx / WebGL |
| Scope | First fold only; Upgrade CTAs under the card; Invite & earn separate |
| Flip | Explicit stage control (**Show billing** / **Show identity**) |
| Tilt | Fine pointer + `@media (hover: hover)` only; capped ~8–12° |
| API | No schema or Polar API changes |

## Page structure

1. **Identity stage** — centered card (~1.586 aspect, max-width ~22–26rem) on `bg-background` inset; flip control on the stage; upgrade links under the card when eligible.
2. **Invite & earn** — existing section unchanged.

## Front (Identity)

- `PatronPortraitWithAura` (plan-tier aura as today)
- Display name + `@handle`
- Tier label + tagline (`Still` / `Attuned` / `Immersed` / `Devoted`)
- Quiet Sense wordmark

## Back (Billing)

- Status chip (Active / Payment issue / Canceled / Free)
- Billing interval when known
- Plan-override complimentary note when set
- **Manage subscription** when Polar billing is available; else muted “No paid subscription to manage”

## Motion & a11y

- Flip: `rotateY(180°)`; freeze tilt during flip; Escape returns to front
- Reduced motion / software GPU: no tilt; flip may crossfade or snap
- Flip control: `aria-pressed`; region labeled as membership card
- Pointer-events only on the visible face

## Non-goals

- MetalFx on the card, pricing redesign, Polar checkout changes, Invite & earn redesign
