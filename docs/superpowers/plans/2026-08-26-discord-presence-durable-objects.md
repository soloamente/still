# Discord Presence Durable Objects Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace self-hosted Lanyard with a dedicated Cloudflare Worker + one Discord Gateway Durable Object so profile **Listening / Playing** works without a VPS, and drop the Pro VPS funding bar.

**Architecture:** New `apps/discord-presence` Worker owns a single `DiscordGateway` Durable Object (`getByName("gateway")`) that holds an outbound Discord Gateway WebSocket, persists latest presence in SQLite, and serves Lanyard-shaped `GET /v1/users/:id`. Elysia swaps `lanyard-client.ts` for that Worker (15s cache, same `formatDiscordActivity`). Connect OAuth + Sense Presence guild + Pro `discord_activity` gate stay. `apps/realtime` is untouched.

**Tech Stack:** Cloudflare Workers + Durable Objects (SQLite, alarms, outbound `new WebSocket`), Wrangler 4, Bun tests for pure modules (same as `apps/realtime` — do **not** add `@cloudflare/vitest-pool-workers` unless a later task cannot extract pure functions), Elysia, existing Next.js Settings/Pricing UI.

**Spec:** [`docs/superpowers/specs/2026-08-26-discord-presence-durable-objects-design.md`](../specs/2026-08-26-discord-presence-durable-objects-design.md)

**Conventions:**
- Windows PowerShell — chain with `;`, not `&&`.
- One task per Executor / subagent pass; human **go** between tasks.
- TDD for mapper, protocol, auth, Elysia client, infra flag.
- Do **not** commit unless the human asks.
- After code changes in a session: `graphify update .` (AST-only).
- Never put the Discord bot token on `apps/web` or `apps/realtime`.
- Sense online dots stay on Redis / `RealtimeHub`.

---

### Task 1: Presence mapper (TDD) + Worker package scaffold

**Files:**
- Create: `apps/discord-presence/package.json`
- Create: `apps/discord-presence/tsconfig.json` (copy `apps/realtime/tsconfig.json`)
- Create: `apps/discord-presence/wrangler.jsonc`
- Create: `apps/discord-presence/.dev.vars.example`
- Create: `apps/discord-presence/src/presence-mapper.ts`
- Create: `apps/discord-presence/src/presence-mapper.test.ts`
- Modify: `package.json` — add `"dev:discord-presence": "turbo -F @still/discord-presence-worker dev"`

**Step 1: Scaffold package** (no tests yet)

`package.json`:

```json
{
	"name": "@still/discord-presence-worker",
	"private": true,
	"version": "0.0.1",
	"scripts": {
		"dev": "wrangler dev --port 8788",
		"deploy": "wrangler deploy",
		"type-check": "tsc --noEmit",
		"test": "bun test"
	},
	"devDependencies": {
		"@cloudflare/workers-types": "^4.20250617.0",
		"wrangler": "^4.40.0"
	}
}
```

`wrangler.jsonc`:

```jsonc
{
	"name": "discord-presence-still",
	"main": "src/index.ts",
	"compatibility_date": "2025-06-01",
	"durable_objects": {
		"bindings": [{ "name": "DISCORD_GATEWAY", "class_name": "DiscordGateway" }]
	},
	"migrations": [
		{ "tag": "v1", "new_sqlite_classes": ["DiscordGateway"] }
	]
}
```

`.dev.vars.example`:

```
# cp .dev.vars.example .dev.vars  (gitignored — never commit secrets)
DISCORD_BOT_TOKEN=
DISCORD_PRESENCE_GUILD_ID=
DISCORD_PRESENCE_INTERNAL_SECRET=
```

Do **not** create `src/index.ts` / DO class yet (Task 2). Mapper tests must not import Cloudflare runtime.

**Step 2: Write failing mapper tests**

Discord presence input (subset):

