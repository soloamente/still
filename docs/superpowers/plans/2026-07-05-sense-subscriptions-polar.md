# Sense Subscriptions & Referrals (Polar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Human `go` between tasks.**

**Goal:** Ship Polar-backed Attuned/Immersed subscriptions, full tier feature gates, staff overrides/grants, public pricing, Settings billing, and Mobbin-style Invite & earn — per [`2026-07-04-sense-subscriptions-design.md`](../specs/2026-07-04-sense-subscriptions-design.md).

**Architecture:** New `@still/plans` package owns tier rank + `hasPatronFeature`. Profile gains `subscription_tier`, `plan_override`, Polar ids. Existing `@polar-sh/better-auth` checkout/portal in `packages/auth` gets four product IDs; Elysia webhook syncs subscription state. Web replaces all `isPro` with entitlement resolver + `PlanFeatureGate` upsells.

**Tech Stack:** Polar + `@polar-sh/better-auth`, Better Auth, Drizzle, Elysia, Next.js App Router, Bun test, `@still/plans`, `@still/db`.

**Prerequisite (human):** Create four Polar sandbox products + `REFERRAL10` discount; copy UUIDs into `.env` before Task 4.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/plans/package.json` | Workspace package |
| Create | `packages/plans/src/index.ts` | Tier enum, resolver, feature keys, referral milestones |
| Create | `packages/plans/src/entitlements.test.ts` | Unit tests |
| Modify | `packages/db/src/schema/profile.ts` | Subscription + referral columns |
| Create | `packages/db/src/schema/referral.ts` | `patron_referral`, `patron_referral_reward`, `plan_feature_grant` |
| Modify | `packages/db/src/schema/plan.ts` | `planFeature.key` column |
| Create | `packages/db/src/migrations/0039_subscriptions.sql` | SQL migration |
| Modify | `packages/db/src/migrations/meta/_journal.json` | Register migration |
| Modify | `apps/server/src/lib/seed-plan-catalogue.ts` | Stable `key` per feature |
| Modify | `packages/env/src/server.ts` | Polar env vars |
| Modify | `packages/auth/src/lib/payments.ts` | Env-driven sandbox/production |
| Modify | `packages/auth/src/index.ts` | Four checkout products |
| Create | `apps/server/src/lib/polar-product-map.ts` | Product id → tier + interval |
| Create | `apps/server/src/lib/sync-profile-subscription.ts` | Webhook → profile update |
| Create | `apps/server/src/routes/polar-webhook.ts` | Webhook handler |
| Create | `apps/server/src/routes/plans-public.ts` | `GET /api/plans` |
| Create | `apps/server/src/routes/referrals.ts` | Referral API |
| Create | `apps/server/src/lib/referral-capture.ts` | Sign-up ref cookie → profile |
| Create | `apps/server/src/lib/referral-qualify.ts` | Onboard → qualified + milestones |
| Create | `apps/server/src/lib/referral-milestones.ts` | Reward fulfillment |
| Modify | `apps/server/src/server/app.ts` | Register new routes |
| Create | `apps/web/src/lib/patron-entitlements.ts` | Client helpers wrapping `@still/plans` |
| Create | `apps/web/src/components/plans/plan-feature-gate.tsx` | Upsell wrapper |
| Create | `apps/web/src/components/plans/use-patron-entitlements.ts` | Hook from session/profile |
| Create | `apps/web/src/app/pricing/page.tsx` | Public pricing |
| Create | `apps/web/src/components/pricing/pricing-page-client.tsx` | Tier cards + checkout |
| Create | `apps/web/src/app/(app)/me/settings/subscription/page.tsx` | Billing settings |
| Create | `apps/web/src/components/referrals/invite-earn-dialog.tsx` | Mobbin-style dialog |
| Create | `apps/web/src/components/referrals/invite-earn-dialog-root.tsx` | Portal root + zustand |
| Modify | `apps/web/src/components/home/home-sticky-chrome.tsx` | Invite & earn button |
| Modify | `apps/web/src/lib/me-account-nav.ts` | Subscription nav item |
| Modify | `apps/web/src/components/staff/staff-user-detail.tsx` | Override + grants |
| Modify | `apps/web/src/lib/auth-client.ts` | Export polar checkout helpers usage |

---

## Task 1: `@still/plans` package — entitlements core

**Files:**
- Create: `packages/plans/package.json`
- Create: `packages/plans/tsconfig.json`
- Create: `packages/plans/src/index.ts`
- Create: `packages/plans/src/entitlements.test.ts`
- Modify: root `package.json` / `turbo.json` if workspace list needed

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@still/plans",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "default": "./src/index.ts" } },
  "scripts": { "check-types": "tsc --noEmit", "test": "bun test" },
  "devDependencies": {
    "@still/config": "workspace:*",
    "@types/bun": "catalog:",
    "typescript": "^6"
  }
}
```

