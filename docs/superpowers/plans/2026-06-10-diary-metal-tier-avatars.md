# Diary Metal Tier Avatars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show silver / gold / chromatic liquid-metal avatar rings (with glow) for patrons at 100 / 500 / 1,000+ diary logs everywhere avatars appear, with static ring fallback under reduced motion or software GPU.

**Architecture:** Server resolves `diaryMetalTier` from non-removed log counts via shared helpers; list endpoints batch-count user ids. Web wraps `PatronPortraitAvatar` in `PatronPortraitWithMetalTier` using `metal-fx` when effects are allowed.

**Tech Stack:** Elysia + Drizzle (`apps/server`), Next.js App Router + `metal-fx` (`apps/web`), `bun:test`.

**Spec:** `docs/superpowers/specs/2026-06-10-diary-metal-tier-avatars-design.md`

---

## Conventions

- Thresholds: **100 silver**, **500 gold**, **1000 chromatic** — total `log` rows, `removed_at IS NULL`
- Type: `DiaryMetalTier = "silver" | "gold" | "chromatic"`
- Tests: `bun test path/to/file.test.ts`
- After code changes: `graphify update .` (if CLI available)
- Do **not** commit unless the human asks

---

## File structure

**Create:**
- `apps/server/src/lib/diary-metal-tier.ts`
- `apps/server/src/lib/diary-metal-tier.test.ts`
- `apps/web/src/lib/diary-metal-tier.ts`
- `apps/web/src/lib/diary-metal-tier.test.ts`
- `apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx`

**Modify:**
- `apps/web/package.json` — add `metal-fx`
- `apps/server/src/lib/profile-media.ts` — extend `serializePatronProfileForClient`
- `apps/server/src/lib/profile-media.test.ts` — tier serialization tests
- `apps/server/src/routes/profiles.ts` — profile GET + search batch tiers
- `apps/server/src/routes/feed.ts` — batch tiers on feed rows
- `apps/server/src/lib/feed-items.ts` — pass counts into serializer (if needed)
- `apps/server/src/lib/feed-rating-divergence.ts` — divergence patron tiers
- `apps/server/src/lib/leaderboard-query.ts` (or route) — leaderboard tiers
- `apps/server/src/lib/creator-recognition.ts` — curator spotlight tiers
- `apps/server/src/lib/movie-following-ratings.ts` — following rating tiers
- `apps/server/src/lib/follow-list.ts` (or follows route) — follows drawer tiers
- Session/layout path that supplies nav user — add `diaryMetalTier` for viewer
- All `PatronPortraitAvatar` call sites listed in spec (~20 files) — swap to wrapper + prop

---

## Task 1: Server tier resolver + batch counts

**Files:**
- Create: `apps/server/src/lib/diary-metal-tier.ts`
- Create: `apps/server/src/lib/diary-metal-tier.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, test } from "bun:test";
import { resolveDiaryMetalTier } from "./diary-metal-tier";

describe("resolveDiaryMetalTier", () => {
	test("no tier below 100", () => {
		expect(resolveDiaryMetalTier(0)).toBeNull();
		expect(resolveDiaryMetalTier(99)).toBeNull();
	});
	test("silver at 100", () => {
		expect(resolveDiaryMetalTier(100)).toBe("silver");
		expect(resolveDiaryMetalTier(499)).toBe("silver");
	});
	test("gold at 500", () => {
		expect(resolveDiaryMetalTier(500)).toBe("gold");
		expect(resolveDiaryMetalTier(999)).toBe("gold");
	});
	test("chromatic at 1000+", () => {
		expect(resolveDiaryMetalTier(1000)).toBe("chromatic");
		expect(resolveDiaryMetalTier(5000)).toBe("chromatic");
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/server && bun test src/lib/diary-metal-tier.test.ts`

- [ ] **Step 3: Implement**

```ts
import { db, log } from "@still/db";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";

export type DiaryMetalTier = "silver" | "gold" | "chromatic";

export function resolveDiaryMetalTier(logsCount: number): DiaryMetalTier | null {
	if (logsCount >= 1000) return "chromatic";
	if (logsCount >= 500) return "gold";
	if (logsCount >= 100) return "silver";
	return null;
}

/** Batch diary log counts for avatar tier hydration — one query per page. */
export async function fetchDiaryLogCountsForUserIds(
	userIds: readonly string[],
): Promise<Map<string, number>> {
	const unique = [...new Set(userIds.filter(Boolean))];
	const map = new Map<string, number>();
	if (unique.length === 0) return map;

	const rows = await db
		.select({
			userId: log.userId,
			c: sql<number>`count(*)::int`,
		})
		.from(log)
		.where(and(inArray(log.userId, unique), isNull(log.removedAt)))
		.groupBy(log.userId);

	for (const row of rows) {
		map.set(row.userId, Number(row.c ?? 0));
	}
	return map;
}

export function diaryMetalTierForUserId(
	userId: string,
	counts: Map<string, number>,
): DiaryMetalTier | null {
	return resolveDiaryMetalTier(counts.get(userId) ?? 0);
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit** (only if human requested)

---

## Task 2: Extend patron profile serializer

**Files:**
- Modify: `apps/server/src/lib/profile-media.ts`
- Modify: `apps/server/src/lib/profile-media.test.ts`

- [ ] **Step 1: Add failing test for `diaryMetalTier`**

```ts
import { serializePatronProfileForClient } from "./profile-media";

