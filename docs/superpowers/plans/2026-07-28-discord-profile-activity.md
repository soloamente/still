# Discord Profile Activity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let patrons **Connect Discord** in one click, join a minimal **Sense Presence** guild automatically, and show live **Listening / Playing / Streaming** activity on their profile hero and in their account menu — proxied through Elysia, never exposed to Lanyard or Discord IDs in the browser.

**Architecture:** Better Auth Discord OAuth (`identify` + `guilds.join`) stores the link in the existing `account` table. A small Sense bot client adds/removes guild members. Self-hosted Lanyard (Docker + Redis, internal URL) supplies presence payloads. Elysia normalizes + caches (~15s) and serves `GET /api/profiles/:handle/discord-activity` with the same visibility rules as Sense online presence (`friends` | `public`). Web renders `ProfileDiscordActivityRow` on profile and a self row in `app-user-account-menu.tsx`.

**Tech Stack:** Better Auth social provider, Elysia, Bun tests, Next.js App Router, optional Docker Compose (Lanyard + Redis), Discord REST for guild member add/remove.

**Spec:** [`docs/superpowers/specs/2026-07-28-discord-profile-activity-design.md`](../specs/2026-07-28-discord-profile-activity-design.md)

**Conventions that apply:**
- Windows PowerShell — chain commands with `;`, not `&&`.
- One task per Executor pass; human **go** between tasks.
- Feature-flagged with `DISCORD_ACTIVITY_ENABLED` until staging dogfood passes.
- Reuse `readProfilePresenceVisibilityPref` / mutual-follow checks from `patron-presence.ts` — do not invent a parallel privacy model.
- Sense online dots (`PatronOnlineProvider`) stay unchanged.

---

### Task 0: Discord + Lanyard ops (manual, blocking for E2E)

**Owner:** Human / infra (Executor documents env template only)

**Checklist:**
1. Create Discord application + bot; enable **Presence Intent** + **Server Members Intent**.
2. Create **Sense Presence** guild (locked channels, no public invite marketed).
3. Add bot token + guild id to staging secrets.
4. Deploy self-hosted Lanyard (`phineas/lanyard:latest` + Redis) on internal network; confirm `GET {LANYARD_INTERNAL}/v1/users/{teamDiscordId}` returns presence for a bot-added test user.
5. Set env vars on staging API (see Task 1).

**Success criteria:** Staging API can curl Lanyard for a team member actively listening on Spotify.

---

### Task 1: Optional Discord / Lanyard env vars

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `packages/env/src/server.test.ts` (if present) or add minimal test

**Step 1:** Add optional env keys (all optional so dev boot without Discord):

```ts
DISCORD_ACTIVITY_ENABLED: z.enum(["true", "false", "1", "0"]).optional(),
DISCORD_CLIENT_ID: optionalNonEmptyString(),
DISCORD_CLIENT_SECRET: optionalNonEmptyString(),
DISCORD_BOT_TOKEN: optionalNonEmptyString(),
DISCORD_PRESENCE_GUILD_ID: optionalNonEmptyString(),
LANYARD_INTERNAL_URL: optionalUrl(),
```

**Step 2:** Add helper `isDiscordActivityEnabled()` in `apps/server/src/lib/discord-activity-config.ts` — true only when flag enabled **and** required vars present.

**Step 3:** Run `cd packages/env; bun test` (or root typecheck).

**Success criteria:** Server boots with no Discord vars; `isDiscordActivityEnabled()` false.

---

### Task 2: Lanyard payload → display formatter (TDD)

**Files:**
- Create: `apps/server/src/lib/discord-activity.ts`
- Create: `apps/server/src/lib/discord-activity.test.ts`

**Step 1: Write failing tests** for:
- Spotify (`listening_to_spotify` + `spotify` object) → `{ kind: "listening", label, detail: "Spotify", imageUrl }`
- Playing (`activities` type 0) → `{ kind: "playing", label }`
- Streaming (type 1) → `{ kind: "streaming", label }`
- Custom status only → `{ kind: "custom", label }`
- Empty / offline / missing activities → `null`

**Step 2:** Run `cd apps/server; bun test src/lib/discord-activity.test.ts` — expect FAIL.

**Step 3:** Implement `formatDiscordActivity(lanyardData: LanyardPresencePayload): DiscordActivityDisplay | null` and export types matching spec API shape (`label`, `detail?`, `imageUrl?`, `kind`).

**Step 4:** Re-run tests — expect PASS.

**Success criteria:** Formatter tests green; no network in unit tests (fixture JSON from Lanyard README).

---

### Task 3: Lanyard fetch + 15s cache

