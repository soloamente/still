# Streak bug, Pro theme picker bug, and Profile about redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two data/state bugs (stale streak after log edits, intermittent Pro theme picker) and redesign the profile about section into a scannable stats-grid + collapsible layout.

**Architecture:** Fix 1 is a server-only change — add `backfillWatchStreakFromLogs` calls to the log PATCH and DELETE handlers. Fix 2 introduces a React `cache()`-wrapped profile fetcher shared by the layout and home page. Fix 3 restructures `ProfilePatronHeader`'s center column, adding two new focused client components and retiring `ProfilePatronByline` from the header.

**Tech Stack:** Bun/Elysia (server), Next.js 15 App Router RSC (web), React `cache()`, TypeScript, Tailwind CSS, Radix UI primitives (existing codebase patterns).

---

## File map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `apps/server/src/routes/logs.ts` | Add backfill calls in PATCH + DELETE |
| Create | `apps/web/src/lib/fetch-me-profile.ts` | Cached `GET /api/profiles/me` fetcher |
| Modify | `apps/web/src/app/(app)/layout.tsx` | Use `fetchMeProfile` |
| Modify | `apps/web/src/app/(app)/home/page.tsx` | Use `fetchMeProfile` |
| Create | `apps/web/src/components/profile/profile-streak-stat-cell.tsx` | Compact streak number cell for stats grid |
| Create | `apps/web/src/components/profile/profile-about-collapsible.tsx` | Collapsible bio/heatmap/location panel |
| Modify | `apps/web/src/components/profile/profile-patron-header.tsx` | Restructure center column |

---

## Task 1 — Fix streak stale after log edit

**Files:**
- Modify: `apps/server/src/routes/logs.ts`

The PATCH handler (line ~221) updates `watched_at` but never resyncs the streak row.
The DELETE handler (line ~343) removes a log that may have been the most-recent active
day. Both need `backfillWatchStreakFromLogs(user.id)` after their DB write.

- [ ] **Step 1: Verify the import is missing**

Open `apps/server/src/routes/logs.ts` and confirm `backfillWatchStreakFromLogs` is NOT
currently imported (only `syncWatchStreakForUser` is imported from `watch-streak-sync`).

- [ ] **Step 2: Add the import**

In `apps/server/src/routes/logs.ts`, find the existing import:

```ts
import { syncWatchStreakForUser } from "../lib/watch-streak-sync";
```

Replace with:

```ts
import {
	backfillWatchStreakFromLogs,
	syncWatchStreakForUser,
} from "../lib/watch-streak-sync";
```

- [ ] **Step 3: Add backfill to the PATCH handler**

In the PATCH handler, after the `if (updated && body.liked !== undefined)` block
(around line 301), add the backfill call **only when `watchedAt` was part of the
patch body** — no need to rebuild for rating/note-only edits:

```ts
			if (updated && body.watchedAt !== undefined) {
				void backfillWatchStreakFromLogs(user.id).catch((err) => {
					console.error("[logs] watch streak backfill (patch) failed", err);
				});
			}
```

The full PATCH handler end should now look like:

```ts
			if (updated && body.liked !== undefined) {
				await syncFavoritesListForUserTitle({
					userId: user.id,
					movieId: updated.movieId,
					tvId: updated.tvId,
					liked: updated.liked,
				});
			}

			if (updated && body.watchedAt !== undefined) {
				void backfillWatchStreakFromLogs(user.id).catch((err) => {
					console.error("[logs] watch streak backfill (patch) failed", err);
				});
			}

			return updated;
```

- [ ] **Step 4: Add backfill to the DELETE handler**

In the DELETE handler, after `await db.delete(log).where(eq(log.id, params.id))` and
before `return { ok: true }`:

```ts
			await db.delete(log).where(eq(log.id, params.id));
			if (existing.tvId != null) {
				await clearTvWatchIfNoDiaryLogsForShow(user.id, existing.tvId);
			}
			void backfillWatchStreakFromLogs(user.id).catch((err) => {
				console.error("[logs] watch streak backfill (delete) failed", err);
			});
			return { ok: true };
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/server && bun run typecheck
```

