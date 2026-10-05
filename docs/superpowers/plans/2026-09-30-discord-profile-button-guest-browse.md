# Discord profile button and guest browsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discord's Watching activity opens that patron's public Sense profile, and a guest can browse Sense until they try to log or open a personal page.

**Architecture:** The extension layout gains a show/hide flag. The API returns an `https` profile URL only for a public handle. The desktop helper copies that URL onto one Discord button. On the web, account routes never render for a guest: the proxy sends a cold load to `/home?account=1`, and in-app actions open one dialog.

**Tech Stack:** Bun tests, Elysia companion route, WXT extension, native-host Discord IPC, Next.js App Router proxy and `(app)` layout.

**Spec:** `docs/superpowers/specs/2026-09-30-discord-profile-button-guest-browse-design.md`

## Global Constraints

- Button label is exactly `View profile`.
- Button URL is `https://{public web origin}/profile/{handle}`.
- Default is show. A saved layout with no `profileButton` field reads as show.
- Omit the button when Sense is not paired, the profile is private (`profile.is_private`), the handle is missing, the origin is not `https`, or the lookup fails. The activity still posts.
- Discord gets one button. Do not add a second button or an editable label.
- Guest browse routes: `/home`, `/movies/…`, `/tv/…`, `/people/…`, public `/profile/…`, `/lists`, public list pages, `/journal`.
- Guest personal routes do not render: `/diary`, `/watchlist`, `/quotes`, `/me`, `/achievements`, `/notifications`, `/chat`.
- Dialog actions: **Log in** → `/sign-in`, **Create account** → `/sign-up`, `from` is the path still on screen.
- Closing the dialog does not change that page. A cold personal URL opens the dialog over `/home` and closing stays on `/home`.
- A private profile stays not-found. A private list stays hidden.
- Stay on `main`. Each task commit touches only the files listed in that task.

---

## File structure

- Modify `apps/sense-companion/src/presence/discord-layout.ts` — `profileButton: "show" | "hide"`.
- Modify `apps/sense-companion/src/presence/discord-layout.test.ts`.
- Modify `apps/sense-companion/src/popup/discord-activity-editor.tsx` — preview control.
- Create `apps/server/src/lib/companion-profile-button.ts` — `https` URL or null.
- Create `apps/server/src/lib/companion-profile-button.test.ts`.
- Modify `apps/server/src/routes/companion.ts` — session returns `profileUrl`.
- Modify `apps/server/src/routes/companion.test.ts`.
- Modify `apps/sense-companion-host/src/companion-message.ts` — `profileButtonUrl`.
- Modify `apps/sense-companion-host/src/discord-presence.ts` — button on `SET_ACTIVITY`.
- Modify `apps/sense-companion-host/src/discord-presence.test.ts`.
- Modify `apps/sense-companion-host/src/discord-session.ts` — dedupe includes the URL.
- Modify `apps/sense-companion/entrypoints/background.ts` — attach the URL when the setting is show.
- Create `apps/web/src/lib/guest-browse-paths.ts` — account vs browse.
- Create `apps/web/src/lib/guest-browse-paths.test.ts`.
- Modify `apps/web/src/proxy.ts` — cold account URLs go to `/home?account=1`.
- Create `apps/web/src/components/auth/guest-account-dialog.tsx` — one dialog.
- Modify `apps/web/src/app/(app)/layout.tsx` — guest shell.
- Modify poster tiles, the mobile tab bar, and **New list** so gated actions open the dialog.

---

### Task 1: Layout flag

**Files:**
- Modify: `apps/sense-companion/src/presence/discord-layout.ts`
- Test: `apps/sense-companion/src/presence/discord-layout.test.ts`

**Interfaces:**
- Consumes: existing `DiscordActivityLayout`.
- Produces: `profileButton: "show" | "hide"` on `DiscordActivityLayout` and `DEFAULT_DISCORD_ACTIVITY_LAYOUT`. `readDiscordActivityLayout` returns `"show"` unless the saved value is `"hide"`.

- [ ] **Step 1: Write the failing test**

Add to `discord-layout.test.ts`:

```ts
test("the profile button is on unless the saved layout hides it", () => {
	expect(DEFAULT_DISCORD_ACTIVITY_LAYOUT.profileButton).toBe("show");
	expect(readDiscordActivityLayout({ name: "service" }).profileButton).toBe(
		"show",
	);
	expect(readDiscordActivityLayout({ profileButton: "hide" }).profileButton).toBe(
		"hide",
	);
	expect(readDiscordActivityLayout({ profileButton: "nope" }).profileButton).toBe(
		"show",
	);
});
```