test("serializePatronProfileForClient includes diaryMetalTier", () => {
	expect(
		serializePatronProfileForClient(
			{ handle: "a", displayName: "A", preferences: {} },
			150,
		),
	).toEqual({
		handle: "a",
		displayName: "A",
		avatarIsAnimated: false,
		diaryMetalTier: "silver",
	});
});
```

- [ ] **Step 2: Update signature**

```ts
export function serializePatronProfileForClient(
	profile: { handle: string; displayName: string; preferences?: ... } | null | undefined,
	logsCount = 0,
): { handle: string; displayName: string; avatarIsAnimated: boolean; diaryMetalTier: DiaryMetalTier | null } | null
```

Import `resolveDiaryMetalTier` from `./diary-metal-tier`.

- [ ] **Step 3: Fix all call sites of `serializePatronProfileForClient`** — pass `0` until batch wired, or pass count from map

Run: `cd apps/server && bun test src/lib/profile-media.test.ts`

---

## Task 3: Profile GET + search tiers

**Files:**
- Modify: `apps/server/src/routes/profiles.ts`

- [ ] **Step 1:** On `GET /api/profiles/:handle`, after resolving `targetUserId`, query single-user log count (or reuse filmography path if a count already exists) and attach `diaryMetalTier` to response (`profile.diaryMetalTier` or top-level).

- [ ] **Step 2:** On profile search results, collect all `userId`s from hits → `fetchDiaryLogCountsForUserIds` → map tier into each result row.

- [ ] **Step 3:** Manual smoke: patron with ≥100 logs returns `"diaryMetalTier": "silver"`.

---

## Task 4: Feed + divergence tiers

**Files:**
- Modify: `apps/server/src/routes/feed.ts`
- Modify: `apps/server/src/lib/feed-items.ts`
- Modify: `apps/server/src/lib/feed-rating-divergence.ts`

- [ ] **Step 1:** After assembling feed rows, collect actor `userId`s from log/review/list/divergence payloads.

- [ ] **Step 2:** `fetchDiaryLogCountsForUserIds` once per page.

- [ ] **Step 3:** When mapping rows to JSON, pass count into `serializePatronProfileForClient` or set `profile.diaryMetalTier` directly.

- [ ] **Step 4:** Same batch pattern for divergence patron entries.

---

## Task 5: Remaining API surfaces

**Files:** leaderboard, curator spotlights, follows, following ratings, review payloads, session user enrich

- [ ] **Step 1:** For each endpoint listed in spec, batch-count patron ids on the page and attach `diaryMetalTier`.

- [ ] **Step 2:** Grep `serializePatronProfileForClient` and `PatronPortraitAvatar` data sources — ensure no surface missing tier.

Run: `cd apps/server && bun test` (affected tests)

---

## Task 6: Install metal-fx + web tier tokens

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/diary-metal-tier.ts`
- Create: `apps/web/src/lib/diary-metal-tier.test.ts`

- [ ] **Step 1: Install**

Run: `cd apps/web && bun add metal-fx`

- [ ] **Step 2: Web mirror**

```ts
export type DiaryMetalTier = "silver" | "gold" | "chromatic";

export const DIARY_METAL_STRENGTH: Record<DiaryMetalTier, number> = {
	silver: 0.75,
	gold: 0.85,
	chromatic: 0.95,
};

/** Static ring when shader fallback is active — decorative only. */
export function diaryMetalStaticRingClass(tier: DiaryMetalTier): string {
	switch (tier) {
		case "silver":
			return "ring-2 ring-zinc-300/80";
		case "gold":
			return "ring-2 ring-amber-400/85";
		case "chromatic":
			return "ring-2 ring-[linear-gradient(135deg,#a78bfa,#22d3ee,#f472b6)]";
		default: {
			const _exhaustive: never = tier;
			return _exhaustive;
		}
	}
}
```

Tune ring classes after visual QA — no box-shadow per design system (use ring only).

- [ ] **Step 3: Test strength map exports**