```ts
export type DiscordPresenceSnapshot = {
	user?: { id?: string };
	status?: string | null;
	activities?: DiscordActivity[] | null;
};

export type DiscordActivity = {
	type?: number;
	name?: string | null;
	details?: string | null;
	state?: string | null;
	assets?: {
		large_image?: string | null;
		large_text?: string | null;
		small_image?: string | null;
		small_text?: string | null;
	} | null;
	timestamps?: { start?: number | null; end?: number | null } | null;
};
```

Output must match `LanyardPresencePayload` in `apps/server/src/lib/discord-activity.ts` (duplicate the type in the Worker — do not import `@still` server into the Worker).

Cases:
1. Spotify `type: 2` + `name: "Spotify"` → `listening_to_spotify: true`, `spotify.song` from `details`, `artist` from `state`, `album` from `assets.large_text`, `album_art_url` from `spotify:{id}` → `https://i.scdn.co/image/{id}`
2. `mp:external/{hash}/https/i.scdn.co/...` unwraps to `https://i.scdn.co/...`
3. Playing `type: 0` → activities copied, `listening_to_spotify: false`
4. Streaming `type: 1` / watching `type: 3` copied through
5. Empty / missing activities / `status: "offline"` → empty activities, no spotify
6. Unknown / null snapshot → same empty success shape (offline, `activities: []`)

**Step 3:** `cd apps/discord-presence; bun test src/presence-mapper.test.ts` — expect FAIL (module missing).

**Step 4:** Implement `toLanyardPresence(snapshot): LanyardPresencePayload`.

**Step 5:** Re-run tests — expect PASS.

**Success criteria:** `bun test` in `apps/discord-presence` green; no live Discord; `apps/realtime` unchanged.

---

### Task 2: Worker HTTP + Durable Object storage

**Files:**
- Create: `apps/discord-presence/src/auth.ts` (copy `timingSafeEqual` from `apps/realtime/src/auth.ts`)
- Create: `apps/discord-presence/src/auth.test.ts` (copy the three `timingSafeEqual` cases from `apps/realtime/src/auth.test.ts`)
- Create: `apps/discord-presence/src/empty-presence.ts` — shared empty Lanyard payload helper
- Create: `apps/discord-presence/src/gateway-do.ts`
- Create: `apps/discord-presence/src/index.ts`
- Create: `apps/discord-presence/src/index.test.ts` — test auth gating by extracting `authorizeInternal(request, secret)` if easier than spinning Wrangler

**Env interface:**

```ts
export interface Env {
	DISCORD_GATEWAY: DurableObjectNamespace;
	DISCORD_BOT_TOKEN: string;
	DISCORD_PRESENCE_GUILD_ID: string;
	DISCORD_PRESENCE_INTERNAL_SECRET: string;
}
```

**DO class `DiscordGateway`:**
- Constructor: `blockConcurrencyWhile` only for SQL:

```sql
CREATE TABLE IF NOT EXISTS presence (
  discord_user_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS session (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
```

- RPC (preferred) or `fetch` internal paths:
  - `getPresence(discordUserId: string): LanyardPresencePayload` — SELECT, `JSON.parse`, `toLanyardPresence`. Missing row → empty payload (not throw).
  - `putPresence(discordUserId: string, snapshot: DiscordPresenceSnapshot): void` — persist **raw snapshot JSON** (not Lanyard). Persist first, then in-memory cache if any.
  - `getGatewayStatus(): "connected" | "connecting" | "disconnected"` — in-memory for now; default `"disconnected"` until Task 3.

**Worker `fetch`:**
- `GET /health` → `{ ok: true, gateway }` — **no** auth
- `GET /v1/users/:id` → Bearer secret required; `{ success: true, data }`
- `POST /internal/ensure` → Bearer secret; Task 3 will connect; Task 2 returns `{ ok: true }` after touching the stub so the DO is created

Bearer header: `Authorization: Bearer ${secret}` with `timingSafeEqual` (same as `apps/realtime/src/index.ts`).