- [ ] **Step 2: Write failing tests**

```ts
// packages/plans/src/entitlements.test.ts
import { describe, expect, test } from "bun:test";
import {
  hasPatronFeature,
  resolveEffectiveTier,
  tierRank,
  type PlanFeatureKey,
} from "./index";

describe("resolveEffectiveTier", () => {
  test("planOverride wins over subscriptionTier", () => {
    expect(
      resolveEffectiveTier({ subscriptionTier: "attuned", planOverride: "devoted" }),
    ).toBe("devoted");
  });
  test("defaults to still", () => {
    expect(resolveEffectiveTier({ subscriptionTier: "still", planOverride: null })).toBe("still");
  });
});

describe("hasPatronFeature", () => {
  const minTierFor: Record<PlanFeatureKey, "attuned" | "immersed"> = {
    taste_signature: "attuned",
    all_themes: "immersed",
    full_stats: "attuned",
    activity_signature: "attuned",
    streaming_filters: "attuned",
    watchlist_alerts: "attuned",
    profile_customization: "immersed",
    pinned_reviews: "immersed",
    list_covers: "immersed",
    private_lists: "immersed",
    taste_overlap: "immersed",
    badge_prestige: "immersed",
    challenges: "immersed",
    leaderboard_visibility: "immersed",
  };

  test("still user blocked from attuned feature", () => {
    expect(
      hasPatronFeature({
        effectiveTier: "still",
        grants: [],
        featureKey: "taste_signature",
        minTierFor,
      }),
    ).toBe(false);
  });

  test("grant-only extra unlocks above tier", () => {
    expect(
      hasPatronFeature({
        effectiveTier: "still",
        grants: ["taste_overlap"],
        featureKey: "taste_overlap",
        minTierFor,
      }),
    ).toBe(true);
  });

  test("immersed includes attuned features via rank", () => {
    expect(
      hasPatronFeature({
        effectiveTier: "immersed",
        grants: [],
        featureKey: "taste_signature",
        minTierFor,
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 3: Implement `packages/plans/src/index.ts`**

```ts
export const PLAN_TIER_IDS = ["still", "attuned", "immersed", "devoted"] as const;
export type PlanTierId = (typeof PLAN_TIER_IDS)[number];

export type PlanFeatureKey =
  | "full_stats"
  | "taste_signature"
  | "activity_signature"
  | "streaming_filters"
  | "watchlist_alerts"
  | "all_themes"
  | "profile_customization"
  | "pinned_reviews"
  | "list_covers"
  | "private_lists"
  | "taste_overlap"
  | "badge_prestige"
  | "challenges"
  | "leaderboard_visibility";

const TIER_RANK: Record<PlanTierId, number> = {
  still: 0,
  attuned: 1,
  immersed: 2,
  devoted: 3,
};

export function tierRank(tier: PlanTierId): number {
  return TIER_RANK[tier];
}

export function resolveEffectiveTier(input: {
  subscriptionTier: PlanTierId;
  planOverride: PlanTierId | null;
}): PlanTierId {
  return input.planOverride ?? input.subscriptionTier ?? "still";
}

export function hasPatronFeature(input: {
  effectiveTier: PlanTierId;
  grants: readonly PlanFeatureKey[];
  featureKey: PlanFeatureKey;
  minTierFor: Record<PlanFeatureKey, PlanTierId>;
}): boolean {
  if (input.grants.includes(input.featureKey)) return true;
  const minTier = input.minTierFor[input.featureKey];
  return tierRank(input.effectiveTier) >= tierRank(minTier);
}

