# Discord Activity Pro Funding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Announce Discord activity as a Pro-funded perk with live public Polar-paid progress, Settings/Pricing teasers while production is off, and Attuned+ gating when production is on — without auto-unlocking on count alone or changing the mobile support campaign.

**Architecture:** Public `GET /api/discord-activity/funding` returns `{ current, target, productionEnabled }` from a cached Polar-paid subscriber count + `isDiscordActivityEnabled()`. Shared `DiscordActivityFundingStrip` mounts on Pricing and Settings. `PlanFeatureKey` `discord_activity` (Attuned+) gates Connect and profile activity when production is live. Support campaign dialog stays unchanged; What's New + changelog queue behind it.

**Tech Stack:** Elysia, Drizzle/Neon, `@still/plans`, Bun tests, Next.js App Router, existing `cachedRead` Redis helper.

**Spec:** [`docs/superpowers/specs/2026-08-11-discord-activity-pro-funding-design.md`](../specs/2026-08-11-discord-activity-pro-funding-design.md)

## Global Constraints

- Progress counts **paying Polar only** (`polar_subscription_id` non-empty + `subscription_status` in `active` | `past_due`); **exclude** override-only Pro.
- Hitting `target` does **not** enable Connect — only `isDiscordActivityEnabled()` does.
- When live, Discord activity is for **all Pro** (Attuned+), **not** Still.
- Keep `SENSE_SUPPORT_CAMPAIGN_*` and support dialog behavior unchanged.
- Surface depth: no decorative borders/rings/shadows on the funding strip; canvas-on-card tokens.
- Windows PowerShell: chain with `;`, not `&&`.
- One Executor task per human **go**; prefer subagent-driven execution.
- Import motion from `motion/react` if any animation is added; respect `prefers-reduced-motion` (instant bar fill).
- Do not commit unless the human asks (plan commit steps are optional / when requested).

## File map

| File | Responsibility |
|------|----------------|
| `packages/plans/src/index.ts` | Add `discord_activity` feature key + min tier |
| `packages/env/src/server.ts` | Optional `DISCORD_ACTIVITY_PRO_TARGET` |
| `apps/server/src/lib/discord-activity-pro-target.ts` | Parse target (default 50) |
| `apps/server/src/lib/count-polar-paying-subscribers.ts` | Aggregate count query |
| `apps/server/src/lib/discord-activity-funding.ts` | Build funding payload + cache |
| `apps/server/src/routes/discord-activity-funding.ts` | Public GET route |
| `apps/server/src/server/app.ts` | Register route |
| `apps/server/src/routes/me-discord.ts` | Pro gate when production on; status fields for Settings |
| `apps/server/src/lib/fetch-profile-discord-activity.ts` | Hide activity unless owner has `discord_activity` |
| `apps/server/src/lib/seed-plan-catalogue.ts` | Seed `discord_activity` as `planned` on Attuned+ |
| `apps/web/src/lib/discord-activity-funding.ts` | Client types + fetch helper |
| `apps/web/src/components/discord/discord-activity-funding-strip.tsx` | Shared strip UI |
| `apps/web/src/components/pricing/pricing-page-client.tsx` | Mount strip |
| `apps/web/src/app/pricing/page.tsx` | Pass `canManagePolarBilling` already; strip fetches client-side |
| `apps/web/src/components/profile/me-discord-connect.tsx` | Teaser / Pro connect / Still locked |
| `apps/web/src/components/plans/plan-feature-gate.tsx` | Label for `discord_activity` |
| `apps/web/src/lib/whats-new-releases.ts` | Slide (queues behind support campaign) |
| `apps/web/src/lib/product-changelog.ts` | Matching release entry |

---

### Task 1: `discord_activity` plan feature key

**Files:**
- Modify: `packages/plans/src/index.ts`
- Modify: `packages/plans/src/entitlements.test.ts`
- Modify: `apps/web/src/components/plans/plan-feature-gate.tsx`
- Test: `packages/plans/src/entitlements.test.ts`

**Interfaces:**
- Produces: `PlanFeatureKey` includes `"discord_activity"`; `MIN_TIER_FOR_FEATURE.discord_activity === "attuned"`

- [ ] **Step 1: Write failing assertion**

In `packages/plans/src/entitlements.test.ts`, extend the local `minTierFor` maps / `MIN_TIER_FOR_FEATURE` tests to expect Attuned for Discord:

```ts
test("discord_activity requires attuned", () => {
	expect(MIN_TIER_FOR_FEATURE.discord_activity).toBe("attuned");
	expect(
		hasPatronFeatureForTier({
			effectiveTier: "still",
			grants: [],
			featureKey: "discord_activity",
		}),
	).toBe(false);
	expect(
		hasPatronFeatureForTier({
			effectiveTier: "attuned",
			grants: [],
			featureKey: "discord_activity",
		}),
	).toBe(true);
});
```

- [ ] **Step 2: Run test — expect FAIL** (key missing)

```powershell
cd packages/plans; bun test src/entitlements.test.ts
```

- [ ] **Step 3: Implement**

In `packages/plans/src/index.ts`:

```ts
export type PlanFeatureKey =
	| "full_stats"
	// ...existing keys...
	| "leaderboard_visibility"
	| "discord_activity";

export const MIN_TIER_FOR_FEATURE: Record<PlanFeatureKey, PlanTierId> = {
	// ...existing...
	leaderboard_visibility: "still",
	discord_activity: "attuned",
};
```

Update every exhaustive `Record<PlanFeatureKey, …>` (entitlements test local maps, `PLAN_FEATURE_LABELS` in `plan-feature-gate.tsx`):

```ts
discord_activity: "Discord activity",
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
cd packages/plans; bun test src/entitlements.test.ts
```

- [ ] **Step 5: Commit (only if human asks)**

```bash
git add packages/plans apps/web/src/components/plans/plan-feature-gate.tsx
git commit -m "feat(plans): add discord_activity Attuned feature key"
```

---

### Task 2: Pro target env + helper

**Files:**
- Modify: `packages/env/src/server.ts`
- Create: `apps/server/src/lib/discord-activity-pro-target.ts`
- Create: `apps/server/src/lib/discord-activity-pro-target.test.ts`

**Interfaces:**
- Produces: `getDiscordActivityProTarget(): number` — default **50** when unset/invalid; positive int from `DISCORD_ACTIVITY_PRO_TARGET`

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, test } from "bun:test";
import { parseDiscordActivityProTarget } from "./discord-activity-pro-target";

describe("parseDiscordActivityProTarget", () => {
	test("defaults to 50", () => {
		expect(parseDiscordActivityProTarget(undefined)).toBe(50);
		expect(parseDiscordActivityProTarget("")).toBe(50);
		expect(parseDiscordActivityProTarget("nope")).toBe(50);
		expect(parseDiscordActivityProTarget("0")).toBe(50);
		expect(parseDiscordActivityProTarget("-3")).toBe(50);
	});
	test("parses positive integers", () => {
		expect(parseDiscordActivityProTarget("100")).toBe(100);
		expect(parseDiscordActivityProTarget(" 75 ")).toBe(75);
	});
});
```

- [ ] **Step 2: Run — expect FAIL**

```powershell
cd apps/server; bun test src/lib/discord-activity-pro-target.test.ts
```

- [ ] **Step 3: Implement**

`packages/env/src/server.ts` (near Discord vars):

```ts
/** Public funding bar target — counting Polar-paid Pro toward Discord VPS. */
DISCORD_ACTIVITY_PRO_TARGET: optionalNonEmptyString(),
```

`discord-activity-pro-target.ts`:

```ts
import { env } from "@still/env/server";

export const DISCORD_ACTIVITY_PRO_TARGET_DEFAULT = 50;

export function parseDiscordActivityProTarget(
	raw: string | undefined,
): number {
	if (raw == null) return DISCORD_ACTIVITY_PRO_TARGET_DEFAULT;
	const n = Number.parseInt(raw.trim(), 10);
	if (!Number.isFinite(n) || n < 1) return DISCORD_ACTIVITY_PRO_TARGET_DEFAULT;
	return n;
}

export function getDiscordActivityProTarget(): number {
	return parseDiscordActivityProTarget(env.DISCORD_ACTIVITY_PRO_TARGET);
}
```

- [ ] **Step 4: Run — expect PASS**

```powershell
cd apps/server; bun test src/lib/discord-activity-pro-target.test.ts
```

---

### Task 3: Count Polar-paying subscribers (TDD)

**Files:**
- Create: `apps/server/src/lib/count-polar-paying-subscribers.ts`
- Create: `apps/server/src/lib/count-polar-paying-subscribers.test.ts`

**Interfaces:**
- Produces: `isPolarPayingSubscriptionStatus(status: string | null | undefined): boolean`
- Produces: `countPolarPayingSubscribers(): Promise<number>` — SQL aggregate; no PII

Pure status helper is unit-tested without DB. Count function uses Drizzle against `profile`.

- [ ] **Step 1: Failing pure-helper tests**

```ts
import { describe, expect, test } from "bun:test";
import { isPolarPayingSubscriptionStatus } from "./count-polar-paying-subscribers";