**Tests (Bun):**
- `timingSafeEqual` cases
- `toLanyardPresence` still pass
- Optional: `authorizeInternal` missing/wrong header → false

Do **not** open a Discord WebSocket in this task.

**Run:** `cd apps/discord-presence; bun test` — PASS.

**Success criteria:** Local mental model: curl `/v1/users/x` with wrong secret → 401; with secret and empty DB → `{ success: true, data: { discord_status: "offline", activities: [], listening_to_spotify: false, spotify: null } }`.

---

### Task 3: Gateway protocol + alarm keepalive

**Files:**
- Create: `apps/discord-presence/src/gateway-protocol.ts`
- Create: `apps/discord-presence/src/gateway-protocol.test.ts`
- Modify: `apps/discord-presence/src/gateway-do.ts`
- Modify: `apps/discord-presence/src/index.ts` — `POST /internal/ensure` calls `stub.connect()`

**Intents:** `GUILDS (1 << 0) | GUILD_MEMBERS (1 << 1) | GUILD_PRESENCES (1 << 8)` = `259`.

**Ops:** DISPATCH 0, HEARTBEAT 1, IDENTIFY 2, RESUME 6, RECONNECT 7, INVALID_SESSION 9, HELLO 10, HEARTBEAT_ACK 11.

**Step 1: Pure protocol tests** (no WebSocket)

`applyGatewayMessage(state, payload)` returns actions:

| Incoming | Action |
|----------|--------|
| op 10 HELLO | store `heartbeat_interval`; Identify if no session; Resume if `session_id`+seq exist |
| op 0 READY | store `session_id`, `resume_gateway_url`; seq; ingest `d.presences` if present |
| op 0 PRESENCE_UPDATE | upsert presence for `d.user.id` (ignore if guild_id set and ≠ `DISCORD_PRESENCE_GUILD_ID` when that field exists) |
| op 11 | mark heartbeat ack |
| op 7 | reconnect |
| op 9 `d: false` | clear session, Identify after 1–5s; `d: true` → Resume |
| missed heartbeat (caller passes `now` vs last ack) | reconnect |

Also test Identify JSON shape: `token`, `intents: 259`, `properties: { os, browser, device }` — browser/device can be `"sense-discord-presence"`.

**Step 2:** FAIL then implement `gateway-protocol.ts`.

**Step 3: Wire DO**
- `connect()`: `GET https://discord.com/api/v10/gateway/bot` with `Authorization: Bot ${token}` → `url` + optional `session_start_limit`. Open `new WebSocket(`${url}?v=10&encoding=json`)`. **Not** `fetch` + Upgrade.
- `ws.addEventListener("message")` → parse JSON → `applyGatewayMessage` → `ws.send` heartbeat/identify/resume; `putPresence` on updates.
- `alarm()`: if socket missing, `connect()`; else send heartbeat if HELLO interval elapsed; always `setAlarm(Date.now() + 25_000)` while we want the session (covers Cloudflare’s ~15 min outbound-socket eviction window).
- Persist `session_id`, `seq`, `resume_gateway_url`, `heartbeat_interval_ms` in `session` table **before** updating in-memory fields.
- Reconnect backoff: 1s → cap 60s, jitter; never tight Identify loop. If `session_start_limit.remaining === 0`, wait `reset_after`.
- On Worker deploy eviction: next alarm reconnects.

**Success criteria:** Protocol unit tests PASS. No live Discord required to merge. `POST /internal/ensure` is the wake path.

---

### Task 4: Elysia env — Worker URL + secret replace Lanyard

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `apps/server/src/lib/discord-activity-config.ts`
- Modify: `apps/server/src/lib/discord-activity-config.test.ts`
- Modify: `packages/auth/src/lib/discord-activity-config.ts`