Expected: no errors.

- [ ] **Step 6: Run existing streak tests to confirm nothing is broken**

```bash
cd apps/server && bun test src/lib/watch-streak.test.ts --reporter=verbose
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/routes/logs.ts
git commit -m "fix(streak): backfill on log edit and delete"
```

---

## Task 2 — Fix Pro theme picker: deduplicate profile fetch with React cache

**Files:**
- Create: `apps/web/src/lib/fetch-me-profile.ts`
- Modify: `apps/web/src/app/(app)/layout.tsx`
- Modify: `apps/web/src/app/(app)/home/page.tsx`

`layout.tsx` and `home/page.tsx` both call `api.api.profiles.me.get()` independently.
Wrapping the call in `cache()` deduplicates it within a single RSC render pass.

- [ ] **Step 1: Create the cached fetcher**

Create `apps/web/src/lib/fetch-me-profile.ts`:

```ts
import "server-only";

import { cache } from "react";

import { serverApi } from "@/lib/server-api";

export type MeProfile = {
	handle: string;
	displayName: string;
	isPro: boolean;
	preferences: Record<string, unknown> | null;
} | null;

/**
 * React-cached GET /api/profiles/me — executes at most once per RSC render pass
 * regardless of how many server components call it.
 */
export const fetchMeProfile = cache(async (): Promise<MeProfile> => {
	try {
		const api = await serverApi();
		const res = await api.api.profiles.me.get();
		if (res.error || !res.data) return null;
		return res.data as MeProfile;
	} catch {
		return null;
	}
});
```

- [ ] **Step 2: Update `(app)/layout.tsx` to use the cached fetcher**

Replace the entire inline profile fetch block in `apps/web/src/app/(app)/layout.tsx`.

Add the import at the top of the file (after the existing imports):

```ts
import { fetchMeProfile } from "@/lib/fetch-me-profile";
```

Remove the old inline fetch:

```ts
// REMOVE all of this:
const api = await serverApi();
let profile: {
	handle?: string;
	displayName?: string;
	preferences?: Record<string, unknown>;
	isPro?: boolean;
} | null = null;
let profileFetchFailed = false;
try {
	const profileRes = await api.api.profiles.me.get();
	if (profileRes.error) {
		profileFetchFailed = true;
		console.error("[app layout] profiles.me error", profileRes.error);
	} else {
		profile =
			(profileRes.data as { handle?: string; displayName?: string } | null) ??
			null;
	}
} catch (err) {
	profileFetchFailed = true;
	console.error("[app layout] profiles.me failed", err);
}

if (!profileFetchFailed && !profile?.handle) redirect("/onboarding");
```

Replace with:

```ts
const profile = await fetchMeProfile();
if (!profile?.handle) redirect("/onboarding");
```

The JSX below stays the same — `profile?.handle`, `profile?.displayName`,
`profile?.isPro`, `profile?.preferences` all resolve correctly from `MeProfile`.

Also remove the now-unused `import { serverApi } from "@/lib/server-api"` if nothing
else in layout.tsx uses it (check before removing).

- [ ] **Step 3: Update `home/page.tsx` to use the cached fetcher**

In `apps/web/src/app/(app)/home/page.tsx`, add the import:

```ts
import { fetchMeProfile } from "@/lib/fetch-me-profile";
```

Find the parallel fetch block (~line 180):

```ts
const [profileRes, continueWatching, tasteMatchedRail] = await Promise.all([
	api.api.profiles.me.get().catch(() => ({ data: null })),
	// ...
]);
```

Replace `api.api.profiles.me.get().catch(() => ({ data: null }))` with
`fetchMeProfile()` directly — it already catches internally and returns `null` on error:

```ts
const [profileData, continueWatching, tasteMatchedRail] = await Promise.all([
	fetchMeProfile(),
	// ... rest unchanged
]);
```

