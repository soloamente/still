# Sense Support Campaign + Purchase Success Dialogs — Design

**Status:** Approved (brainstorm 2026-07-06)  
**Date:** 2026-07-06  
**Apps:** `apps/web`  
**Replaces (temporarily):** active What's New release for this ship cycle

## Summary

Two patron-facing modals:

1. **Support campaign dialog** — one-time message that Sense traffic is growing, paid plans fund infrastructure and a **native mobile app**, with a split layout (copy left, vertical teaser video right on desktop).
2. **Purchase success dialog** — celebration after Polar checkout on **`/home`**, replacing the Settings success toast.

Brainstorm decisions are locked:

| Topic | Decision |
|-------|----------|
| Campaign audience | All signed-in patrons |
| Campaign frequency | Once per patron (`localStorage`) |
| vs What's New | **Replaces** What's New for this release; changelog link inside |
| Primary CTA | **Support the project** → `/pricing` |
| Secondary | In-dialog **Learn about the app** copy (no new route) |
| Dismiss | **Maybe later** + X / overlay / Escape |
| Purchase success | Dialog on **`/home`** after checkout; **no** success toast on Settings for that path |
| Architecture | Dedicated campaign components (not extending What's New carousel) |

## Problem

Patrons need an honest, well-written explanation of why paid plans matter now (traffic → costs + mobile app funding). The product also deserves a proper **thank-you moment** after checkout instead of a fleeting toast buried in Settings.

## Goals

1. **Clear ask** — traffic growth → costs + mobile app; support via plans, not guilt.
2. **Visual proof** — vertical teaser video at full dialog height (desktop).
3. **One big moment** — replaces What's New this release; link to full changelog.
4. **Checkout delight** — tier-aware success dialog on home after payment.
5. **Non-intrusive** — once per patron for campaign; once per checkout for success.

## Non-goals

- New API routes or billing logic changes (reuse existing Polar sync).
- Autoplay video with sound.
- Replacing month recap orchestration.
- Permanent What's New removal (campaign ends → restore normal release carousel next bump).

---

## Dialog 1 — Support campaign

### Copy (patron-facing)

| Element | Text |
|---------|------|
| Kicker pill | `Building what's next` |
| Title | `Sense is growing — and so is the work` |
| Body | `More of you are showing up every week. That's incredible — and it means higher hosting costs, more support load, and a real push to bring Sense to your phone.` / `Paid plans keep the lights on and fund the native app we're building. If Sense has become part of how you watch, supporting the project helps us ship it without cutting corners.` |
| Learn block (subtitle) | `Sense for iOS & Android` |
| Learn block (body) | `Diary, lists, and community in your pocket. Same taste graph, built for quick logs on the couch. Early supporters get us there faster.` |
| Primary | **Support the project** → `/pricing` |
| Secondary | **Maybe later** (dismiss + mark seen) |
| Tertiary link | **Full changelog** → `/changelog` |

Tone: direct, grateful, founder-voice — not alarmist, not “pay or we die.”

### Layout

**Shell:** Same modal family as What's New — portal to `document.body`, `APP_MODAL_OVERLAY_CLASS`, `bg-card`, `rounded-[2rem]`, `z-[250]`, ghost **X**.

**Desktop (`md+`):**

```
┌─────────────────────────────────────────────────────────┐
│  [X]                                                    │
│  ┌──────────────────────┬──────────────────────────┐  │
│  │ kicker               │                          │  │
│  │ title                │   vertical video card    │  │
│  │ body                 │   (h = full dialog)      │  │
│  │ learn block          │   object-cover           │  │
│  │ [Support the project]│   rounded inner shell    │  │
│  │ Maybe later          │                          │  │
│  │ Full changelog →     │                          │  │
│  └──────────────────────┴──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- Dialog max width ~`max-w-3xl` or `max-w-4xl`, max height `min(92svh, 640px)`.
- Right column: `bg-background` inset card, video `h-full w-full`, **`playsInline` `muted` loop** — **tap to play** (no autoplay on mount).
- Left column: vertically centered content, `px-6 py-8`, left-aligned text.

**Mobile (`< md`):**

- Single column: copy + buttons first.
- Video below in ~9:16 container, `max-h-[min(50svh,420px)]`, same tap-to-play rules.
- Primary button full-width; **Maybe later** as ghost below.

### Video asset

- Source file (repo root): `AQM4PyzKSXqZ7gZ81574ExJTEDTMAeK9oslz_VqYOaj-FWb1GqAl8eKJ6uKEGZv-ybb4XPLAUHyAesyWy6Xcyddfvla_1Bd4Yv_Qgx8.mp4`
- Ship at: `apps/web/public/campaigns/sense-mobile-teaser.mp4`
- Optional poster: first-frame PNG under `public/campaigns/` (can defer — video `preload="metadata"`).

### Orchestration

**Campaign id:** `sense-growth-2026-07` (constant in `sense-support-campaign.ts`).

**Seen state:** `still:sense-support-campaign-seen:v1:{userId}` → stores campaign id (mirror `whats-new-seen.ts`).

**Mount:** `SenseSupportCampaignDialogRoot` in `AppShell` next to `WhatsNewDialogRoot`.

**While campaign active:**

- `getActiveSenseSupportCampaign()` returns config when `SENSE_SUPPORT_CAMPAIGN_ENABLED` (or hard-coded active id).
- `WhatsNewDialogRoot` **does not mount / does not open** when campaign is active (gate in root or skip render in `AppShell`).
- Month recap unchanged; opens after campaign dismiss using existing defer + watch-region poll (same as What's New defer).

**Open timing (mirror What's New):**

- ~2.5s after mount.
- Poll until watch-region prompt inactive (max ~45s).
- Do not open if `!shouldShowSenseSupportCampaign(userId, campaignId)`.

**Dismiss:** any close path calls `markSenseSupportCampaignSeen(userId, campaignId)`.

**Error boundary:** render failure marks seen and unmounts (non-fatal).

---

## Dialog 2 — Purchase success

### Trigger

1. Polar success URL continues to hit `/success`.
2. **Change redirect** to `/home?checkout=success&checkout_id={id}` (not Settings).
3. `PlanPurchaseSuccessDialogRoot` in `AppShell` watches search params on `(app)` routes.

### Flow

1. Patron lands on `/home?checkout=success&checkout_id=…`
2. Root calls `fetchSyncPolarCheckoutClient(checkoutId)` (same as Settings today).
3. On sync success (or `checkout=success` without id): open dialog with **resolved tier** from refreshed profile / sync result.
4. Strip `checkout` and `checkout_id` from URL via `router.replace` (no scroll).
5. **Do not** show `toast.success` on Settings for this path.

### Copy (tier-aware)

| Element | Text |
|---------|------|
| Title | `You're in — thank you` |
| Body | `You're on **{Attuned\|Immersed\|Devoted}** now. Your support keeps Sense running and helps fund the mobile app.` |
| Primary | **Explore your plan** → `/me/settings/subscription` |
| Secondary | **Back to home** (dismiss) |

**Still tier:** should not appear (checkout success implies paid tier). Fallback copy: `Your support keeps Sense running and helps fund the mobile app.`

### Layout

- Compact centered dialog, `max-w-md`, no video.
- Same modal chrome family (portal, overlay, `bg-card`, `rounded-[2rem]`).
- Mobile-first; works at 390px width.

### Sync failure

If checkout sync fails but `checkout=success` is present: show dialog with generic body (`Payment received — your plan may take a moment to update.`) and primary **View subscription** → Settings. No error toast unless sync throws and no success flag.

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/web/public/campaigns/sense-mobile-teaser.mp4` | Teaser video asset |
| `apps/web/src/lib/sense-support-campaign.ts` | Campaign id, copy constants, enabled flag |
| `apps/web/src/lib/sense-support-campaign-seen.ts` | localStorage seen gate |
| `apps/web/src/lib/sense-support-campaign-seen.test.ts` | Seen helper tests |
| `apps/web/src/lib/plan-purchase-success-query.ts` | Parse/clear `checkout` search params |
| `apps/web/src/lib/plan-purchase-success-query.test.ts` | Query helper tests |
| `apps/web/src/components/app/sense-support-campaign-dialog.tsx` | Split layout UI + video |
| `apps/web/src/components/app/sense-support-campaign-dialog-root.tsx` | Defer, watch-region poll, open gate |
| `apps/web/src/components/app/plan-purchase-success-dialog.tsx` | Success UI |
| `apps/web/src/components/app/plan-purchase-success-dialog-root.tsx` | Sync + open on query |
| `apps/web/src/components/app/app-shell.tsx` | Mount both roots; gate What's New |
| `apps/web/src/app/success/page.tsx` | Redirect to `/home?checkout=…` |
| `apps/web/src/components/profile/me-subscription-settings.tsx` | Remove success toasts for checkout return |

---

## Testing

**Unit:**

- `shouldShowSenseSupportCampaign` / mark seen parity with whats-new-seen.
- `parsePlanPurchaseSuccessQuery` / strip params.

**Manual QA:**

1. Signed-in patron, first visit → support dialog with video; dismiss → never again.
2. What's New does **not** appear while campaign active.
3. Month recap still works after campaign dismiss (if eligible).
4. Mobile 390px — stacked layout, tap-to-play video.
5. Complete Polar checkout → lands `/home` → success dialog with correct tier; no Settings toast.
6. Refresh `/home` without query params → success dialog does not reappear.

---

## Rollout

1. Ship campaign + success dialogs with video in `public/campaigns/`.
2. Bump changelog / What's New version notes in same PR (campaign replaces WN for this release).
3. Next release: set `SENSE_SUPPORT_CAMPAIGN_ENABLED = false`, restore `getActiveWhatsNewRelease()`.

---

## Spec self-review (2026-07-06)

- [x] No TBD sections — copy, layout, orchestration, and files defined.
- [x] Consistent with existing modal patterns (`APP_MODAL_OVERLAY_CLASS`, AppShell roots).
- [x] Scope bounded — web-only, no new server routes.
- [x] What's New replacement is time-boxed, not permanent.
- [x] Video accessibility — tap to play, muted, no autoplay audio.