---

## Task 7: `PatronPortraitWithMetalTier` wrapper

**Files:**
- Create: `apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx`

- [ ] **Step 1: Implement client component**

```tsx
"use client";

import { MetalFx } from "metal-fx";
import { cn } from "@still/ui/lib/utils";
import {
	PatronPortraitAvatar,
	type PatronPortraitAvatarProps,
} from "@/components/profile/patron-portrait-avatar";
import {
	type DiaryMetalTier,
	DIARY_METAL_STRENGTH,
	diaryMetalStaticRingClass,
} from "@/lib/diary-metal-tier";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

export type PatronPortraitWithMetalTierProps = PatronPortraitAvatarProps & {
	diaryMetalTier?: DiaryMetalTier | null;
};

export function PatronPortraitWithMetalTier({
	diaryMetalTier,
	className,
	...avatarProps
}: PatronPortraitWithMetalTierProps) {
	const reducedMotion = usePrefersReducedMotion();
	const softwareGpu = useSoftwareGpuRendering();
	const useShader = Boolean(diaryMetalTier) && !reducedMotion && !softwareGpu;

	if (!diaryMetalTier) {
		return <PatronPortraitAvatar className={className} {...avatarProps} />;
	}

	if (!useShader) {
		return (
			<span
				className={cn(
					"inline-flex rounded-full",
					diaryMetalStaticRingClass(diaryMetalTier),
					className,
				)}
			>
				<PatronPortraitAvatar className="size-full rounded-full" {...avatarProps} />
			</span>
		);
	}

	return (
		<MetalFx
			preset={diaryMetalTier}
			variant="circle"
			strength={DIARY_METAL_STRENGTH[diaryMetalTier]}
			className={cn("inline-flex rounded-full", className)}
		>
			<PatronPortraitAvatar className="size-full rounded-full" {...avatarProps} />
		</MetalFx>
	);
}
```

- [ ] **Step 2:** If `use-prefers-reduced-motion.ts` missing, add minimal hook (copy from animated-profile-media plan or use `matchMedia`).

- [ ] **Step 3:** Visual QA on `/home` feed + profile hero (rounded-2xl case — adjust wrapper if circle preset clips).

---

## Task 8: Migrate call sites

**Files:** (grep `PatronPortraitAvatar` in `apps/web`)

- [ ] **Step 1:** Replace import + component; pass `diaryMetalTier={profile?.diaryMetalTier ?? null}` (adjust path per payload).

Priority files:
- `feed-person-avatar.tsx` — extend `FeedPerson.profile.diaryMetalTier`
- `nav-user-avatar.tsx` + app shell session
- `app-user-account-menu.tsx`
- `profile-patron-header.tsx`
- `search-dialog-people-row.tsx`
- `home-leaderboard-row.tsx`, `home-leaderboard-podium.tsx`
- `home-curator-spotlights.tsx`
- `home-friend-activity-rail.tsx`
- `profile-follows-drawer.tsx`
- `movie-detail-following-ratings.tsx`
- `movie-detail-reviews-carousel.tsx`
- `review-detail-sheet.tsx`
- `patron-watch-ledger-panel.tsx`

- [ ] **Step 2:** Update TypeScript types on feed/search/session shapes in web (`FeedPerson`, search hit types, etc.)

- [ ] **Step 3:** Run `cd apps/web && bun run build` — fix type errors

---

## Task 9: Verification

- [ ] **Step 1:** Server tests — `bun test apps/server/src/lib/diary-metal-tier.test.ts apps/server/src/lib/profile-media.test.ts`

- [ ] **Step 2:** Web tests — `bun test apps/web/src/lib/diary-metal-tier.test.ts`

- [ ] **Step 3:** Manual — patron ≥100 logs: silver ring in feed + nav; toggle reduced motion → static ring; verify &lt;100 has no ring

---

## Plan self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| Thresholds 100/500/1000 | Task 1 |
| Batch counts, no N+1 | Tasks 1, 4, 5 |
| `diaryMetalTier` on all payloads | Tasks 2–5 |
| metal-fx + glow + strengths | Tasks 6–7 |
| Reduced motion + software GPU fallback | Task 7 |
| App-wide avatar migration | Task 8 |
| Pro independent | No code — verify Pro chip unchanged |
| Out of scope items | Not in plan |

No placeholders remain.

---

## Execution handoff

**Plan saved to:** `docs/superpowers/plans/2026-06-10-diary-metal-tier-avatars.md`

**Spec saved to:** `docs/superpowers/specs/2026-06-10-diary-metal-tier-avatars-design.md`

**Two execution options:**

1. **Subagent-driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline execution** — implement task-by-task in this session with checkpoints

Which approach do you want?