The existing "broken saved layout" expectation spreads `DEFAULT_DISCORD_ACTIVITY_LAYOUT`, so it already includes `profileButton: "show"` once the default has the field. Do not assert the old object without that field.

- [ ] **Step 2: Run the test**

Run: `bun test apps/sense-companion/src/presence/discord-layout.test.ts`

Expected: FAIL because `profileButton` is missing.

- [ ] **Step 3: Add the field**

```ts
export type DiscordActivityLayout = {
	name: DiscordFieldSource;
	details: DiscordFieldSource;
	state: DiscordFieldSource;
	largeText: DiscordFieldSource;
	cover: "artwork" | "none";
	profileButton: "show" | "hide";
};

export const DEFAULT_DISCORD_ACTIVITY_LAYOUT: DiscordActivityLayout = {
	name: "title",
	details: "seasonEpisode",
	state: "sense",
	largeText: "title",
	cover: "artwork",
	profileButton: "show",
};
```

In `readDiscordActivityLayout`:

```ts
profileButton: raw.profileButton === "hide" ? "hide" : "show",
```

- [ ] **Step 4: Run the test**

Run: `bun test apps/sense-companion/src/presence/discord-layout.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/sense-companion/src/presence/discord-layout.ts apps/sense-companion/src/presence/discord-layout.test.ts
git commit -m "feat(companion): default the Discord profile button to on"
```

---

### Task 2: Settings preview

**Files:**
- Modify: `apps/sense-companion/src/popup/discord-activity-editor.tsx`
- Modify: `apps/sense-companion/entrypoints/settings/style.css` only if the new control has no rule yet. Match the existing `.activity-cover` select. Do not invent a new card.

**Interfaces:**
- Consumes: `layout.profileButton` and `save` from Task 1.
- Produces: a select labeled `Profile button` with options `Show` (`show`) and `Hide` (`hide`). When show, the preview renders a non-submitting control whose text is `View profile`. When hide, that control is absent.

- [ ] **Step 1: Add the control under the cover select**

```tsx
<label className="activity-cover">
	<span>{layout.profileButton === "show" ? "Profile button" : "No profile button"}</span>
	<select
		aria-label="Profile button"
		value={layout.profileButton}
		onChange={(event) =>
			save({
				...layout,
				profileButton: event.target.value === "hide" ? "hide" : "show",
			})
		}
	>
		<option value="show">Show</option>
		<option value="hide">Hide</option>
	</select>
</label>
{layout.profileButton === "show" ? (
	<p className="activity-type">View profile</p>
) : null}
```

Put the `View profile` line at the bottom of `.activity-card`, after the copy lines, so it reads as Discord's button.

- [ ] **Step 2: Commit**

```bash
git add apps/sense-companion/src/popup/discord-activity-editor.tsx apps/sense-companion/entrypoints/settings/style.css
git commit -m "feat(companion): let settings hide the Discord profile button"
```

---

### Task 3: Profile URL

**Files:**
- Create: `apps/server/src/lib/companion-profile-button.ts`
- Test: `apps/server/src/lib/companion-profile-button.test.ts`
- Modify: `apps/server/src/routes/companion.ts`
- Modify: `apps/server/src/routes/companion.test.ts`

**Interfaces:**
- Consumes: `BETTER_AUTH_URL` from `@still/env/server` in the production route only.
- Produces: `companionProfileButtonUrl({ origin, handle, isPrivate }) => string | null`. Session JSON is `{ ok: true, profileUrl: string | null }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";

import { companionProfileButtonUrl } from "./companion-profile-button";

describe("companionProfileButtonUrl", () => {
	test("builds an https profile link", () => {
		expect(
			companionProfileButtonUrl({
				origin: "https://sense.example",
				handle: "ada",
				isPrivate: false,
			}),
		).toBe("https://sense.example/profile/ada");
	});

	test("omits a private profile, a missing handle, and a non-https origin", () => {
		expect(
			companionProfileButtonUrl({
				origin: "https://sense.example",
				handle: "ada",
				isPrivate: true,
			}),
		).toBeNull();
		expect(
			companionProfileButtonUrl({
				origin: "https://sense.example",
				handle: "  ",
				isPrivate: false,
			}),
		).toBeNull();
		expect(
			companionProfileButtonUrl({
				origin: "http://127.0.0.1:3001",
				handle: "ada",
				isPrivate: false,
			}),
		).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test**

Run: `bun test apps/server/src/lib/companion-profile-button.test.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: Implement the helper**

