# Sense Subscriptions & Referrals — Design Spec

**Date:** 2026-07-04  
**Status:** Draft — pending human review

---

## Overview

Ship full patron monetization for Sense: **Stripe Checkout + Customer Portal**, tier-aware feature enforcement reading from the existing plan catalogue (`/staff/plans`), a public **pricing page**, **Settings → Subscription** billing management, staff **plan overrides** and **grant-only feature extras**, and a Mobbin-style **Invite & earn** program (header button → dialog).

**Purchasable at launch:** **Attuned** ($3/mo · $24/yr) and **Immersed** ($6/mo · $48/yr).  
**Devoted** ($12/mo · $100/yr) is **not** checkout-enabled — patrons **Request invite** with copy explaining some perks are still in development. Staff grant Devoted via `planOverride`.

**Core diary/social never paywalled** (strategy §12): log, review, follow, comment, import stay on **Still**.

---

## Decisions (brainstorm lock-in)

| Topic | Choice |
|-------|--------|
| Billing integration | Stripe Checkout + Customer Portal (Approach 1) |
| Purchasable tiers | Attuned + Immersed only |
| Devoted | Request-invite CTA; staff grant |
| Feature gates | Full enforcement for every catalogue feature with `buildStatus: "exists"` |
| Staff tier override | `planOverride` nullable enum; **wins** over Stripe |
| `isPro` | Deprecated; migrate `is_pro = true` → `plan_override = 'immersed'` |
| Staff feature control | **Grant-only extras** via `plan_feature_grant`; cannot deny tier-included features |
| Referral success | Sign up + **verify email** + **complete onboarding** (`onboardedAt` set) |
| Referee reward | **10% off first** Attuned or Immersed subscription (Stripe at checkout) |
| Referrer rewards | **Digital + Sense identity perks** (free months + badges/frames) |
| Invite UI | **Invite & earn** pill button in sticky header (right cluster), opens centered dialog — Mobbin parity |

---

## Architecture

```
┌─────────────────┐     Checkout/Portal      ┌──────────────┐
│  apps/web       │ ◄──────────────────────► │    Stripe    │
│  /pricing       │                          └──────┬───────┘
│  /me/settings/  │                                 │ webhooks
│  subscription   │                                 ▼
│  Invite dialog  │     GET /api/plans        ┌──────────────┐
└────────┬────────┘     POST /api/billing/*  │ apps/server  │
         │                                    │ billing.ts   │
         │         @still/plans               │ webhooks     │
         └──────────────────────────────────► │ entitlements │
                                              └──────┬───────┘
                                                     │
                     plan_tier / plan_feature /      ▼
                     plan_feature_tier (catalogue)  profile
                     plan_feature_grant (extras)   patron_referral
```

Shared package **`@still/plans`** (new `packages/plans/`):

- Tier enum + rank
- Stable `PlanFeatureKey` union (matches `plan_feature.key`)
- `resolveEffectiveTier({ subscriptionTier, planOverride })`
- `hasPatronFeature({ effectiveTier, grants, featureKey, catalogue })`
- Referral milestone definitions (read-only config)

Server owns catalogue cache (~5 min TTL). Web imports resolver for client gates; server re-checks on mutating routes.

---

## Data model

### Migration (next journal entry, e.g. `0037_subscriptions.sql`)

**`profile` — new columns**

| Column | Type | Notes |
|--------|------|-------|
| `subscription_tier` | text | `still \| attuned \| immersed \| devoted`; default `still` |
| `plan_override` | text nullable | Staff tier; **wins** over subscription |
| `stripe_customer_id` | text nullable | |
| `stripe_subscription_id` | text nullable | |
| `subscription_interval` | text nullable | `month \| year` |
| `subscription_status` | text nullable | `active \| past_due \| canceled` |
| `referred_by_user_id` | text nullable FK → user | Set at signup from referral link |
| `referral_discount_redeemed` | boolean | Default false; referee 10% used |
| `referral_code` | text unique | Short public code (derived from handle or random); for share URLs |

**`profile` — migration from `is_pro`**

```sql
UPDATE profile SET plan_override = 'immersed' WHERE is_pro = true;
```