/** Referral milestone ladder — config-only v1 */
export const REFERRAL_MILESTONES = [
  { key: "scout_badge", qualifiedCount: 1, label: "Scout badge" },
  { key: "attuned_1mo", qualifiedCount: 3, label: "1 month Attuned" },
  { key: "connector_frame", qualifiedCount: 5, label: "Connector frame" },
  { key: "immersed_1mo", qualifiedCount: 10, label: "1 month Immersed" },
  { key: "ambassador_badge", qualifiedCount: 15, label: "Ambassador badge" },
  { key: "immersed_3mo", qualifiedCount: 25, label: "3 months Immersed" },
  { key: "immersed_life", qualifiedCount: 50, label: "Immersed for life" },
] as const;
```

- [ ] **Step 4: Run tests**

```bash
cd packages/plans && bun test
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add packages/plans
git commit -m "feat(plans): add @still/plans entitlement resolver package"
```

---

## Task 2: DB migration — subscription, grants, referrals, feature keys

**Files:**
- Modify: `packages/db/src/schema/profile.ts`
- Create: `packages/db/src/schema/referral.ts`
- Modify: `packages/db/src/schema/plan.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/migrations/0039_subscriptions.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json`
- Modify: `apps/server/src/lib/seed-plan-catalogue.ts`

- [ ] **Step 1: Add profile columns** in `profile.ts`:

```ts
subscriptionTier: text("subscription_tier").default("still").notNull(),
planOverride: text("plan_override"),
polarCustomerId: text("polar_customer_id"),
polarSubscriptionId: text("polar_subscription_id"),
subscriptionInterval: text("subscription_interval"), // month | year
subscriptionStatus: text("subscription_status"), // active | past_due | canceled
referredByUserId: text("referred_by_user_id").references(() => user.id),
referralDiscountRedeemed: boolean("referral_discount_redeemed").default(false).notNull(),
referralCode: text("referral_code").unique(),
```

Keep `isPro` for now (drop in Task 15).

- [ ] **Step 2: Add `key` to `planFeature`**

```ts
key: text("key").notNull().unique(),
```

- [ ] **Step 3: Create `referral.ts` tables** — `planFeatureGrant`, `patronReferral`, `patronReferralReward` per spec.

- [ ] **Step 4: Write SQL migration `0039_subscriptions.sql`** including:

```sql
UPDATE profile SET plan_override = 'immersed' WHERE is_pro = true;
```

- [ ] **Step 5: Register journal entry** `0039_subscriptions`

- [ ] **Step 6: Update `seed-plan-catalogue.ts`** — each `FeatureSeed` gets `key`; insert includes key.

- [ ] **Step 7: Run migration**

```bash
bun run db:migrate
```

- [ ] **Step 8: Commit**

```bash
git add packages/db apps/server/src/lib/seed-plan-catalogue.ts
git commit -m "feat(db): subscription tiers, referrals, plan feature keys"
```

---

## Task 3: Polar env + auth plugin products

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `packages/auth/src/lib/payments.ts`
- Modify: `packages/auth/src/index.ts`
- Modify: `turbo.json` (pass-through env keys)

- [ ] **Step 1: Add env vars**

```ts
POLAR_WEBHOOK_SECRET: optionalNonEmptyString(),
POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),
POLAR_PRODUCT_ATTUNED_MONTHLY: optionalNonEmptyString(),
POLAR_PRODUCT_ATTUNED_YEARLY: optionalNonEmptyString(),
POLAR_PRODUCT_IMMERSED_MONTHLY: optionalNonEmptyString(),
POLAR_PRODUCT_IMMERSED_YEARLY: optionalNonEmptyString(),
POLAR_DISCOUNT_REFERRAL10: optionalNonEmptyString(),
```

- [ ] **Step 2: Fix `payments.ts`**

```ts
export const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: env.POLAR_SERVER === "production" ? "production" : "sandbox",
});
```

- [ ] **Step 3: Populate checkout products** in `buildPolarPlugin()` when all four product env vars present:

```ts
products: [
  { productId: env.POLAR_PRODUCT_ATTUNED_MONTHLY!, slug: "attuned-monthly" },
  { productId: env.POLAR_PRODUCT_ATTUNED_YEARLY!, slug: "attuned-yearly" },
  { productId: env.POLAR_PRODUCT_IMMERSED_MONTHLY!, slug: "immersed-monthly" },
  { productId: env.POLAR_PRODUCT_IMMERSED_YEARLY!, slug: "immersed-yearly" },
],
```

- [ ] **Step 4: Verify types**

```bash
cd packages/auth && bun run check-types
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(auth): wire Polar checkout products and env-driven server"
```

---

## Task 4: Polar webhook → profile subscription sync

**Files:**
- Create: `apps/server/src/lib/polar-product-map.ts`
- Create: `apps/server/src/lib/sync-profile-subscription.ts`
- Create: `apps/server/src/routes/polar-webhook.ts`
- Create: `apps/server/src/routes/polar-webhook.test.ts`
- Modify: `apps/server/src/server/app.ts`

- [ ] **Step 1: Write failing webhook test** with fixture payload mapping product id → `subscription_tier: "attuned"`.

- [ ] **Step 2: Implement `polar-product-map.ts`**

```ts
export function resolveTierFromPolarProduct(productId: string): {
  tier: PlanTierId;
  interval: "month" | "year";
} | null;
```

- [ ] **Step 3: Implement `sync-profile-subscription.ts`** — updates profile by `polarCustomerId` or user id; **never** touches `planOverride`.

- [ ] **Step 4: Implement webhook route** — verify `POLAR_WEBHOOK_SECRET`, handle subscription active/updated/canceled.

- [ ] **Step 5: Run tests**

```bash
cd apps/server && bun test src/routes/polar-webhook.test.ts
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(server): Polar webhook syncs profile subscription tier"
```

---

## Task 5: Public plans API + pricing page

**Files:**
- Create: `apps/server/src/routes/plans-public.ts`
- Create: `apps/web/src/lib/fetch-public-plans.ts`
- Create: `apps/web/src/app/pricing/page.tsx`
- Create: `apps/web/src/components/pricing/pricing-page-client.tsx`

- [ ] **Step 1: `GET /api/plans`** returns tiers from `plan_tier` + features grouped, `purchasable: true` only for attuned/immersed, polar slugs for checkout.

- [ ] **Step 2: Pricing page** — four columns, month/year toggle, Subscribe calls:

```ts
await authClient.checkout({ slug: "attuned-monthly" }); // per @polar-sh/better-auth client API
```

- [ ] **Step 3: Devoted column** — Request invite button (wired in Task 13).

- [ ] **Step 4: Add metadata** in `pricing/page.tsx` for SEO.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): public pricing page and GET /api/plans"
```