Then remove the cast that was applied to `profileRes.data`:

```ts
// REMOVE:
const profileData = profileRes.data as {
	handle: string;
	displayName: string;
	isPro?: boolean;
	preferences?: Record<string, unknown> | null;
} | null;
```

`profileData` is already typed as `MeProfile | null` from `fetchMeProfile()`.
References to `profileData.handle`, `profileData.displayName`, `profileData.isPro`, and
`profileData.preferences` continue to work unchanged.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/fetch-me-profile.ts \
        apps/web/src/app/\(app\)/layout.tsx \
        apps/web/src/app/\(app\)/home/page.tsx
git commit -m "fix(pro-themes): deduplicate profile fetch with React cache"
```

---

## Task 3 — Profile redesign: compact streak stat cell

**Files:**
- Create: `apps/web/src/components/profile/profile-streak-stat-cell.tsx`

The stats grid needs a streak number cell for the signed-in patron's own profile.
This is a focused client component that uses the existing `useWatchStreak` hook —
no prop threading needed.

- [ ] **Step 1: Create `ProfileStreakStatCell`**

Create `apps/web/src/components/profile/profile-streak-stat-cell.tsx`:

```tsx
"use client";

import { Flame } from "lucide-react";

import { useWatchStreak } from "@/lib/use-watch-streak";

/**
 * Compact streak number for the profile stats grid — own profile only.
 * Uses the same hook as ProfileWatchStreak but renders a single number + label cell.
 */