describe("isPolarPayingSubscriptionStatus", () => {
	test("active and past_due count", () => {
		expect(isPolarPayingSubscriptionStatus("active")).toBe(true);
		expect(isPolarPayingSubscriptionStatus("past_due")).toBe(true);
	});
	test("canceled / empty / other do not", () => {
		expect(isPolarPayingSubscriptionStatus("canceled")).toBe(false);
		expect(isPolarPayingSubscriptionStatus(null)).toBe(false);
		expect(isPolarPayingSubscriptionStatus("")).toBe(false);
		expect(isPolarPayingSubscriptionStatus("trialing")).toBe(false);
	});
});
```

- [ ] **Step 2: Run — expect FAIL**

```powershell
cd apps/server; bun test src/lib/count-polar-paying-subscribers.test.ts
```

- [ ] **Step 3: Implement**

```ts
import { db, profile } from "@still/db";
import { and, count, isNotNull, ne, or, sql } from "drizzle-orm";

const PAYING = new Set(["active", "past_due"]);

export function isPolarPayingSubscriptionStatus(
	status: string | null | undefined,
): boolean {
	if (status == null) return false;
	return PAYING.has(status.trim().toLowerCase());
}

/** Profiles with a real Polar subscription id and paying status — ignores plan_override-only Pro. */
export async function countPolarPayingSubscribers(): Promise<number> {
	const [row] = await db
		.select({ c: count() })
		.from(profile)
		.where(
			and(
				isNotNull(profile.polarSubscriptionId),
				ne(profile.polarSubscriptionId, ""),
				or(
					sql`lower(${profile.subscriptionStatus}) = 'active'`,
					sql`lower(${profile.subscriptionStatus}) = 'past_due'`,
				),
			),
		);
	return row?.c ?? 0;
}
```

(Adjust Drizzle `or`/`sql` to match repo style if `eq` + `inArray` on lowered status is cleaner — keep behavior identical.)

- [ ] **Step 4: Run pure tests — PASS**

```powershell
cd apps/server; bun test src/lib/count-polar-paying-subscribers.test.ts
```

---

### Task 4: Funding payload + public route

**Files:**
- Create: `apps/server/src/lib/discord-activity-funding.ts`
- Create: `apps/server/src/lib/discord-activity-funding.test.ts`
- Create: `apps/server/src/routes/discord-activity-funding.ts`
- Create: `apps/server/src/routes/discord-activity-funding.test.ts`
- Modify: `apps/server/src/server/app.ts` — `.use(discordActivityFundingRoute)` near `meDiscordRoute`

**Interfaces:**
- Produces:

```ts
export type DiscordActivityFundingPayload = {
	current: number;
	target: number;
	productionEnabled: boolean;
};

export async function getDiscordActivityFundingPayload(): Promise<DiscordActivityFundingPayload>;
```

- Cache key: `cache:discord-activity:funding:v1` TTL **60** via `cachedRead` + `cacheRedis()`
- Route: `GET /api/discord-activity/funding` — **no auth**

- [ ] **Step 1: Unit-test payload shape with mocks**

Mock `countPolarPayingSubscribers`, `getDiscordActivityProTarget`, `isDiscordActivityEnabled` so tests do not need Neon:

```ts
test("maps count + target + production flag", async () => {
	// after mocks: current 12, target 50, productionEnabled false
	const payload = await getDiscordActivityFundingPayload();
	expect(payload).toEqual({
		current: 12,
		target: 50,
		productionEnabled: false,
	});
});
```

- [ ] **Step 2: Implement `getDiscordActivityFundingPayload`**

```ts
export async function getDiscordActivityFundingPayload(): Promise<DiscordActivityFundingPayload> {
	const redis = await cacheRedis();
	return cachedRead(redis, "cache:discord-activity:funding:v1", 60, async () => {
		const [current, target, productionEnabled] = await Promise.all([
			countPolarPayingSubscribers(),
			Promise.resolve(getDiscordActivityProTarget()),
			Promise.resolve(isDiscordActivityEnabled()),
		]);
		return { current, target, productionEnabled };
	});
}
```

Note: `productionEnabled` must not be stuck stale for 60s after ops flip — either (a) exclude flag from cache and only cache `current`, or (b) use a short TTL and document ops wait. **Prefer (a):**

```ts
const current = await cachedRead(redis, "cache:discord-activity:funding-count:v1", 60, () =>
	countPolarPayingSubscribers(),
);
return {
	current,
	target: getDiscordActivityProTarget(),
	productionEnabled: isDiscordActivityEnabled(),
};
```

- [ ] **Step 3: Route**

```ts
import { Elysia } from "elysia";
import { getDiscordActivityFundingPayload } from "../lib/discord-activity-funding";

