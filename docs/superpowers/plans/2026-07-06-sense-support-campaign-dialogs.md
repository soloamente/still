# Sense Support Campaign + Purchase Success Dialogs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven execution (one task per subagent; human **`go`** between tasks) or executing-plans for batch runs.

**Goal:** Ship a one-time support campaign dialog (split copy + vertical video) that replaces What's New this release, plus a purchase-success dialog on `/home` after Polar checkout.

**Architecture:** Dedicated campaign + success dialog roots in `AppShell`, `localStorage` seen gate mirroring `whats-new-seen.ts`, `/success` redirects to `/home?checkout=success`, Settings drops duplicate success toasts.

**Tech Stack:** Next.js App Router, `motion/react`, portal modals, existing Polar sync clients.

**Spec:** [`docs/superpowers/specs/2026-07-06-sense-support-campaign-dialogs-design.md`](../specs/2026-07-06-sense-support-campaign-dialogs-design.md)

---

## File map

| File | Action |
|------|--------|
| `apps/web/public/campaigns/sense-mobile-teaser.mp4` | Add (move from repo root) |
| `apps/web/src/lib/sense-support-campaign.ts` | Create |
| `apps/web/src/lib/sense-support-campaign-seen.ts` | Create |
| `apps/web/src/lib/sense-support-campaign-seen.test.ts` | Create |
| `apps/web/src/lib/plan-purchase-success-query.ts` | Create |
| `apps/web/src/lib/plan-purchase-success-query.test.ts` | Create |
| `apps/web/src/components/app/sense-support-campaign-dialog.tsx` | Create |
| `apps/web/src/components/app/sense-support-campaign-dialog-root.tsx` | Create |
| `apps/web/src/components/app/plan-purchase-success-dialog.tsx` | Create |
| `apps/web/src/components/app/plan-purchase-success-dialog-root.tsx` | Create |
| `apps/web/src/components/app/app-shell.tsx` | Modify |
| `apps/web/src/app/success/page.tsx` | Modify |
| `apps/web/src/components/profile/me-subscription-settings.tsx` | Modify |

---

### Task 1: Campaign constants + seen gate

**Files:**
- Create: `apps/web/src/lib/sense-support-campaign.ts`
- Create: `apps/web/src/lib/sense-support-campaign-seen.ts`
- Create: `apps/web/src/lib/sense-support-campaign-seen.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, test } from "bun:test";
import {
  markSenseSupportCampaignSeen,
  shouldShowSenseSupportCampaign,
} from "./sense-support-campaign-seen";

describe("sense-support-campaign-seen", () => {
  test("shows when unseen", () => {
    expect(shouldShowSenseSupportCampaign("user-1", "sense-growth-2026-07")).toBe(true);
  });
  test("hides after mark seen", () => {
    markSenseSupportCampaignSeen("user-1", "sense-growth-2026-07");
    expect(shouldShowSenseSupportCampaign("user-1", "sense-growth-2026-07")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/web && bun test src/lib/sense-support-campaign-seen.test.ts`

- [ ] **Step 3: Implement**

`sense-support-campaign.ts`:

```ts
export const SENSE_SUPPORT_CAMPAIGN_ID = "sense-growth-2026-07";
export const SENSE_SUPPORT_CAMPAIGN_VIDEO_SRC = "/campaigns/sense-mobile-teaser.mp4";
export const SENSE_SUPPORT_CAMPAIGN_ENABLED = true;

export function getActiveSenseSupportCampaign() {
  if (!SENSE_SUPPORT_CAMPAIGN_ENABLED) return null;
  return { id: SENSE_SUPPORT_CAMPAIGN_ID, videoSrc: SENSE_SUPPORT_CAMPAIGN_VIDEO_SRC };
}
```

Mirror `whats-new-seen.ts` for seen helpers with prefix `still:sense-support-campaign-seen:v1:`.

- [ ] **Step 4: Run — expect PASS**

---

### Task 2: Support campaign dialog UI

**Files:**
- Create: `apps/web/src/components/app/sense-support-campaign-dialog.tsx`