Drop `is_pro` in a **follow-up** migration after all reads migrate to entitlements.

**`plan_feature.key`** — new unique slug column; backfill seed rows:

| Key | Min tier (from catalogue) |
|-----|---------------------------|
| `full_stats` | attuned |
| `taste_signature` | attuned |
| `activity_signature` | attuned |
| `streaming_filters` | attuned |
| `watchlist_alerts` | attuned |
| `all_themes` | immersed |
| `profile_customization` | immersed |
| `pinned_reviews` | immersed |
| `list_covers` | immersed |
| `private_lists` | immersed |
| `taste_overlap` | immersed |
| `badge_prestige` | immersed |
| `challenges` | immersed |
| `leaderboard_visibility` | immersed |

Still-tier features (logging, imports, etc.) need keys for catalogue consistency but require no gate.

**`plan_feature_grant`** (grant-only staff extras)

```
user_id       → user.id
feature_key   → text (matches plan_feature.key)
granted_by    → user.id (staff)
granted_at    → timestamp
PRIMARY KEY (user_id, feature_key)
```

**`patron_referral`** (referral tracking)

```
id              cuid pk
referrer_user_id → user.id
referee_user_id  → user.id UNIQUE  -- one referrer per new account
status           pending | qualified | void
qualified_at     timestamp nullable
created_at       timestamp
```

- **pending:** referee signed up with link
- **qualified:** email verified + `onboardedAt` set → increment referrer milestone count, evaluate rewards
- **void:** duplicate/self-referral/fraud (staff tool, v1 manual)

**`patron_referral_reward`** (milestone fulfillment audit)

```
id, user_id, milestone_key, reward_type, fulfilled_at, metadata jsonb
```

---

## Entitlement resolver

```ts
tierRank: still=0, attuned=1, immersed=2, devoted=3

effectiveTier = planOverride ?? subscriptionTier ?? 'still'

hasPatronFeature(user, featureKey):
  if featureKey in user.grants → true
  minTier = lowest tier rank assigned to featureKey in catalogue
  return tierRank(effectiveTier) >= minTier
```

**Grant-only:** grants add access; they never remove tier-implied access.

**Upsell pattern:** `PlanFeatureGate` wrapper — entitled children OR lock card with tier name + link to `/pricing#attuned|immersed`.

Replace all `isPro` / `appThemeTier === "pro"` checks with immersed-tier feature keys (`all_themes`, `profile_customization`). Rename theme tier label in UI from **Pro** → **Immersed** where patron-facing.

---

## Feature gates (v1 — all `exists` in catalogue)

### Attuned

| Feature | Gate surface |
|---------|----------------|
| Full stats | Profile/year stats beyond annual snapshot; API 403 for on-demand ranges |
| Taste signature | Hide headline on profile + OG for non-Attuned |
| Activity signature | Heatmap hidden + upsell on profile |
| Streaming filters | Catalogue/home streaming provider filter chips |
| Watchlist alerts | Settings toggle + `watchlist-streaming-alerts.ts` job (replace `isPro` check) |

### Immersed

| Feature | Gate surface |
|---------|----------------|
| All themes | Ember/Midnight + future immersed themes |
| Profile customization | Accent + banner frame pickers |
| Pinned reviews | Pin action + strip |
| List covers | Custom cover upload |
| Private lists & collaboration | Create private / invite collaborator |
| Taste overlap | Compare taste UI on profiles |
| Badge prestige | Prestige badge unlocks beyond volume milestones |
| Completionist challenges | Enroll + track (unjoined preview may stay for Still) |
| Leaderboard visibility | Exclude from rank rows; can still view board |

Animated GIF uploads map to **`profile_customization`** (immersed).

---

## Stripe integration

### Environment (`packages/env`)

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ATTUNED_MONTHLY`, `STRIPE_PRICE_ATTUNED_YEARLY`
- `STRIPE_PRICE_IMMERSED_MONTHLY`, `STRIPE_PRICE_IMMERSED_YEARLY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (if needed)