```ts
export function companionProfileButtonUrl(input: {
	origin: string;
	handle: string | null;
	isPrivate: boolean;
}): string | null {
	const handle = input.handle?.trim() ?? "";
	if (!handle || input.isPrivate) return null;
	let url: URL;
	try {
		url = new URL(`/profile/${encodeURIComponent(handle)}`, input.origin);
	} catch {
		return null;
	}
	if (url.protocol !== "https:") return null;
	return url.toString();
}
```

- [ ] **Step 4: Run the helper test**

Run: `bun test apps/server/src/lib/companion-profile-button.test.ts`

Expected: PASS

- [ ] **Step 5: Extend the session route**

Add optional route options:

```ts
profileForUser?: (
	userId: string,
) => Promise<{ handle: string | null; isPrivate: boolean } | null>;
publicOrigin?: string;
```

In `GET /api/companion/session`, after the token resolves:

```ts
const profile = (await profileForUser?.(session.userId)) ?? null;
const profileUrl = companionProfileButtonUrl({
	origin: publicOrigin ?? "",
	handle: profile?.handle ?? null,
	isPrivate: profile?.isPrivate ?? true,
});
return { ok: true as const, profileUrl };
```

A missing profile lookup returns `profileUrl: null`. A thrown lookup is caught and still returns `{ ok: true, profileUrl: null }`.

Wire the production caller with `publicOrigin: env.BETTER_AUTH_URL` and a Drizzle read of `profile.handle` and `profile.isPrivate` for `session.userId`. Do not query `tmdb_json`.

Update the existing session assertion in `companion.test.ts` from `{ ok: true }` to `{ ok: true, profileUrl: null }`.

Add a test that passes `profileForUser: async () => ({ handle: "ada", isPrivate: false })` and `publicOrigin: "https://sense.example"` and expects `profileUrl` to be `https://sense.example/profile/ada`. Add one where `isPrivate: true` expects `null`.

- [ ] **Step 6: Run the route tests**

Run: `bun test apps/server/src/routes/companion.test.ts apps/server/src/lib/companion-profile-button.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/lib/companion-profile-button.ts apps/server/src/lib/companion-profile-button.test.ts apps/server/src/routes/companion.ts apps/server/src/routes/companion.test.ts
git commit -m "feat(companion): return a public profile URL for the Discord button"
```

---

### Task 4: Discord payload

**Files:**
- Modify: `apps/sense-companion-host/src/companion-message.ts`
- Modify: `apps/sense-companion-host/src/discord-presence.ts`
- Modify: `apps/sense-companion-host/src/discord-presence.test.ts`
- Modify: `apps/sense-companion-host/src/discord-session.ts`
- Modify: `apps/sense-companion/entrypoints/background.ts`
- Modify: `apps/sense-companion/src/pairing/client.ts` if that is where the session GET lives. Otherwise add `readCompanionProfileUrl` next to the existing session fetch.

**Interfaces:**
- Consumes: `profileUrl` from Task 3 and `profileButton` from Task 1.
- Produces: activity message field `profileButtonUrl?: string | null`. `buildSetWatchingActivity` adds `buttons: [{ label: "View profile", url }]` only for an `https` URL. `discord-session` key includes that URL.

- [ ] **Step 1: Write the failing host test**

In `discord-presence.test.ts`, call `buildSetWatchingActivity` with the same fields as the Stranger Things test plus `profileButtonUrl: "https://sense.example/profile/ada"`. Expect `activity.buttons` to equal `[{ label: "View profile", url: "https://sense.example/profile/ada" }]`.

Add a second call with `profileButtonUrl: "http://127.0.0.1:3001/profile/ada"` and expect `buttons` to be absent. The existing Stranger Things test omits the field and must still have no `buttons` key.

- [ ] **Step 2: Run the host test**

Run: `bun test apps/sense-companion-host/src/discord-presence.test.ts`

Expected: FAIL because the argument and `buttons` do not exist.

- [ ] **Step 3: Implement the button**

Add `profileButtonUrl?: string | null` to `buildSetWatchingActivity` and to the `set` branch of `DiscordPresenceDecision`.

```ts
const buttonUrl = input.profileButtonUrl?.trim() ?? "";
if (buttonUrl.startsWith("https://")) {
	activity.buttons = [{ label: "View profile", url: buttonUrl }];
}
```

