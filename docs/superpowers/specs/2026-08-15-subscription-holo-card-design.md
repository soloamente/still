# Subscription membership card — Holo foil surface

**Status:** Approved (human `ok` 2026-08-15)  
**Date:** 2026-08-15  
**Apps:** `apps/web`, `packages/ui` (styles)  
**Supersedes (surface/motion only):** [`2026-08-12-subscription-identity-card-design.md`](./2026-08-12-subscription-identity-card-design.md)  
**Related:** [`2026-07-04-sense-subscriptions-design.md`](./2026-07-04-sense-subscriptions-design.md)

## Summary

Keep the Settings → Subscription **membership identity card** (identity front · billing back · companion rail · Invite & earn below). Replace today’s Motion-tilt + tier chrome/glow with a port of the **Holo** foil engine: lagged laminate layers, glare/smear/spot, and a **duotone portrait tile** with polarity sweep. Source CSS was not available — reconstruct styles from the engine’s CSS-variable contract and DOM slots.

## Locked decisions

| Topic | Decision |
|-------|----------|
| Product scope | Sense membership content only (name, handle, plan, status, billing). No Kamila / girlfriend copy, no Vault playground. |
| Approach | Port Holo `engine` + reconstruct `.holo-*` CSS; drive both faces from one tilt loop |
| Flip | Keep identity ↔ billing flip; foil effect on **both** faces |
| Foil map | Still → `brushed`; Attuned → `holo`; Immersed → `velvet`; Devoted → `cosmos` |
| Print | Pale, low-chroma **tier-tinted** stock (not dark `bg-card`, not one blush for all tiers) |
| Portrait | Holo duotone tile + tilt polarity; **no** plan-tier aura on this card |
| CSS | Reconstruct from class names + `--l*`, `--rx`/`--ry`, `--tile-*`, glare/smear/spot vars — best-effort, not pixel-identical to original Vault |
| Pattern décor | Drop romantic heart field; optional quiet Sense-safe grain/pattern only if it aids depth |
| Device tilt | Optional later; v1 = pointer + idle drift (disabled under reduced motion / soft GPU) |
| API | No schema or Polar API changes |

## Page structure (unchanged jobs)

1. **Identity stage** — card + companion rail (plan name, tagline, status, flip control, upgrades).  
2. **Invite & earn** — unchanged below.

## Front (Identity)

- Duotone portrait tile (patron image URL → `--tile-src`), polarity sweep past tilt threshold  
- Display name + `@handle` (above foil so type stays legible)  
- Tier label (+ quiet Sense mark as today)  
- Foil stack for the mapped material  

## Back (Billing)

- Same print + foil shell as front (shared CSS vars from one loop)  
- Status chip, interval, complimentary note, **Manage subscription** (behavior unchanged)  
- Content above foil; pointer-events only on the visible face  

## Motion & materials

- **Follow** tilt (faster) + **Follow** sheet (slower) + **Kick** on pointer leave  
- `applyFoil` / `applyFrame` write CSS variables onto the active face host(s) — both faces receive the same foil/print vars; 3D flip still owns `rotateY`  
- Freeze or damp foil updates mid-flip if they fight the flip spring  
- Soft GPU / `prefers-reduced-motion`: settle at rest, no idle drift, static foil opacities (brushed-level calm)  

## File plan

| Unit | Responsibility |
|------|----------------|
| `apps/web/src/lib/holo/engine.ts` | Port FOILS, Follow, Kick, applyFrame, applyFoil; remove `mediaUrl` / fixed Kamila path; accept tile URL + body gradient + tile duo colors |
| `apps/web/src/lib/holo/tier-map.ts` (or helpers in `subscription-identity-card.ts`) | Tier → Foil key + pale print + tile duo colors |
| Reconstructed CSS | `.holo-card` stack (body, foil×3, smear, spot, noise, glare, sheen, content, tile) — prefer `packages/ui` globals `@layer components` or a dedicated imported sheet |
| `me-subscription-identity-card.tsx` | Wire Holo body + loop; drop Motion pointer tilt / aura / old glow chrome where replaced |
| Tests | Unit: tier→foil map; clamp/adjust/Follow settle; applyFoil blanks unused layers |

## Non-goals

- Material playground / sliders  
- Shipping all ten foils in UI (unused keys may remain in engine data)  
- MetalFx / WebGL on the card  
- Pricing, Polar checkout, Invite & earn redesign  
- Exact pixel match to original Airbnb/Vault Holo CSS  

## Success criteria

1. `/me/settings/subscription` card tilts with lagged foil on both faces.  
2. Each plan tier shows a visibly different foil + pale print.  
3. Portrait duotone polarity responds to tilt; no aura rim on the card.  
4. Flip + Manage billing still work; Escape / reduced-motion behavior preserved.  
5. Soft GPU / reduced motion does not run a continuous rAF idle loop.  

## Open follow-ups (out of v1)

- Device orientation opt-in  
- Retuning Immersed/Devoted foil keys after visual QA  