Create Stripe Coupon **`REFERRAL_10`** (10% once) applied when `referred_by_user_id` set and `referral_discount_redeemed = false`.

### Routes (Elysia)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/plans` | Public | Tiers, features, prices, `purchasable` flag |
| POST | `/api/billing/checkout` | Session | `{ tier, interval }` → Checkout URL |
| POST | `/api/billing/portal` | Session | Customer Portal URL |
| POST | `/api/billing/webhook` | Stripe sig | Sync subscription state |
| POST | `/api/plans/devoted-request` | Session | Devoted invite request → staff notification |
| GET | `/api/referrals/me` | Session | Link, counts, milestone progress, rewards earned |
| POST | `/api/referrals/qualify` | Internal/cron | Called when onboarding completes (or inline in onboarding flow) |

### Webhook events

- `checkout.session.completed` → set customer/subscription IDs, tier from price map, `subscription_status = active`, mark `referral_discount_redeemed` if coupon used
- `customer.subscription.updated` → tier + status sync
- `customer.subscription.deleted` → `subscription_tier = still`, clear subscription fields (keep `plan_override` if staff-set)
- `invoice.payment_failed` → `past_due`

**Precedence:** Webhooks never overwrite `plan_override`. Effective tier always uses override when present.

### Referrer reward fulfillment

Milestone rewards that grant subscription time:

- Prefer **Stripe Customer Balance** credit OR extend subscription via Stripe API when referrer has active sub
- Fallback: set time-limited `plan_override` with expiry metadata in `patron_referral_reward.metadata` for users without Stripe customer

Identity perks (badges, frames): grant via `plan_feature_grant` or dedicated `preferences.referralRewards` + profile badge slot.

---

## Referral program

### Referral link

```
https://{appOrigin}/sign-up?ref={referralCode}
```

- Persist `ref` in cookie (`still:referral:v1`, 30-day TTL) through sign-up
- On account creation: set `referred_by_user_id`, insert `patron_referral` status `pending`
- Reject self-referral (same user/email)

### Qualification trigger

When referee satisfies **all**:

1. Better Auth email verified
2. `profile.onboardedAt` is set (onboarding wizard complete)

→ Set referral `qualified`, increment referrer's qualified count, run milestone evaluator, notify referrer (in-app notification).

### Referee benefit

**10% off first paid subscription** (Attuned or Immersed, monthly or annual) — single use, applied automatically at Checkout when eligible.

### Referrer milestone ladder (launch)

| Qualified referrals | Reward |
|--------------------|--------|
| 1 | **Scout badge** — profile flair visible to all |
| 3 | **1 month Attuned** — subscription credit |
| 5 | **Connector frame** — exclusive banner frame (referral perk) |
| 10 | **1 month Immersed** |
| 15 | **Ambassador badge** |
| 25 | **3 months Immersed** |
| 50 | **Immersed for life** — permanent `plan_override = immersed` (staff-audited; recorded in `patron_referral_reward`) |

Milestones are **cumulative one-time unlocks** (not repeatable). Staff can adjust ladder in config file v1; admin UI deferred.

Copy in dialog: *"Give friends 10% off their first Attuned or Immersed plan when they join Sense."*

---

## Patron-facing UI

### `/pricing` (public, indexable)

- Four columns from `GET /api/plans`
- Monthly / annual toggle
- **Still:** "Free forever"
- **Attuned / Immersed:** Subscribe → Checkout (signed-out → sign-in → return)
- **Devoted:** feature list + **Request invite** button + dev disclaimer
- Deep links: `/pricing#attuned`, `#immersed`, `#devoted`

### Settings → Subscription (`/me/settings/subscription`)

- New sidebar item in `ME_ACCOUNT_NAV_ITEMS` (after Appearance)
- Current effective tier, interval, status badge
- **Manage subscription** → Stripe Portal
- Upgrade CTA when below Immersed
- Compact referral summary + "Invite friends" opens same dialog

### Invite & earn dialog (Mobbin-style)

**Trigger:** pill button **Invite & earn** in `HomeStickyChrome` right cluster — **between** `HomeNotificationsMenu` and account avatar. Signed-in only; hidden unsigned.