export const discordActivityFundingRoute = new Elysia({
	prefix: "/api/discord-activity",
	tags: ["discord-activity"],
}).get("/funding", async () => getDiscordActivityFundingPayload());
```

Register in `app.ts`.

- [ ] **Step 4: Route test** — `build` with no auth; expect 200 JSON keys only `current|target|productionEnabled`; values are numbers/boolean.

```powershell
cd apps/server; bun test src/lib/discord-activity-funding.test.ts src/routes/discord-activity-funding.test.ts
```

---

### Task 5: Pro gate when production is on

**Files:**
- Modify: `apps/server/src/routes/me-discord.ts`
- Modify: `apps/server/src/routes/me-discord.test.ts`
- Modify: `apps/server/src/lib/fetch-profile-discord-activity.ts`
- Modify: `apps/server/src/lib/fetch-profile-discord-activity.test.ts`
- Optionally harden: Discord OAuth callback / finish-setup already 404 when flag off — add Pro check when on

**Interfaces:**
- Status when production **on** adds `canUseDiscordActivity: boolean` (patronHasPlanFeature `discord_activity`).
- `POST /discord/finish-setup` and `DELETE /discord` return **403** `planFeatureRequiredBody("discord_activity", …)` when Still.
- Profile activity: if owner lacks `discord_activity`, return `{ visible: false }` (same as disconnected).

- [ ] **Step 1: Extend me-discord tests**

Cases:
1. Feature off → `featureEnabled: false` (unchanged shape + optional `canUseDiscordActivity: false`).
2. Feature on + Still entitlements → `featureEnabled: true`, `canUseDiscordActivity: false`; finish-setup → 403 with `PLAN_FEATURE_REQUIRED`.
3. Feature on + Attuned → `canUseDiscordActivity: true`; finish-setup proceeds (mock link status).

- [ ] **Step 2: Implement gates**

In status handler after `isDiscordActivityEnabled()` true:

```ts
const entitlements = await loadPatronEntitlements(user.id);
const canUse = patronHasPlanFeature(entitlements, "discord_activity");
return {
	featureEnabled: true as const,
	canUseDiscordActivity: canUse,
	...linkStatus,
};
```

In finish-setup / delete: if `!canUse` return `status(403, planFeatureRequiredBody("discord_activity", "Discord activity is included with Pro"))`.

In `fetchProfileDiscordActivity`, after metadata load, `loadPatronEntitlements(ownerUserId)` — if `!patronHasPlanFeature(..., "discord_activity")` return `{ visible: false }`.

- [ ] **Step 3: Run**

```powershell
cd apps/server; bun test src/routes/me-discord.test.ts src/lib/fetch-profile-discord-activity.test.ts
```

- [ ] **Step 4: Web type** — update `MeDiscordStatusResponse` in `apps/web/src/lib/me-discord-api.ts`:

```ts
canUseDiscordActivity?: boolean;
```

---

### Task 6: Funding strip UI + client fetch

**Files:**
- Create: `apps/web/src/lib/discord-activity-funding.ts`
- Create: `apps/web/src/lib/discord-activity-funding-progress.ts`
- Create: `apps/web/src/lib/discord-activity-funding-progress.test.ts`
- Create: `apps/web/src/components/discord/discord-activity-funding-strip.tsx`

**Interfaces:**
- `fetchDiscordActivityFunding(): Promise<DiscordActivityFundingPayload | null>`
- `clampFundingProgress(current, target) => { ratio: number; labelCurrent: number; labelTarget: number }` — ratio in `[0,1]`

- [ ] **Step 1: Progress helper tests**

```ts
test("clamps ratio at 1 when over target", () => {
	expect(clampFundingProgress(80, 50).ratio).toBe(1);
	expect(clampFundingProgress(80, 50).labelCurrent).toBe(80);
});
test("zero target safe", () => {
	expect(clampFundingProgress(5, 0).ratio).toBe(0);
});
```

- [ ] **Step 2: Implement fetch + clamp**

```ts
// discord-activity-funding.ts
export type DiscordActivityFundingPayload = {
	current: number;
	target: number;
	productionEnabled: boolean;
};