`decideDiscordPresence` copies `input.message.profileButtonUrl` onto every `set` decision. `watchingCopy` stays free of button logic.

In `discord-session.ts`, append `\0${decision.profileButtonUrl ?? ""}` to `key`.

On the extension, `GET /api/companion/session` with the device token. Cache `profileUrl` (string or null). On failure, cache null and still forward the activity. `prepareDiscordActivity` sets `profileButtonUrl` to that cache when `layout.profileButton === "show"`, otherwise omits it.

Add `profileButtonUrl?: string | null` to the host `CompanionActivityMessage` activity variant.

- [ ] **Step 4: Run the host test**

Run: `bun test apps/sense-companion-host/src/discord-presence.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/sense-companion-host/src/companion-message.ts apps/sense-companion-host/src/discord-presence.ts apps/sense-companion-host/src/discord-presence.test.ts apps/sense-companion-host/src/discord-session.ts apps/sense-companion/entrypoints/background.ts apps/sense-companion/src/pairing/client.ts
git commit -m "feat(companion): send View profile on the Discord activity"
```

---

### Task 5: Guest path rules

**Files:**
- Create: `apps/web/src/lib/guest-browse-paths.ts`
- Test: `apps/web/src/lib/guest-browse-paths.test.ts`
- Modify: `apps/web/src/proxy.ts`

**Interfaces:**
- Consumes: `isShareableAppPath`.
- Produces: `isAccountRequiredPath(pathname: string): boolean` and `guestAccountRedirect(pathname: string, hasSession: boolean): "/home?account=1" | null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";

import {
	guestAccountRedirect,
	isAccountRequiredPath,
} from "./guest-browse-paths";

describe("guest account paths", () => {
	test("personal pages need an account", () => {
		for (const path of [
			"/diary",
			"/diary/1",
			"/watchlist",
			"/quotes",
			"/me",
			"/me/settings",
			"/achievements",
			"/notifications",
			"/chat",
		]) {
			expect(isAccountRequiredPath(path)).toBe(true);
		}
	});

	test("browse pages do not", () => {
		for (const path of ["/home", "/lists", "/lists/abc", "/movies/550", "/profile/ada"]) {
			expect(isAccountRequiredPath(path)).toBe(false);
		}
	});

	test("a signed-out personal URL opens the dialog on home", () => {
		expect(guestAccountRedirect("/diary", false)).toBe("/home?account=1");
		expect(guestAccountRedirect("/home", false)).toBeNull();
		expect(guestAccountRedirect("/diary", true)).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test**

Run: `bun test apps/web/src/lib/guest-browse-paths.test.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: Implement and use it in the proxy**

```ts
const ACCOUNT_PREFIXES = [
	"/diary",
	"/watchlist",
	"/quotes",
	"/me",
	"/achievements",
	"/notifications",
	"/chat",
] as const;

export function isAccountRequiredPath(pathname: string): boolean {
	return ACCOUNT_PREFIXES.some((prefix) => {
		if (prefix === "/me") {
			return pathname === "/me" || pathname.startsWith("/me/");
		}
		return pathname === prefix || pathname.startsWith(`${prefix}/`);
	});
}

export function guestAccountRedirect(
	pathname: string,
	hasSession: boolean,
): "/home?account=1" | null {
	if (hasSession || !isAccountRequiredPath(pathname)) return null;
	return "/home?account=1";
}
```

In `proxy.ts`, when `guestAccountRedirect(pathname, hasSession)` is non-null, redirect there before the old protected-prefix block. Keep `/members` from matching `/me`. Remove `/home` from `PROTECTED_PREFIXES` so a guest can load home. Leave the other personal prefixes in that list only if `guestAccountRedirect` already handled them; do not redirect those prefixes to `/sign-in`.

- [ ] **Step 4: Run the test**

Run: `bun test apps/web/src/lib/guest-browse-paths.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/guest-browse-paths.ts apps/web/src/lib/guest-browse-paths.test.ts apps/web/src/proxy.ts
git commit -m "feat(web): send signed-out personal pages to home"
```

---

### Task 6: Account dialog and guest shell