**Dialog** (centered modal, `APP_MODAL_OVERLAY_CLASS` z-index above drawers):

1. Headline: *Invite friends and earn rewards*
2. Subcopy: 10% off for friends + milestone rewards
3. Referral URL field + **Copy link** (inline checkmark on success)
4. Horizontal milestone rail (icons + labels + progress state: locked / next / earned)
5. **How it works** — 3 steps:
   - Copy and share your link
   - Friend signs up, verifies email, finishes onboarding
   - You unlock rewards at each milestone

Mount dialog root once in app shell (same pattern as search dialog). Button also reachable from Settings → Subscription.

**Scope v1:** `HomeStickyChrome` routes (home, diary, watchlist, lists, profile). Movie/TV detail top bars: follow-up if needed.

### Upsell components

- `PlanFeatureGate` — shared lock + CTA
- Settings Appearance: locked tiles show **Immersed** badge
- Account menu theme picker: same

---

## Staff UI

### User detail (`staff-user-detail.tsx`)

Replace **Pro toggle** with:

- **Plan override** select: None / Still / Attuned / Immersed / Devoted
- **Feature grants** multi-select (catalogue keys; grant-only)
- Audit: `user.plan.override`, `user.plan.grant`, `user.plan.revoke-grant`

### Devoted requests

- Inbox row or Staff tab filter for `devoted.request` events
- Action: set `plan_override = devoted`

### Referrals (read-only v1)

- User detail: referred-by, qualified referral count, milestones earned

---

## Testing & rollout

### Automated

- `@still/plans` unit tests: tier rank, override precedence, grant stacking
- Webhook handler tests with fixture payloads
- Referral qualification: pending → qualified on onboard; self-referral rejected
- Migration: `is_pro` → `plan_override`

### Manual QA

- Subscribe Attuned monthly → upgrade Immersed → Portal cancel
- Staff override devoted while subscribed
- Staff grant single feature above tier
- Full gate walk: Still user hits upsell on taste signature, themes, etc.
- Referral: new account via link → verify → onboard → referrer milestone
- Referee first checkout shows 10% discount
- Devoted request → staff notification

### Launch

Stripe **test mode** until QA pass, then live keys.

---

## Out of scope (v1)

- Devoted checkout
- Physical referral prizes / shipping
- Per-feature **deny** toggles for staff
- Global feature kill-switch in `/staff/plans`
- Native app billing
- Tax/VAT automation beyond Stripe defaults
- Referral fraud ML (manual void only)
- Movie/TV detail header invite button (unless trivial extract)

---

## File map (implementation hint)

| Area | Path |
|------|------|
| Shared entitlements | `packages/plans/` |
| DB schema | `packages/db/src/schema/profile.ts`, `plan.ts`, new referral tables |
| Billing routes | `apps/server/src/routes/billing.ts` |
| Public plans API | `apps/server/src/routes/plans-public.ts` |
| Referrals | `apps/server/src/routes/referrals.ts`, `lib/referral-qualify.ts` |
| Pricing page | `apps/web/src/app/pricing/page.tsx` |
| Subscription settings | `apps/web/src/app/(app)/me/settings/subscription/page.tsx` |
| Invite dialog | `apps/web/src/components/referrals/invite-earn-dialog.tsx` |
| Header button | `apps/web/src/components/home/home-sticky-chrome.tsx` |
| Feature gate | `apps/web/src/components/plans/plan-feature-gate.tsx` |

---

## Relationship to existing specs

- Extends [`2026-06-20-staff-plans-page-design.md`](./2026-06-20-staff-plans-page-design.md) — catalogue remains source of truth; this spec adds enforcement + billing
- Supersedes `isPro` semantics in [`2026-05-22-app-themes-design.md`](./2026-05-22-app-themes-design.md) and [`2026-05-29-sense-theme-display-names-design.md`](./2026-05-29-sense-theme-display-names-design.md) — patron-facing **Immersed** replaces **Pro**
- [`2026-06-08-staff-user-info-and-management-design.md`](./2026-06-08-staff-user-info-and-management-design.md) — Pro toggle replaced by plan override + grants