**Files:**
- Create: `apps/server/src/lib/lanyard-client.ts`
- Create: `apps/server/src/lib/lanyard-client.test.ts` (mock `fetch`)

**Step 1:** Implement `fetchLanyardPresence(discordUserId: string): Promise<LanyardPresencePayload | null>` — internal GET `{LANYARD_INTERNAL_URL}/v1/users/:id`, return `data` on `success: true`, else null.

**Step 2:** In-memory TTL cache Map keyed by discordUserId (15s); export `getCachedLanyardPresence`.

**Step 3:** Test cache hit skips second fetch (mock fetch call count).

**Success criteria:** Tests pass; graceful null when Lanyard URL unset.

---

### Task 4: Discord bot guild join / kick

**Files:**
- Create: `apps/server/src/lib/discord-guild-member.ts`
- Create: `apps/server/src/lib/discord-guild-member.test.ts`

**Step 1:** Implement:
- `addPatronToPresenceGuild(discordUserId: string, userOAuthAccessToken: string)` — `PUT /guilds/{guildId}/members/{userId}` with `{ access_token }` body per Discord API.
- `removePatronFromPresenceGuild(discordUserId: string)` — `DELETE /guilds/{guildId}/members/{userId}` with bot token.

**Step 2:** Unit-test request URL/method assembly with mocked fetch (no real Discord calls).

**Success criteria:** Pure helpers tested; errors logged, not thrown to patrons on kick (best effort).

---

### Task 5: Profile preference helpers

**Files:**
- Modify: `apps/web/src/lib/profile-preferences.ts`
- Modify: `apps/server/src/lib/profile-media.ts` (or shared package if server already mirrors prefs)
- Test: `apps/web/src/lib/profile-preferences.test.ts`

**Step 1:** Add constants:

```ts
export const PROFILE_PREF_DISCORD_ACTIVITY_ENABLED = "discordActivityEnabled" as const;
// nested under preferences.integrations in PATCH payloads
```

**Step 2:** Implement `readDiscordActivityEnabledPref(preferences)` — default `true` when key absent (only matters when Discord linked).

**Step 3:** Extend Settings PATCH shallow merge to accept `preferences.integrations.discordActivityEnabled`.

**Success criteria:** Tests for read helper; PATCH round-trip in existing settings test pattern.

---

### Task 6: Visibility gate for Discord activity

**Files:**
- Create: `apps/server/src/lib/discord-activity-visibility.ts`
- Create: `apps/server/src/lib/discord-activity-visibility.test.ts`

**Step 1:** Implement `canViewerSeeDiscordActivity(input)`:
- Unsigned → false
- Viewer is owner → true (if connected + enabled)
- Else reuse `presenceVisibility` + mutual follow (`fetchMutualFollowingIds` or existing row flag pattern from `pickVisiblePresenceForViewer`)

**Step 2:** Table-driven tests: friends/public/self/unsigned/private profile.

**Success criteria:** Parity with presence visibility spec; no duplicate privacy logic strings in route handler.

---

### Task 7: `GET /api/profiles/:handle/discord-activity`

**Files:**
- Modify: `apps/server/src/routes/profiles.ts`
- Create: `apps/server/src/lib/fetch-profile-discord-activity.ts`
- Test: `apps/server/src/lib/fetch-profile-discord-activity.test.ts` or route test

**Step 1:** Add route (feature-flagged):
- Resolve profile by handle; 404 when profile page would 404.
- Load Discord `account` row for profile owner (`providerId = 'discord'`).
- Check `discordActivityEnabled` + visibility gate.
- Fetch Lanyard → format → return `{ visible: true, activity }` or `{ visible: false }`.
- Never include `discordId` in JSON.

**Step 2:** Mock Lanyard in tests; verify unsigned always `{ visible: false }`.

**Step 3:** Manual: `curl` staging endpoint for connected test user.

**Success criteria:** Route tests pass; 404/visibility/null Lanyard cases covered.

---

### Task 8: Better Auth Discord provider + link callback

**Files:**
- Modify: `packages/auth/src/index.ts`
- Create: `apps/server/src/lib/discord-oauth-callback.ts` (guild join after link)
- Modify: `apps/server/src/routes/` auth mount if callback hook lives on Elysia

**Step 1:** Add `socialProviders.discord` when `DISCORD_CLIENT_ID` + `DISCORD_CLIENT_SECRET` set:

```ts
discord: {
  clientId: env.DISCORD_CLIENT_ID,
  clientSecret: env.DISCORD_CLIENT_SECRET,
  scope: ["identify", "guilds.join"],
},
```