---

## Task 6: Patron entitlement propagation (replace `isPro` reads)

**Files:**
- Modify: `apps/server/src/routes/profiles.ts` — return `subscriptionTier`, `planOverride`, `effectiveTier`, `featureGrants[]`
- Create: `apps/web/src/lib/patron-entitlements.ts`
- Create: `apps/web/src/components/plans/use-patron-entitlements.ts`
- Modify: `apps/web/src/app/(app)/layout.tsx`
- Modify: `apps/web/src/app/(app)/me/settings/layout.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx`

- [ ] **Step 1: Server profile payload** includes entitlement fields; compute `effectiveTier` via `@still/plans`.

- [ ] **Step 2: Create hook** `usePatronEntitlements()` → `{ effectiveTier, hasFeature(key) }`.

- [ ] **Step 3: Replace `isPro` prop drilling** with entitlement hook in layout/shell (keep `isPro` shim as `hasFeature("all_themes")` temporarily if needed).

- [ ] **Step 4: Typecheck web**

```bash
cd apps/web && bunx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: propagate patron entitlements from profile API"
```

---

## Task 7: Immersed gates — themes & appearance

**Files:**
- Create: `apps/web/src/components/plans/plan-feature-gate.tsx`
- Modify: `apps/web/src/lib/app-themes.ts` — `appThemeTier === "pro"` → check `all_themes`
- Modify: `apps/server/src/lib/sanitize-appearance-preferences.ts`
- Modify: `apps/web/src/components/profile/me-appearance-settings.tsx`
- Modify: `apps/web/src/components/app/account-menu-theme-picker.tsx`
- Modify: `apps/web/src/components/app/app-theme-shell.tsx`
- Modify: `apps/server/src/routes/profiles.ts` (animated GIF gate → `profile_customization`)