**Replace required infra:**
- Remove `LANYARD_INTERNAL_URL` from `hasDiscordActivityInfrastructure` (both copies).
- Add optional `DISCORD_PRESENCE_WORKER_URL` (`optionalUrl()`) and `DISCORD_PRESENCE_INTERNAL_SECRET` (`optionalNonEmptyString()`).
- Keep `LANYARD_INTERNAL_URL` in env schema one more task if you want a soft warning — **prefer delete** in this task so nothing still points at Lanyard.
- Update comments on `DISCORD_BOT_TOKEN` (Gateway lives on the Worker; Elysia still uses the token for guild join/kick).
- Delete `DISCORD_ACTIVITY_PRO_TARGET` from env in Task 6 with the funding stack (leave it in Task 4).

**Tests:** Copy `fullInfra` to use Worker URL + secret instead of Lanyard URL. Missing either → `hasDiscordActivityInfrastructure()` false.

**Run:** `cd apps/server; bun test src/lib/discord-activity-config.test.ts`

**Success criteria:** Flag + OAuth + bot + guild + Worker URL + secret ⇒ enabled. Server still boots with none of these set.

---

### Task 5: Elysia client swap (`lanyard-client` → Worker)

**Files:**
- Create: `apps/server/src/lib/discord-presence-client.ts`
- Create: `apps/server/src/lib/discord-presence-client.test.ts` (port `lanyard-client.test.ts`)
- Modify: `apps/server/src/lib/fetch-profile-discord-activity.ts`
- Modify: `apps/server/src/lib/fetch-profile-discord-activity.test.ts`
- Delete: `apps/server/src/lib/lanyard-client.ts`
- Delete: `apps/server/src/lib/lanyard-client.test.ts`

**Behavior (same as Lanyard client):**
- Base: `env.DISCORD_PRESENCE_WORKER_URL`
- `GET {base}/v1/users/{id}` with `Accept: application/json` **and** `Authorization: Bearer ${env.DISCORD_PRESENCE_INTERNAL_SECRET}`
- 5s timeout; non-OK / `success !== true` / throw → `null`
- 15s in-process TTL cache; `resetDiscordPresenceCacheForTests()`
- Exports: `fetchDiscordPresence`, `getCachedDiscordPresence`

**Tests:** URL `http://presence.example/v1/users/94490510688792576`; assert Authorization header present; unset URL → null and zero fetches.

**Run:**
```
cd apps/server; bun test src/lib/discord-presence-client.test.ts; bun test src/lib/fetch-profile-discord-activity.test.ts
```

**Success criteria:** Profile activity path unchanged except the upstream host. No remaining `LANYARD_*` imports in `apps/server`.

---

### Task 6: Drop VPS funding bar + API

**Files:**
- Delete: `apps/web/src/components/discord/discord-activity-funding-strip.tsx`
- Delete: `apps/web/src/lib/discord-activity-funding.ts`
- Delete: `apps/web/src/lib/discord-activity-funding-progress.ts`
- Delete: `apps/web/src/lib/discord-activity-funding-progress.test.ts`
- Delete: `apps/server/src/routes/discord-activity-funding.ts`
- Delete: `apps/server/src/routes/discord-activity-funding.test.ts`
- Delete: `apps/server/src/lib/discord-activity-funding.ts`
- Delete: `apps/server/src/lib/discord-activity-funding.test.ts`
- Delete: `apps/server/src/lib/discord-activity-pro-target.ts`
- Delete: `apps/server/src/lib/discord-activity-pro-target.test.ts`
- Delete: `apps/server/src/lib/count-polar-paying-subscribers.ts` (only caller is funding)
- Modify: `apps/server/src/server/app.ts` — remove `.use(discordActivityFundingRoute)`
- Modify: `packages/env/src/server.ts` — remove `DISCORD_ACTIVITY_PRO_TARGET`
- Modify: `apps/web/src/components/pricing/pricing-page-client.tsx` — unmount strip + funding fetch state
- Modify: `apps/web/src/components/profile/me-discord-connect.tsx` — unmount strip; production-off still shows `MeDiscordLinkStatus` pending + **Support with Pro** (no bar)
- Modify: `apps/web/src/lib/sense-support-campaign.ts` — rewrite body so it does **not** mention a presence server, VPS, or “live progress on Pricing”. Campaign flag stays `false`. Example body: Discord activity is an Attuned+ perk; Connect ships when production is on. CTA can stay `/pricing` but label **See Pro plans** not **See Pro progress**.