**Step 2:** After successful account link (Better Auth hook / custom route): call `addPatronToPresenceGuild(accountId, accessToken)`; set `discordActivityEnabled: true` on profile preferences.

**Step 3:** **Finish setup** endpoint `POST /api/me/discord/finish-setup` for guild-join retry when OAuth succeeded but guild add failed.

**Step 4:** Disconnect: unlink account + `removePatronFromPresenceGuild` + `discordActivityEnabled: false`.

**Success criteria:** Staging connect flow adds user to guild; disconnect removes; finish-setup retries join.

---

### Task 9: Account deletion guild kick

**Files:**
- Modify: `packages/auth/src/index.ts` (`beforeDelete` hook) or `packages/auth/src/lib/delete-user-cleanup.ts`

**Step 1:** Before user delete, lookup Discord `accountId`; call `removePatronFromPresenceGuild` (best effort).

**Success criteria:** Deletion test or manual verify kick called when linked.

---

### Task 10: Settings UI — Discord section

**Files:**
- Create: `apps/web/src/components/profile/me-discord-connect.tsx`
- Modify: `apps/web/src/components/profile/settings-section-panels.tsx`
- Modify: `apps/web/src/components/profile/settings-form-context.tsx` (if toggle state needed)

**Step 1:** Disconnected state: benefit copy + **Connect Discord** button → `authClient.linkSocial({ provider: "discord", callbackURL: ... })` (verify Better Auth client API).

**Step 2:** Connected state: Discord username (from linked account metadata if available), **Show activity on profile** toggle → PATCH preferences, **Disconnect** button.

**Step 3:** **Finish setup** banner when linked but guild join pending (server flag on `GET /api/me` or dedicated status endpoint).

**Step 4:** Hide entire section when `DISCORD_ACTIVITY_ENABLED` false on server (expose via existing me payload or public config).

**Success criteria:** Settings profile page renders; toggle persists; connect/disconnect flows work on staging.

---

### Task 11: Profile hero activity row

**Files:**
- Create: `apps/web/src/components/profile/profile-discord-activity-row.tsx`
- Create: `apps/web/src/lib/fetch-profile-discord-activity-client.ts`
- Modify: `apps/web/src/components/profile/profile-patron-header.tsx` (or `profile-patron-lobby-shell.tsx` — place under bio)

**Step 1:** Client or RSC fetch `GET /api/profiles/:handle/discord-activity` on profile load (prefer RSC embed in profile fetch to avoid waterfall — extend existing profile server fetch if one exists).

**Step 2:** Render row: optional 36px album art, primary `label`, muted `detail`, truncate long titles, no row when `visible: false`.

**Step 3:** `@media (hover: hover)` only for any hover affordance; respect `prefers-reduced-motion`.

**Success criteria:** Profile shows Spotify line for connected staging user visible to allowed viewers; hidden for unsigned.

---

### Task 12: Account menu self preview

**Files:**
- Modify: `apps/web/src/components/app/app-user-account-menu.tsx`
- Reuse: `fetch-profile-discord-activity-client.ts`

**Step 1:** On menu open, fetch own handle's discord-activity (viewer is owner → always visible when connected).

**Step 2:** Compact truncated line under name; `aria-live="polite"`; SR copy second person (*You are listening to …*).

**Step 3:** Refetch at most every 30s while menu open.

**Success criteria:** Signed-in user sees live activity in account menu; hidden when disconnected.

---

### Task 13: Docker Compose snippet + docs (dev/staging)

**Files:**
- Create: `docker/discord-lanyard.compose.yml` (or section in existing dev docs)
- Modify: spec status → **Approved** in spec file header

**Step 1:** Document Lanyard + Redis compose, env wiring, and Discord app checklist in compose comments.

**Step 2:** Update spec **Status** to `Approved (2026-07-29)`.

**Success criteria:** Teammate can stand up Lanyard locally from compose file + Task 0 checklist.

---

## Verification checklist (human)

- [ ] Connect Discord one-click from Settings
- [ ] Guild join without manual invite link
- [ ] Profile shows **Listening to …** when Spotify active on Discord
- [ ] Account menu shows self activity
- [ ] `friends` visibility hides activity from non-mutuals
- [ ] `public` visibility shows to any signed-in viewer
- [ ] Unsigned profile visitors never see activity
- [ ] Disconnect hides row immediately + removes guild member
- [ ] Lanyard down → no profile error UI
- [ ] Sense online dot unchanged

## Rollout

1. Merge behind `DISCORD_ACTIVITY_ENABLED=false` default.
2. Enable staging → team dogfood.
3. Production enable after Discord intent verification path clear.
4. Optional: post-onboarding skippable chip (defer if Task 10–12 already large).