- [ ] **Step 1: `PlanFeatureGate`** — lock card + link `/pricing#immersed`.

- [ ] **Step 2: Replace Pro labels** with **Immersed** in patron-facing copy.

- [ ] **Step 3: Server 403** when saving pro theme without entitlement.

- [ ] **Step 4: Manual verify** — Still user sees locked Ember/Midnight with upsell.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: gate immersed themes and profile customization"
```

---

## Task 8: Attuned feature gates

**Files:**
- Modify: `apps/server/src/lib/watchlist-streaming-alerts.ts` — `watchlist_alerts` not `isPro`
- Modify: profile taste signature components — `taste_signature`
- Modify: `apps/web/src/components/profile/profile-activity-signature.tsx` — `activity_signature`
- Modify: home/catalogue streaming filter components — `streaming_filters`
- Modify: profile stats API/routes — `full_stats`

- [ ] **Step 1: Each surface** wraps with `PlanFeatureGate` or server 403.

- [ ] **Step 2: Tests** for watchlist alerts job skip when not entitled.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: enforce attuned tier feature gates"
```

---

## Task 9: Remaining Immersed gates

**Files:**
- Modify: pinned reviews, list covers, private lists, taste overlap, badge prestige, challenges, leaderboard query

- [ ] **Step 1: `pinned_reviews`** — pin action + strip hidden for Still/Attuned.

- [ ] **Step 2: `private_lists`** — create private / invite collaborator 403.

- [ ] **Step 3: `taste_overlap`** — compare taste sheet upsell.

- [ ] **Step 4: `leaderboard_visibility`** — exclude non-immersed from rank rows in `leaderboard-query.ts`.

- [ ] **Step 5: `badge_prestige` / `challenges`** — enroll/track gates.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: enforce remaining immersed feature gates"
```

---

## Task 10: Settings → Subscription

**Files:**
- Modify: `apps/web/src/lib/me-account-nav.ts`
- Create: `apps/web/src/app/(app)/me/settings/subscription/page.tsx`
- Create: `apps/web/src/components/profile/me-subscription-settings.tsx`

- [ ] **Step 1: Add nav item** `{ href: "/me/settings/subscription", label: "Subscription" }` after Appearance.

- [ ] **Step 2: Page shows** effective tier, interval, status, Manage → `authClient.customer.portal()`.

- [ ] **Step 3: Upgrade CTAs** link to `/pricing#attuned|immersed`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(settings): subscription billing page with Polar portal"
```

---

## Task 11: Staff plan override + feature grants

**Files:**
- Modify: `apps/server/src/routes/staff.ts` — replace `POST .../pro` with `PATCH .../plan` body `{ planOverride, featureGrants }`
- Modify: `apps/web/src/components/staff/staff-user-detail.tsx`
- Modify: `apps/server/src/routes/staff.test.ts`

- [ ] **Step 1: New staff route** sets `planOverride` + syncs `plan_feature_grant` rows.

- [ ] **Step 2: UI** — tier select + grant multi-select (catalogue keys from `GET /api/staff/plan-features`).

- [ ] **Step 3: Audit** `user.plan.override`, `user.plan.grant`.

- [ ] **Step 4: Run staff tests**

```bash
cd apps/server && bun test src/routes/staff.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(staff): plan override and grant-only feature extras"
```

---

## Task 12: Referral capture + qualification

**Files:**
- Create: `apps/web/src/lib/referral-cookie.ts`
- Create: `apps/server/src/lib/referral-capture.ts`
- Create: `apps/server/src/lib/referral-qualify.ts`
- Create: `apps/server/src/lib/referral-milestones.ts`
- Create: `apps/server/src/routes/referrals.ts`
- Modify: sign-up flow / onboarding completion hook

- [ ] **Step 1: Cookie** `still:referral:v1` on `/sign-up?ref=`

- [ ] **Step 2: On sign-up** — set `referredByUserId`, insert `patron_referral` pending; assign `referralCode` on referrer profiles (handle-based or random).

- [ ] **Step 3: On `onboardedAt` set** — call `qualifyReferral(refereeUserId)`; notify referrer; run milestones.

- [ ] **Step 4: Milestone fulfillment** — badges/frames in `preferences.referralRewards`; subscription months via `plan_override` + `patron_referral_reward` audit row.

- [ ] **Step 5: `GET /api/referrals/me`** — link, qualified count, milestone states.

- [ ] **Step 6: Tests** for qualify + self-referral reject.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: referral capture, qualification, and milestone rewards"
```