Grep after: `DiscordActivityFundingStrip`, `discord-activity/funding`, `getDiscordActivityFundingPayload`, `DISCORD_ACTIVITY_PRO_TARGET`, `countPolarPayingSubscribers`.

**Run:** `cd apps/server; bun test src/lib/discord-activity-config.test.ts` plus any remaining funding tests must be gone (not fail). `cd apps/web` typecheck if needed.

**Success criteria:** Pricing has no Discord funding bar. Settings production-off is teaser + Pro CTA, no progressbar. No `/api/discord-activity/funding`.

---

### Task 7: Retire Lanyard Docker + env examples + spec pointers

**Files:**
- Delete: `docker/discord-lanyard.compose.yml`
- Modify: `docker/discord-setup.env.example` — replace Lanyard block with Worker URL + internal secret (`http://127.0.0.1:8788`); note `wrangler dev` in `apps/discord-presence`
- Modify: `docs/superpowers/specs/2026-07-28-discord-profile-activity-design.md` — architecture row: superseded by 2026-08-26 DO spec (do not rewrite the whole historical spec)
- Modify: `docs/superpowers/specs/2026-08-11-discord-activity-pro-funding-design.md` — unlock checklist: Worker not VPS; funding strip retired
- Grep repo for `LANYARD_INTERNAL`, `phineas/lanyard`, `lanyard:4001`

Root `package.json` already has `dev:discord-presence` from Task 1.

**Success criteria:** A teammate can enable activity locally with Discord bot + `wrangler dev --port 8788` + server env; no Docker Redis/Lanyard.

---

### Task 8: Local smoke (human + Executor assist)

**Owner:** Human Discord account in Sense Presence guild. Executor documents commands only.

```
cd apps/discord-presence; bun run dev
```

`apps/server/.env` (in addition to existing Discord OAuth/bot/guild/flag):

```
DISCORD_PRESENCE_WORKER_URL=http://127.0.0.1:8788
DISCORD_PRESENCE_INTERNAL_SECRET=<same as .dev.vars>
```

Checklist:
1. Worker `/health` → `gateway` becomes `connected` after Ensure/alarm.
2. Play Spotify (or a game) on Discord while in the presence guild.
3. `GET /v1/users/{snowflake}` with Bearer returns Lanyard-shaped Spotify/playing.
4. Signed-in Pro profile + account menu show the row; unsigned does not.
5. Stop Worker → profile omits row, no error banner.
6. `apps/realtime` unrelated.

**Success criteria:** Spec success criteria 1–5.

---

## Out of scope (do not do)

- Browser WebSocket push to profile
- Per-user child DOs
- `flarecord` / `discord-gateway-cloudflare-do` dependencies
- Merging Discord status into Sense online dots
- Auto-enable from Polar subscriber count

## Risks

| Risk | Mitigation |
|------|------------|
| Cloudflare evicts outbound WS after ~15 min | Alarm every ~25s |
| Deploy drops Gateway | Persist session + alarm resume |
| Discord session start limit | Read `/gateway/bot`; backoff |
| Identify storms | Exponential backoff + cap |
| Mapper Spotify art (`spotify:` vs `mp:external`) | Fixtures in Task 1 |

## Checkpoint after Tasks 1–5

Worker + Elysia path compiles and unit tests pass. Funding UI still exists until Task 6. Do not enable production flag until Task 8.