export async function fetchDiscordActivityFunding(): Promise<DiscordActivityFundingPayload | null> {
	const res = await fetch(`${stillApiOrigin()}/api/discord-activity/funding`, {
		credentials: "omit",
	});
	if (!res.ok) return null;
	return (await res.json()) as DiscordActivityFundingPayload;
}
```

- [ ] **Step 3: Strip component**

Props:

```ts
{
	funding: DiscordActivityFundingPayload | null;
	loading?: boolean;
	/** When true, primary CTA opens portal / manage — Pricing passes canManagePolarBilling */
	canManageBilling?: boolean;
	className?: string;
}
```

Behavior:
- If `funding?.productionEnabled` → return `null` (unmount).
- If `loading` → short skeleton (no fake `0 of T` bar).
- If `funding == null` → title + body + CTA; text **Progress unavailable** (no bar).
- Else progressbar:

```tsx
<div
	role="progressbar"
	aria-valuemin={0}
	aria-valuenow={Math.min(funding.current, funding.target)}
	aria-valuemax={funding.target}
	aria-label={`${funding.current} of ${funding.target} Pro members`}
>
```

Copy (locked tone):
- Title: `Discord activity for Pro`
- Body: `Listening and Playing on your profile — ships for every Pro member once Sense can fund the presence server.`
- CTA: `Support with Pro` → `Link` `/pricing` (or `Manage plan` button when `canManageBilling`).

Chrome: `rounded-2xl bg-card` / inner `bg-background` track for the bar fill with `bg-foreground/80`; **no** border/ring/shadow. Prefer CSS width `%` without motion; if animating width, disable under `prefers-reduced-motion`.

- [ ] **Step 4: Run**

```powershell
cd apps/web; bun test src/lib/discord-activity-funding-progress.test.ts
```

---

### Task 7: Mount strip on Pricing

**Files:**
- Modify: `apps/web/src/components/pricing/pricing-page-client.tsx`
- Modify: `apps/web/src/app/pricing/page.tsx` only if RSC prefetch is desired (optional — client fetch in strip parent is enough)

- [ ] **Step 1:** Add a small client island or fetch inside `PricingPageClient` on mount:

```tsx
const [funding, setFunding] = useState<DiscordActivityFundingPayload | null>(null);
const [fundingLoading, setFundingLoading] = useState(true);

useEffect(() => {
	let cancelled = false;
	void fetchDiscordActivityFunding().then((payload) => {
		if (cancelled) return;
		setFunding(payload);
		setFundingLoading(false);
	});
	return () => {
		cancelled = true;
	};
}, []);
```

Render **above** the tier grid:

```tsx
<DiscordActivityFundingStrip
	funding={funding}
	loading={fundingLoading}
	canManageBilling={canManagePolarBilling}
	className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8"