**Files:**
- Create: `apps/web/src/components/auth/guest-account-dialog.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx`
- Modify: `apps/web/src/components/app/mobile-tab-bar.tsx`
- Modify: `apps/web/src/components/catalogue/catalogue-poster-tile.tsx`
- Modify: `apps/web/src/components/list/list-detail-poster-tile.tsx`
- Modify: `apps/web/src/components/profile/profile-filmography-poster-tile.tsx`
- Modify: `apps/web/src/components/list/lists-new-list-button.tsx`
- Modify: `apps/web/src/app/(app)/lists/page.tsx` — no session renders the lobby with an empty collection.
- Modify: `apps/web/src/components/home/search-dialog-category-body.tsx` — "your lists" opens the dialog.

**Interfaces:**
- Consumes: `guestAccountRedirect` from Task 5. `APP_MODAL_OVERLAY_CLASS`.
- Produces: `openGuestAccountDialog()` from `GuestAccountProvider`. No session and a browse path render `AppShell` with no patron. Personal data requests do not run.

- [ ] **Step 1: Dialog**

`GuestAccountProvider` holds `open`. `openGuestAccountDialog` sets it true. On `/home`, if `account=1` is present, open once, then `router.replace("/home")` only when the guest closes the dialog, so closing leaves `/home` without the query.

The dialog copy is a short line that an account is needed. Actions:

- **Log in** → `/sign-in?from=` plus the current path and search, with `account` removed.
- **Create account** → `/sign-up?from=` the same value.

Close on Escape, scrim, and the close control. Do not navigate on close. Use `APP_MODAL_OVERLAY_CLASS`. No border, ring, or decorative shadow. Surface is `bg-card`.

- [ ] **Step 2: Guest shell**

In `(app)/layout.tsx`, when there is no session and the path is not `isAccountRequiredPath`, render the app shell instead of `redirect("/signed-out")` and instead of `PublicShareShell` for `/home` and `/lists`. Keep `PublicShareShell` for a signed-out film, TV, profile, people, and journal page only if swapping those to the full shell would drop the crawler content. Home and lists use the guest shell.

`AppShell` with `user={null}` hides notifications, invite, and the account menu. That corner is a **Sign in** button that calls `openGuestAccountDialog`.

`MobileTabBar`: Home and Search still navigate. Log, Inbox, and You call `openGuestAccountDialog` and do not change the route.

In-app navigation to an account path is cancelled. A click on a link whose path is `isAccountRequiredPath` calls `preventDefault` and `openGuestAccountDialog()`. The current URL stays. A cold load still uses the proxy redirect from Task 5, because there is no page underneath.

`/lists` with no session renders the lobby and an empty collection. It does not redirect. **New list** opens the dialog. A private `/lists/{id}` stays not-found.

- [ ] **Step 3: Gated actions**

Replace `toast.error("Sign in to use this action")` in the three poster tiles with `openGuestAccountDialog()`. `ListsNewListButton` calls it when there is no session, and does not open the create-list dialog. The search row that says to sign in to search your lists calls `openGuestAccountDialog()` instead of only showing that sentence.

Do not fetch `/api/lists/me`, watchlist membership, or notifications for a guest.

- [ ] **Step 4: Check the paths**

Run: `bun test apps/web/src/lib/guest-browse-paths.test.ts`

Expected: PASS

Then load `http://localhost:3001/home` with no session cookie and confirm the catalogue shell renders. Load `http://localhost:3001/diary` and confirm the address ends on `/home` with the dialog, and the diary grid is not in the document.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/auth/guest-account-dialog.tsx apps/web/src/app/(app)/layout.tsx apps/web/src/app/(app)/lists/page.tsx apps/web/src/components/app/app-shell.tsx apps/web/src/components/app/mobile-tab-bar.tsx apps/web/src/components/catalogue/catalogue-poster-tile.tsx apps/web/src/components/list/list-detail-poster-tile.tsx apps/web/src/components/profile/profile-filmography-poster-tile.tsx apps/web/src/components/list/lists-new-list-button.tsx apps/web/src/components/home/search-dialog-category-body.tsx
git commit -m "feat(web): let guests browse and ask them to join for personal actions"
```

---

## Spec coverage

- Discord button label, default, hide control, private/missing/non-https omission, and failed lookup: Tasks 1–4.
- Guest browse vs personal routes, cold redirect, dialog `from`, and gated actions: Tasks 5–6.
- Private profiles and private lists stay on their existing not-found checks. No task changes them.

## Self-review notes

The session JSON shape is `{ ok: true, profileUrl }` in Task 3 and the extension in Task 4. The button label `View profile` is the same string in Tasks 2 and 4. `profileButton` is only `"show" | "hide"`.