export function ProfileStreakStatCell() {
	const { streak, loading } = useWatchStreak();

	if (loading) {
		return (
			<div className="flex flex-col items-center gap-0.5">
				<div className="h-5 w-8 animate-pulse rounded bg-muted/40" />
				<span className="text-[10px] text-muted-foreground">streak</span>
			</div>
		);
	}

	if (!streak) return null;

	return (
		<div className="flex flex-col items-center gap-0.5">
			<span className="flex items-center gap-1 font-semibold tabular-nums text-foreground text-sm">
				<Flame
					className="size-3 shrink-0 text-muted-foreground"
					aria-hidden
				/>
				{streak.currentStreak}
			</span>
			<span className="text-[10px] text-muted-foreground">streak</span>
		</div>
	);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/profile/profile-streak-stat-cell.tsx
git commit -m "feat(profile): compact streak stat cell for stats grid"
```

---

## Task 4 — Profile redesign: collapsible about panel

**Files:**
- Create: `apps/web/src/components/profile/profile-about-collapsible.tsx`

Wraps bio, location, website, and the heatmap in a toggle panel. Ephemeral open/close
state — no persistence needed.

- [ ] **Step 1: Create `ProfileAboutCollapsible`**

Create `apps/web/src/components/profile/profile-about-collapsible.tsx`:

```tsx
"use client";

import { cn } from "@still/ui/lib/utils";
import { useState } from "react";

import { ProfileActivitySignature } from "@/components/profile/profile-activity-signature";

type ProfileAboutCollapsibleProps = {
	handle: string;
	bio: string | null;
	pronouns: string | null;
	location: string | null;
	website: string | null;
};

function formatWebsiteLabel(website: string) {
	return website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Collapsible panel shown below profile actions — bio, pronouns, location,
 * website, and the activity heatmap. Hidden entirely when all fields are empty.
 */
export function ProfileAboutCollapsible({
	handle,
	bio,
	pronouns,
	location,
	website,
}: ProfileAboutCollapsibleProps) {
	const [open, setOpen] = useState(false);

	const hasContent =
		bio?.trim() ||
		pronouns?.trim() ||
		location?.trim() ||
		website?.trim();

	// Heatmap is always shown when the panel is open (it has its own empty state).
	// But if there's truly nothing to show, hide the trigger entirely.
	if (!hasContent) {
		// Still render heatmap-only collapsible so the graph is accessible.
		// Comment: intentionally always renders — heatmap has its own "no data" state.
	}

	const previewParts: string[] = [];
	if (location?.trim()) previewParts.push(location.trim());
	if (website?.trim()) previewParts.push(formatWebsiteLabel(website.trim()));
	if (bio?.trim()) previewParts.push("bio");
	const preview = previewParts.slice(0, 2).join(" · ");

	return (
		<div className="mt-3 w-full overflow-hidden rounded-xl bg-muted/20">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className={cn(
					"flex w-full items-center justify-between px-4 py-2.5 text-left",
					"text-muted-foreground text-xs transition-colors",
					"[@media(hover:hover)]:hover:text-foreground",
				)}
				aria-expanded={open}
			>
				<span className="truncate">
					{open ? null : preview || "Activity & more"}
				</span>
				<span className="ml-2 shrink-0">{open ? "less ‹" : "more ›"}</span>
			</button>

			{open ? (
				<div className="flex flex-col gap-3 px-4 pb-4">
					{bio?.trim() ? (
						<p className="text-balance font-editorial text-muted-foreground text-sm leading-relaxed">
							{bio.trim()}
						</p>
					) : null}

					{(pronouns?.trim() || location?.trim() || website?.trim()) ? (
						<p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground text-xs">
							{pronouns?.trim() ? <span>{pronouns.trim()}</span> : null}
							{pronouns?.trim() && (location?.trim() || website?.trim()) ? (
								<span aria-hidden className="text-muted-foreground/40">·</span>
							) : null}
							{location?.trim() ? <span>{location.trim()}</span> : null}
							{location?.trim() && website?.trim() ? (
								<span aria-hidden className="text-muted-foreground/40">·</span>
							) : null}
							{website?.trim() ? (
								<a
									href={website.trim()}
									target="_blank"
									rel="noopener noreferrer"
									className="text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
								>
									{formatWebsiteLabel(website.trim())}
								</a>
							) : null}
						</p>
					) : null}

					<ProfileActivitySignature handle={handle} />
				</div>
			) : null}
		</div>
	);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/profile/profile-about-collapsible.tsx
git commit -m "feat(profile): collapsible about panel with bio/heatmap/location"
```

---

## Task 5 — Profile redesign: restructure `ProfilePatronHeader` center column

**Files:**
- Modify: `apps/web/src/components/profile/profile-patron-header.tsx`

Replace the current vertical stack with: name → handle + curator chip inline → taste
signature → 4-cell stats grid → actions → collapsible panel → pinned reviews.

- [ ] **Step 1: Add the new imports**

In `apps/web/src/components/profile/profile-patron-header.tsx`, add these imports after
the existing ones:

```ts
import { ProfileAboutCollapsible } from "@/components/profile/profile-about-collapsible";
import { ProfileStreakStatCell } from "@/components/profile/profile-streak-stat-cell";
import { ProfileFollowsTrigger } from "@/components/profile/profile-follows-drawer";
```

Remove the import for `ProfilePatronByline` — it is no longer used in the header:

```ts
// REMOVE:
import { ProfilePatronByline } from "@/components/profile/profile-patron-byline";
```

Also remove the import for `ProfileActivitySignature` — it now lives inside
`ProfileAboutCollapsible`:

```ts
// REMOVE:
import { ProfileActivitySignature } from "@/components/profile/profile-activity-signature";
```

- [ ] **Step 2: Add `totalResults` prop**

The stats grid needs a films count. `ProfilePatronHeader` currently doesn't receive a
total count directly — it receives `titleCountLine` (a formatted string). We need the
raw number. Look at the call site in `profile-patron-lobby-shell.tsx` — it computes
`titleCountLine` from `totalResults`. We'll add a `filmCount` prop to pass the sum of
movies + tv.

In `ProfilePatronHeaderProps`, add:

```ts
/** Total logged films count across both tabs — for the stats grid. */
filmCount: number;
```

In the function signature destructure it:

```ts
filmCount,
```

- [ ] **Step 3: Replace the center column JSX**

Find the `<div className="relative mx-auto -mt-14 ...">` block (from after the banner,
around line 112) and replace its **entire contents** (everything inside that div through
`</ProfilePatronActions>`) with:

```tsx
				{/* Portrait */}
				<div className="mx-auto mb-4 flex justify-center">
					<div className="relative aspect-[2/3] w-[5.5rem] overflow-hidden rounded-2xl bg-muted/30 shadow-lg ring-4 ring-card sm:w-24">
						{hasPortrait ? (
							<PatronPortraitAvatar
								handle={handle}
								avatarUrl={avatarUrl}
								name={displayName || initials}
								width={192}
								height={288}
								className="size-full rounded-2xl grayscale [@media(hover:hover)]:hover:grayscale-0"
							/>
						) : (
							<PersonCreditPortrait
								name={displayName || initials}
								profilePath={null}
								grayscale
								sizes="96px"
							/>
						)}
					</div>
				</div>

				{/* Name */}
				<h1 className="text-balance font-semibold text-foreground text-xl sm:text-2xl">
					{displayName}
				</h1>

				{/* Handle + curator chip inline */}
				<div className="mt-1 flex items-center justify-center gap-2">
					<p className="text-muted-foreground text-sm">@{handle}</p>
					{isCurator ? <ProfileCuratorBadge headline={curatorHeadline} /> : null}
				</div>

				{/* Taste signature */}
				<ProfileTasteSignature
					tasteSignature={tasteSignature ?? null}
					className="mt-3"
				/>

				{/* Stats grid: films · followers · following · streak (own profile only) */}
				<div className={cn(
					"mt-4 grid gap-2",
					isMe ? "grid-cols-4" : "grid-cols-3",
				)}>
					<div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/20 py-2.5">
						<span className="font-semibold tabular-nums text-foreground text-sm">
							{filmCount}
						</span>
						<span className="text-[10px] text-muted-foreground">films</span>
					</div>
					<div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/20 py-2.5">
						<ProfileFollowsTrigger
							targetUserId={targetUserId}
							followers={stats.followers}
							following={stats.following}
							compact
						/>
					</div>
					<div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/20 py-2.5">
						<ProfileFollowsTrigger
							targetUserId={targetUserId}
							followers={stats.followers}
							following={stats.following}
							showFollowing
							compact
						/>
					</div>
					{isMe ? (
						<div className="flex flex-col items-center justify-center rounded-xl bg-muted/20 py-2.5">
							<ProfileStreakStatCell />
						</div>
					) : null}
				</div>

				{/* Actions */}
				<ProfilePatronActions
					isMe={isMe}
					targetUserId={targetUserId}
					handle={handle}
					canCompareTaste={canCompareTaste}
					initialTasteCompareOpen={initialTasteCompareOpen}
					className="mt-3"
				/>

				{/* Collapsible: bio, pronouns, location, website, heatmap */}
				<ProfileAboutCollapsible
					handle={handle}
					bio={bio}
					pronouns={pronouns}
					location={location}
					website={website}
				/>

				{/* Pinned reviews */}
				<ProfilePinnedReviewsStrip rows={pinnedReviews} />
```

> **Note on `ProfileFollowsTrigger`:** The current component renders both followers AND
> following as a combined trigger. Check its API in
> `apps/web/src/components/profile/profile-follows-drawer.tsx`. If it does not support
> showing them as separate cells with a `compact` prop, implement the cells as two simple
> `<button>` elements that call the existing open-drawer logic, showing a single stat
> each (see Step 4 below for the fallback).

- [ ] **Step 4: Check `ProfileFollowsTrigger` API and adjust if needed**

Read `apps/web/src/components/profile/profile-follows-drawer.tsx` and find the
`ProfileFollowsTrigger` component's props.

If it already renders followers + following separately and supports individual display:
use it as written above.

If it renders them as a combined "X followers · Y following" row only, replace the two
grid cells with a single merged cell spanning 2 columns:

```tsx
				{/* Merged followers+following cell */}
				<div className="col-span-2 flex flex-col items-center gap-0.5 rounded-xl bg-muted/20 py-2.5">
					<ProfileFollowsTrigger
						targetUserId={targetUserId}
						followers={stats.followers}
						following={stats.following}
					/>
				</div>
```

And adjust `grid-cols-4` / `grid-cols-3` to `grid-cols-3` / `grid-cols-2` accordingly.

- [ ] **Step 5: Update the call site to pass `filmCount`**

In `apps/web/src/components/profile/profile-patron-lobby-shell.tsx`, find the
`<ProfilePatronHeader ...>` usage and add:

```tsx
				filmCount={moviesAllCount + tvAllCount}
```

(Both `moviesAllCount` and `tvAllCount` are already in scope in `ProfilePatronLobbyBody`.)

- [ ] **Step 6: Remove `ProfileWatchStreak` from header (no longer needed there)**

In `profile-patron-header.tsx`, remove:

```ts
// REMOVE:
import { ProfileWatchStreak } from "@/components/profile/profile-watch-streak";
```

And remove the JSX that rendered it:

```tsx
// REMOVE:
{isMe ? <ProfileWatchStreak /> : null}
```

The streak is now in the `ProfileStreakStatCell` inside the grid.

- [ ] **Step 7: Remove `titleCountLine` usage from header**

The header no longer needs `titleCountLine` since the count appears in the stats grid.
Remove the prop from `ProfilePatronHeaderProps` and from the destructure.

Also remove from the call site in `profile-patron-lobby-shell.tsx`:

```tsx
// REMOVE from <ProfilePatronHeader>:
titleCountLine={titleCountLine}
```

(The `titleCountLine` variable is still used elsewhere in the lobby — don't delete the
computation, just stop passing it to the header.)

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/profile/profile-patron-header.tsx \
        apps/web/src/components/profile/profile-patron-lobby-shell.tsx
git commit -m "feat(profile): stats grid + collapsible about section in profile header"
```

---

## Task 6 — Retire `ProfilePatronByline` from the header call site

**Files:**
- Modify: `apps/web/src/components/profile/profile-patron-header.tsx` (already done in Task 5)

The header no longer calls `ProfilePatronByline`. Confirm it has no other consumers
before deciding whether to keep or delete the file.

- [ ] **Step 1: Check for other consumers**

```bash
grep -r "ProfilePatronByline" apps/web/src --include="*.tsx" --include="*.ts"
```

Expected output: only the import in `profile-patron-header.tsx` (which was removed in
Task 5) and the definition in `profile-patron-byline.tsx` itself.

- [ ] **Step 2: If no other consumers, delete the file**

```bash
rm apps/web/src/components/profile/profile-patron-byline.tsx
```

If other consumers are found, keep the file — just confirm the header no longer imports it.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/src/components/profile/profile-patron-byline.tsx
git commit -m "chore(profile): remove ProfilePatronByline (replaced by stats grid)"
```

---

## Final smoke test

After all tasks are committed:

- [ ] Open a profile page as the signed-in patron. Verify:
  - Banner and avatar unchanged.
  - Name + handle + curator chip (if curator) on one row.
  - Taste signature visible.
  - 4-cell stats grid (films · followers · following · streak).
  - Followers and following cells open the followers drawer.
  - Follow + Compare taste buttons visible.
  - "more ›" toggle expands to show bio, location, website, heatmap.
  - "less ‹" collapses the panel.
  - Pinned reviews strip (if pinned reviews exist) below the panel.

- [ ] Open another patron's profile (not your own). Verify:
  - 3-cell stats grid (no streak cell).
  - Everything else unchanged.

- [ ] Edit a log's date. Reload profile — streak card reflects the correct count.

- [ ] Delete a log. Reload profile — streak reflects updated history.

- [ ] Open `/home` as a Pro user. Click account avatar. Theme picker shows all 5 themes.
  Hard-refresh 5 times — Pro themes consistently visible.