---

## Task 13: Invite & earn dialog + header button

**Files:**
- Create: `apps/web/src/components/referrals/invite-earn-dialog-root.tsx`
- Create: `apps/web/src/components/referrals/invite-earn-dialog.tsx`
- Modify: `apps/web/src/components/home/home-sticky-chrome.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx` (mount dialog root)

- [ ] **Step 1: Zustand store** `useInviteEarnDialog` — open/close.

- [ ] **Step 2: Dialog UI** — Mobbin layout: headline, URL + copy, milestone rail, how-it-works 3 steps; `APP_MODAL_OVERLAY_CLASS`.

- [ ] **Step 3: Header pill** **Invite & earn** between notifications and avatar; signed-in only.

- [ ] **Step 4: Fetch** `GET /api/referrals/me` on open.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: Invite and earn header button and dialog"
```

---

## Task 14: Devoted request + referee checkout discount

**Files:**
- Create: `apps/server/src/routes/devoted-request.ts`
- Modify: checkout flow to pass referral discount when eligible

- [ ] **Step 1: `POST /api/plans/devoted-request`** — staff notification + `product_event`.

- [ ] **Step 2: Pricing Devoted column** — request button + disclaimer copy.

- [ ] **Step 3: Checkout** — when `referredByUserId && !referralDiscountRedeemed`, apply Polar discount id from env.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: devoted invite request and referral checkout discount"
```

---

## Task 15: Remove `isPro` column

**Files:**
- Create: `packages/db/src/migrations/0040_drop_is_pro.sql`
- Grep-remove remaining `isPro` references

- [ ] **Step 1: Grep** `isPro` / `is_pro` — ensure zero runtime reads.

- [ ] **Step 2: Migration** `ALTER TABLE profile DROP COLUMN is_pro`

- [ ] **Step 3: Update staff tests** and profile types.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: drop deprecated is_pro column"
```

---

## Task 16: Manual QA + Polar sandbox launch checklist

- [ ] Polar sandbox: subscribe Attuned monthly → webhook sets tier → taste signature visible
- [ ] Upgrade to Immersed via portal → themes unlock
- [ ] Cancel → reverts to Still (override untouched)
- [ ] Staff grant `taste_overlap` to Still user → compare taste works
- [ ] Referral: new account via link → verify email → onboarding → referrer gets Scout badge
- [ ] Referee checkout shows 10% off
- [ ] Devoted request appears in staff inbox
- [ ] `graphify update .`

---

## Spec coverage self-review

| Spec section | Task |
|--------------|------|
| `@still/plans` resolver | 1 |
| DB model + is_pro migration | 2, 15 |
| Polar checkout/portal | 3, 10 |
| Webhook sync | 4 |
| GET /api/plans | 5 |
| Feature gates attuned/immersed | 7, 8, 9 |
| `/pricing` | 5 |
| Settings subscription | 10 |
| Invite dialog + header | 13 |
| Staff override + grants | 11 |
| Referrals | 12, 14 |
| Devoted request | 14 |
| Drop isPro | 15 |

---

## Execution order (recommended)

1 → 2 → 3 → 4 → 6 → 7 → 8 → 9 → 5 → 10 → 11 → 12 → 13 → 14 → 15 → 16

Tasks 5 and 6 can swap; gates (7–9) should follow entitlement propagation (6).