/>
```

- [ ] **Step 2: Manual check** — unsigned `/pricing` shows bar; with `DISCORD_ACTIVITY_ENABLED` + infra mock in local, strip disappears.

- [ ] **Step 3:** Catalogue row — add seed in Task 8; Pricing already shows `comingSoon` from `buildStatus === "planned"`. No hardcode needed if seed runs.

---

### Task 8: Settings three-state Discord card + seed catalogue

**Files:**
- Modify: `apps/web/src/components/profile/me-discord-connect.tsx`
- Modify: `apps/server/src/lib/seed-plan-catalogue.ts`
- Run seed locally / document re-seed for staging

**Seed entry** (Attuned section in `FEATURES`):

```ts
{
	key: "discord_activity",
	name: "Discord activity",
	description:
		"Show Listening / Playing from Discord on your profile and account menu. Requires Sense's presence server — included with Pro once funded and live.",
	buildStatus: "planned",
	tiers: ["attuned", "immersed", "devoted"],
},
```

**Settings states:**

1. Fetch funding + (if `productionEnabled`) status in parallel.
2. **`!productionEnabled`:** render `MeSettingsPanel` with `DiscordActivityFundingStrip` (omit Connect). Do **not** `return null`.
3. **`productionEnabled && !canUseDiscordActivity`:** locked copy — `Included with Pro` + Link to `/pricing`. No `linkSocial`.
4. **`productionEnabled && canUseDiscordActivity`:** existing Connect / toggle UI.

Update early returns: remove `if (!status?.featureEnabled) return null`.

- [ ] **Step 1: Implement UI branches**
- [ ] **Step 2: Re-seed** so Pricing lists Discord as Coming soon — call `seedPlanCatalogue()` via the existing server seed entrypoint used for plans (search repo for `seedPlanCatalogue` import; if only a one-off script, run that). Confirm Attuned+ shows **Discord activity** with Coming soon.

- [ ] **Step 3: Human QA** — Settings while flag off shows teaser; Still + flag on shows lock; Pro + flag on shows Connect.

---

### Task 9: What's New + changelog

**Files:**
- Modify: `apps/web/src/lib/whats-new-releases.ts`
- Modify: `apps/web/src/lib/product-changelog.ts`
- Modify: `apps/web/src/lib/product-changelog.test.ts` if it asserts newest id

**Note:** While `SENSE_SUPPORT_CAMPAIGN_ENABLED === true`, patrons see the support campaign instead of What's New. Still ship the slide + changelog so they appear when the campaign is turned off.

- [ ] **Step 1: Bump What's New**

```ts
export const CURRENT_WHATS_NEW_RELEASE: WhatsNewRelease = {
	id: "2026-08-11-discord-activity-pro",
	fullReleaseHref: "/changelog",
	slides: [
		{
			title: "Discord activity for Pro",
			description:
				"Listening and Playing on profiles is coming for every Pro member once enough paid plans fund the presence server. See live progress on Pricing.",
		},
	],
};
```

- [ ] **Step 2: Prepend changelog release** (bump `versionLabel` consistently with latest — check current top entry and increment patch).

```ts
{
	id: "2026-08-11-discord-activity-pro",
	versionLabel: "0.3.3",
	dateLabel: "August 11, 2026",
	headline: "Discord activity for Pro",
	summary:
		"Fund the presence server with Pro — live progress on Pricing; ships for every Pro member when production is ready.",
	items: [
		{
			title: "Pro funding progress",
			body: "Pricing and Settings show how many paying Pro members are toward the Discord activity goal. Connect stays off until the presence server is live.",
		},
		{
			title: "Pro perk",
			body: "When Discord activity turns on, it's included with Attuned and above — not on the free Still plan.",
		},
	],
},
```

- [ ] **Step 3: Run changelog tests if any**

```powershell
cd apps/web; bun test src/lib/product-changelog.test.ts src/lib/whats-new-seen.test.ts
```

---

### Task 10: Verification checklist

- [ ] **Server tests**

```powershell
cd apps/server; bun test src/lib/discord-activity-pro-target.test.ts src/lib/count-polar-paying-subscribers.test.ts src/lib/discord-activity-funding.test.ts src/routes/discord-activity-funding.test.ts src/routes/me-discord.test.ts src/lib/fetch-profile-discord-activity.test.ts
```

- [ ] **Web tests**

```powershell
cd apps/web; bun test src/lib/discord-activity-funding-progress.test.ts src/lib/product-changelog.test.ts
```

- [ ] **Manual**
  1. Unsigned `/pricing` — funding strip + Coming soon Discord on Attuned+.
  2. Settings (flag off) — teaser, no Connect.
  3. Support campaign still opens (unchanged).
  4. With flag+infra on + Still — Settings locked; API finish-setup 403.
  5. With flag+infra on + Pro — Connect works; strip unmounted.
  6. Confirm count ignores `plan_override` without Polar id (staff grant fixture or SQL check).

- [ ] **Ops unlock day** (document only — not code): VPS → env → `DISCORD_ACTIVITY_ENABLED=true` → set plan feature `buildStatus` to `exists` (staff UI or seed flip) → smoke Pro Connect.

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Public live progress Polar-paid only | 3, 4 |
| Target tunable / default 50 | 2 |
| productionEnabled = isDiscordActivityEnabled | 4 |
| No auto-unlock on count | 4 (flag separate), 5–8 |
| Pricing strip + Coming soon | 7, 8 seed |
| Settings teaser / Pro / Still | 8 |
| Pro gate Connect + profile activity | 5 |
| What's New + changelog behind support campaign | 9 |
| Support campaign unchanged | (no task touches it) |
| better-interface progress a11y / no borders | 6 |

## Placeholder scan

No TBD / “implement later” left. Commit steps are optional pending human ask.