- [ ] **Step 1: Build split layout component**

- Portal + `APP_MODAL_OVERLAY_CLASS`
- Desktop: `md:grid md:grid-cols-[1fr_1fr]` or 45/55 flex; right column `h-full min-h-0`
- Video: `<video>` with `playsInline muted loop controls={false}`, tap-to-play toggle, `object-cover`, `rounded-2xl`
- Copy from spec; buttons use `Button` `size="pill"`
- `prefers-reduced-motion`: skip scale entrance if reduced

- [ ] **Step 2: Manual smoke**

Open story/dev page or temporary mount — verify video loads from `/campaigns/sense-mobile-teaser.mp4`

---

### Task 3: Campaign dialog root + AppShell gate

**Files:**
- Create: `apps/web/src/components/app/sense-support-campaign-dialog-root.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx`

- [ ] **Step 1: Root orchestration**

Copy defer pattern from `whats-new-dialog-root.tsx`:
- 2.5s delay, watch-region poll, error boundary
- `shouldShowSenseSupportCampaign` before open

- [ ] **Step 2: Gate What's New**

In `app-shell.tsx`:

```tsx
const supportCampaign = getActiveSenseSupportCampaign();
// ...
{supportCampaign ? (
  <SenseSupportCampaignDialogRoot userId={user.id} campaign={supportCampaign} />
) : (
  <WhatsNewDialogRoot userId={user.id} />
)}
<MonthRecapDialogRoot userId={user.id} />
```

- [ ] **Step 3: Move video asset**

Copy root `AQM4Pyz…mp4` → `apps/web/public/campaigns/sense-mobile-teaser.mp4`

---

### Task 4: Purchase success query helpers

**Files:**
- Create: `apps/web/src/lib/plan-purchase-success-query.ts`
- Create: `apps/web/src/lib/plan-purchase-success-query.test.ts`

- [ ] **Step 1: Tests**

```ts
test("detects checkout success params", () => {
  const q = parsePlanPurchaseSuccessQuery("?checkout=success&checkout_id=abc");
  expect(q.isSuccess).toBe(true);
  expect(q.checkoutId).toBe("abc");
});
```

- [ ] **Step 2: Implement parse + build cleared URL**

---

### Task 5: Purchase success dialog + root

**Files:**
- Create: `apps/web/src/components/app/plan-purchase-success-dialog.tsx`
- Create: `apps/web/src/components/app/plan-purchase-success-dialog-root.tsx`
- Modify: `apps/web/src/app/success/page.tsx`
- Modify: `apps/web/src/components/profile/me-subscription-settings.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx`

- [ ] **Step 1: Change `/success` redirect**

```ts
redirect(`/home?${destination.toString()}`);
```

- [ ] **Step 2: Success dialog UI**

Tier label from `PlanTierId` + `TIER_LABELS` pattern in `me-subscription-settings.tsx`.

- [ ] **Step 3: Root — sync on mount**

Use `useSearchParams`, `fetchSyncPolarCheckoutClient`, `usePatronEntitlements` or settings profile refresh after sync; open dialog once; `router.replace` cleared URL.

- [ ] **Step 4: Remove Settings success toasts**

Delete or guard `toast.success` branches in `finalizeCheckoutReturn` when query has `checkout=success` (home handles it).

- [ ] **Step 5: Mount `PlanPurchaseSuccessDialogRoot` in AppShell**

---

### Task 6: Changelog bump + manual QA

**Files:**
- Modify: `apps/web/src/lib/whats-new-releases.ts` or changelog entry (note campaign replaces WN)

- [ ] **Manual QA checklist (spec)**

1. Campaign once-only + video layout desktop/mobile  
2. What's New suppressed  
3. Checkout → `/home` success dialog  
4. No duplicate toast on Settings  

---

## Success criteria

- [ ] Support dialog shows once with split layout + video at full height (desktop)
- [ ] Primary CTA **Support the project** → `/pricing`
- [ ] What's New skipped while campaign enabled
- [ ] Polar checkout → `/home` success dialog with tier name
- [ ] Unit tests pass for seen + query helpers
