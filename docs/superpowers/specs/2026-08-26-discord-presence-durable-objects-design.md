# Sense — Discord presence via Cloudflare Durable Objects

**Status:** Approved (2026-08-26) — brainstorm locked  
**Date:** 2026-08-26  
**Topic:** Replace self-hosted Lanyard with a dedicated Cloudflare Worker + one Discord Gateway Durable Object  
**Related:** [`2026-07-28-discord-profile-activity-design.md`](./2026-07-28-discord-profile-activity-design.md), [`2026-08-11-discord-activity-pro-funding-design.md`](./2026-08-11-discord-activity-pro-funding-design.md)

## Summary

Discord **Listening / Playing / Streaming / Watching** on profile and the account menu already ships through Elysia (`GET /api/profiles/:handle/discord-activity`). The **source** today is self-hosted **Lanyard + Redis**, which is why production waits on a presence VPS and a Pro funding strip.

This spec replaces Lanyard with a **dedicated Cloudflare Worker** (`apps/discord-presence`) whose single named Durable Object holds the Discord Gateway WebSocket and stores latest presence in SQLite. Elysia keeps the same visibility rules and `formatDiscordActivity` formatter. Patron-facing Connect (Better Auth OAuth + Sense Presence guild) does not change.

Sense green/orange **online dots** stay on Redis / `apps/realtime` (`RealtimeHub`). Discord activity stays a separate profile layer.

## Locked decisions (brainstorm 2026-08-26)

| Topic | Decision |
|-------|----------|
| What the DO owns | **A** — replace Lanyard (Gateway + store). Live browser push deferred |
| Worker / sharding | **1** — dedicated worker, **one** Gateway DO (`getByName("gateway")`) |
| Existing realtime worker | Do **not** bolt Discord onto `apps/realtime` / `RealtimeHub` |
| Read API shape | Lanyard-compatible `GET /v1/users/:id` so `formatDiscordActivity` stays |
| Surfaces / privacy / Connect | Unchanged from 2026-07-28 |
| Pro gate | Unchanged from 2026-08-11 — Attuned+ `discord_activity` when production is on |
| VPS | **Gone** — no Docker Lanyard, no presence VPS |
| Funding bar | **Drop** `DiscordActivityFundingStrip` (“N of T toward a presence server”) |
| Unlock day | Deploy Worker + secrets + `DISCORD_ACTIVITY_ENABLED=true` (staff/ops, not a subscriber-count trigger) |

## Problem

Discord only exposes live presence to a bot that shares a guild with the user **and** holds a Gateway session with the Presence intent. Lanyard is that session plus Redis. A VPS for one WebSocket is the wrong unit of infra for Sense: it blocks production, needs Docker locally, and is a second always-on process next to an API that already talks to Cloudflare Durable Objects for listing occupancy.

Durable Objects uniquely combine **compute + storage**: one globally named isolate can keep the Gateway socket, persist `PRESENCE_UPDATE` in SQLite, and serve strongly consistent reads without Redis.

## Non-goals

- Live WebSocket fan-out to profile / account-menu browsers (deferred; keep ~15s server cache + ~30s client poll)
- Per-user Presence child DOs (revisit if profile-read QPS contends with Gateway processing)
- Merging Discord status colors with Sense online/away dots
- Public Worker URL without the internal secret
- Replacing the Sense Presence guild (Discord still requires shared-guild presence)
- Using `flarecord` / `discord-gateway-cloudflare-do` as a product dependency — implement the Gateway subset we need
- Discord Community features, Rich Presence **from** Sense → Discord

## Architecture

```text
Discord Gateway (wss://gateway.discord.gg)
        ↕  outbound WebSocket via `new WebSocket(url)`
           (not fetch() + Upgrade — that does not work for wss://)
DiscordGateway Durable Object   env.DISCORD_GATEWAY.getByName("gateway")
        • Identify: GUILDS | GUILD_MEMBERS | GUILD_PRESENCES
        • Alarm ~20–30s: Discord heartbeat + keep isolate alive
          (outbound sockets stop blocking eviction after ~15 minutes)
        • SQLite: latest presence JSON per Discord user id
        • Session resume: session_id + seq + resume_gateway_url

Worker  apps/discord-presence   (@still/discord-presence-worker)
        GET  /health
        GET  /v1/users/:discordId     Bearer internal secret
        POST /internal/ensure         wake / connect Gateway DO

Elysia  apps/server
        visibility + formatDiscordActivity (unchanged)
        discord-presence-client replaces lanyard-client
        ~15s in-process cache keyed by Discord snowflake

Web     profile hero + account menu poll (~30s) unchanged
OAuth   Better Auth identify + guilds.join; bot REST join/kick unchanged
```

**Failure domains stay split.** Listing occupancy (`apps/realtime`) and Discord Gateway must not share a Wrangler project, bot token, or deploy. A realtime ship must not evict the Discord Gateway isolate.

### Why one Gateway DO (not per-user DOs)

The Discord bot session **is** the coordination atom. `PRESENCE_UPDATE` arrives on one Gateway connection. Splitting storage into child DOs adds a hop on every event without helping v1 (Pro-gated, hundreds of connected patrons). Profile reads hit the same isolate; the 15s Elysia cache is the QPS buffer. Revisit child DOs only if Gateway message handling and profile reads contend.

### Cloudflare lifecycle constraints (must design for)

- Outbound WebSockets **do not hibernate**.
- An outbound connection keeps the DO in memory for **at most 15 minutes**, then eviction rules resume even if the socket is still open.
- **Alarm** is the keepalive: reschedule every ~20–30s while we want the session up; on alarm, send Discord heartbeat if due, and reconnect if the socket is gone.
- Deploys evict the DO. Persist `session_id` + `seq` in SQLite and resume (op 6) when Discord allows; otherwise Identify (op 2). Alarm reconnects within one interval.
- Use `new WebSocket(url)` for `wss://gateway.discord.gg`. Do not use `setInterval` as the only heartbeat (lost on eviction).

## Worker

### Package

- Path: `apps/discord-presence`
- Name: `@still/discord-presence-worker`
- Wrangler worker name: `discord-presence-still` (mirror `realtime-still`)
- Compatibility date ≥ existing realtime worker; SQLite class via `new_sqlite_classes`
- Tests: `@cloudflare/vitest-pool-workers` for DO mapping + alarm reconnect stubs

### Bindings and secrets

| Binding / secret | Where | Purpose |
|------------------|--------|---------|
| `DISCORD_GATEWAY` | wrangler DO binding | `DiscordGateway` class |
| `DISCORD_BOT_TOKEN` | Worker secret | Gateway Identify only |
| `DISCORD_PRESENCE_GUILD_ID` | Worker var or secret | Ignore presence for other guilds |
| `DISCORD_PRESENCE_INTERNAL_SECRET` | Worker secret | Gate `/v1/users` and `/internal/ensure` |

Elysia **keeps** `DISCORD_BOT_TOKEN` for guild join/kick. The Worker must not call Discord REST for members; it only runs the Gateway.

### HTTP contract (internal)

All mutating/read routes except `/health` require:

```http
Authorization: Bearer <DISCORD_PRESENCE_INTERNAL_SECRET>
```

Timing-safe compare (same pattern as `apps/realtime/src/auth.ts`).

**`GET /v1/users/:discordId`**

```ts
type LanyardCompatibleResponse =
  | { success: true; data: LanyardPresencePayload }
  | { success: false };
```

- Unknown / never-seen user: `{ success: true, data: { discord_status: "offline", activities: [], listening_to_spotify: false, spotify: null } }` — **not 404** (matches how we treat “nothing to show”).
- Never include other patrons’ presence in a single response.

**`GET /health`**

```ts
{ ok: true, gateway: "connected" | "connecting" | "disconnected" }
```

**`POST /internal/ensure`**

Wakes the DO and starts connect if idle. Safe to call from Elysia boot (optional) or a Worker scheduled trigger as a backup to the DO alarm. Primary keepalive is the alarm.

Do not expose this Worker on a public hostname without the secret. Prefer a workers.dev URL that only Elysia knows, same as treating Lanyard as VPC-only.

## Durable Object storage

Initialize schema in the constructor with `blockConcurrencyWhile` (schema only — never across Discord I/O).

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

`session` keys: `session_id`, `seq`, `resume_gateway_url`, `heartbeat_interval_ms`.

**Persist first, then update in-memory cache.** Presence rows are the source of truth across eviction.

On `PRESENCE_UPDATE` / initial `READY` / `GUILD_CREATE` member presences for `DISCORD_PRESENCE_GUILD_ID` only: upsert `payload_json` as the **raw Discord presence object** (user, status, activities, client_status). Mapping to Lanyard shape happens on **read**, not write, so we can fix the mapper without replaying Gateway history.

Clear a row (or write empty activities + offline) when the user goes offline or leaves the guild if Discord sends that update.

## Presence → Lanyard mapping

`LanyardPresencePayload` already used by `formatDiscordActivity`:

- `discord_status` from Discord `status`
- `activities` copied (type, name, details, state, emoji, assets, timestamps)
- Spotify convenience: if an activity is `type === 2` and `name === "Spotify"`, set `listening_to_spotify: true` and fill `spotify` from `details` (song), `state` (artist), `assets.large_image` / `large_text` (art / album), `timestamps`
- Unwrap `mp:external/…` art the same way the formatter already does **or** leave raw and let the formatter unwrap (today `formatListeningActivity` unwraps `assets.large_image`; Spotify path uses `album_art_url` — mapper should unwrap into `album_art_url`)

Priority remains in `formatDiscordActivity` (Spotify object → listening type 2 → playing → streaming → watching). Custom status alone stays omitted.

Unit-test the mapper with fixtures (Spotify RPC, game type 0, streaming type 1, watching type 3, empty, offline). Do not require a live Discord connection for those tests.

## Elysia integration

Replace Lanyard as the infra URL:

| Remove from required infra | Add |
|----------------------------|-----|
| `LANYARD_INTERNAL_URL` | `DISCORD_PRESENCE_WORKER_URL` (e.g. `http://127.0.0.1:8788` local, workers.dev in prod) |
| | `DISCORD_PRESENCE_INTERNAL_SECRET` (must match Worker secret) |

`isDiscordActivityEnabled()` / `hasDiscordActivityInfrastructure()` (server **and** `packages/auth`) require flag + OAuth + bot + guild + **Worker URL + internal secret**.

Rename `lanyard-client.ts` → `discord-presence-client.ts` (keep 15s TTL cache, 5s fetch timeout, swallow errors → `null`). URL: `{DISCORD_PRESENCE_WORKER_URL}/v1/users/{id}` with the Bearer secret. Tests that mock `getCachedLanyardPresence` follow the rename (`getCachedDiscordPresence`).

`GET /api/profiles/:handle/discord-activity` and web UI stay.

Optional: Elysia `POST /internal/ensure` once when the flag is on and cache is cold — not required if the DO alarm is running.

## Local development

1. Copy `apps/discord-presence/.dev.vars.example` → `.dev.vars` (`DISCORD_BOT_TOKEN`, `DISCORD_PRESENCE_INTERNAL_SECRET`, `DISCORD_PRESENCE_GUILD_ID`).
2. `bun run --filter @still/discord-presence-worker dev` (`wrangler dev`, loopback port documented in the example — default Wrangler **8788** unless taken).
3. `apps/server` `.env`: `DISCORD_PRESENCE_WORKER_URL=http://127.0.0.1:8788` and the same internal secret.
4. Patron still must be in the Sense Presence guild (OAuth Connect unchanged).

**Retire** `docker/discord-lanyard.compose.yml` and Lanyard-specific comments in `docker/discord-setup.env.example`. Discord Developer Portal checklist (app, bot, Presence + Server Members intents, presence guild) stays.

Do not add the Discord Worker to default `turbo dev` until local dogfood is easy — same caution as not running Lanyard by default. Document `dev:discord-presence` on the package.

## Product: funding strip

The 2026-08-11 strip exists because Lanyard needed a VPS. That story is false after this change.

- **Unmount** `DiscordActivityFundingStrip` from Pricing and Settings.
- Do **not** keep a Polar `N of T` bar for Discord.
- Settings while production is **off**: keep a Pro teaser that Discord activity is an Attuned+ perk — **no** working Connect, **no** fake funding progress.
- Settings while production is **on**: existing Connect / toggle / disconnect for Pro; Still sees upgrade copy (unchanged).
- Delete the Discord funding stack in the same ship: `GET /api/discord-activity/funding`, `discord-activity-funding` server lib, web fetch helper, and the strip. Delete `countPolarPayingSubscribers` if it has no remaining callers.
- Unlock is still **ops**: Worker live + env + `DISCORD_ACTIVITY_ENABLED=true` + `discord_activity` plan feature `exists`. Hitting a subscriber target does **not** auto-enable.

Copy must not say “presence server” or “VPS”. Changelog / What's New that mention funding-the-server should be revised in the same release that drops the strip.

## Error handling

| Case | Behavior |
|------|----------|
| Gateway down / connecting | Profile omits row; `/health` `disconnected` or `connecting` |
| Op 7 reconnect, missed heartbeat, deploy eviction | Alarm reconnects; resume if `session_id`+seq exist |
| Op 9 invalid session | Backoff 1–5s, fresh Identify; honor Discord `session_start_limit` |
| Reconnect storm | Exponential backoff, cap; never tight Identify loop |
| Patron left presence guild | Empty activity; Settings **Reconnect** (existing) |
| Worker 401 / timeout / 5xx | Elysia → `null`; 15s cache may serve last good payload |
| Discord rate limit | Serve last stored presence; backoff Gateway traffic |

Patron-facing silence matches 2026-07-28: no error banner on profile when infra is unhealthy.

## Security

- Internal secret on Worker reads; never a public unauthenticated presence API.
- Never return Discord snowflakes in `GET /api/profiles/:handle/discord-activity`.
- Bot token only on Worker (Gateway) and Elysia (guild REST) — not on `apps/web`.
- Persist presence ephemerally (latest snapshot only). No historical presence log.
- Visibility still enforced in Elysia (`canViewerSeeDiscordActivity`); the Worker does not know Sense patrons.

## Testing

| Area | Cases |
|------|--------|
| Presence mapper | Spotify RPC → `listening_to_spotify` + `spotify`; type 0/1/2/3; empty; offline |
| DO storage | Upsert on `PRESENCE_UPDATE`; read returns Lanyard shape; unknown id empty success |
| Gateway session | Alarm reconnects when socket missing; resume vs Identify; op 9 backoff (mocked WS) |
| Worker auth | Missing/wrong Bearer → 401; `/health` unauthenticated OK |
| Elysia client | Cache TTL; timeout → null; secret header present |
| Infra flag | Enabled only when Worker URL + secret + Discord OAuth/bot/guild set |
| Funding UI | Strip gone from Pricing + Settings; production-off Settings still a teaser without Connect |

Live Discord E2E stays a **manual** checklist (Connect, Spotify, game, disconnect) — same as Task 0 today, minus Docker.

## Rollout

1. Ship Worker to Cloudflare (secrets set; Gateway connects; `/health` `connected`).
2. Point staging Elysia at the Worker; dogfood with team Discord accounts.
3. Remove Lanyard compose from docs; stop any staging Lanyard container.
4. Production: same env swap; `DISCORD_ACTIVITY_ENABLED=true`; plan feature `exists`; drop funding strip.
5. Monitor `/health` + Worker logs for Identify storms and Discord session limits.

## Files (expected)

| Area | Likely touch |
|------|----------------|
| New | `apps/discord-presence/**` (wrangler, DO, mapper, tests, `.dev.vars.example`) |
| Env | `packages/env/src/server.ts` — Worker URL + secret; drop `LANYARD_INTERNAL_URL` from required set |
| Server | `lanyard-client.ts` → Worker client; `discord-activity-config.ts` + tests |
| Auth | `packages/auth/src/lib/discord-activity-config.ts` |
| Web | Unmount funding strip; Settings teaser copy |
| Docker | Retire `docker/discord-lanyard.compose.yml`; update `docker/discord-setup.env.example` |
| Docs | This spec; pointer from 2026-07-28 architecture + 2026-08-11 unlock checklist |

## Success criteria

1. Local `wrangler dev` + Elysia shows live Spotify/game activity for a guild member **without** Docker Lanyard.
2. Profile and account menu behavior unchanged (visibility, Pro gate, formatter).
3. Killing Lanyard (if still running) does not affect activity; killing the Worker omits the row silently.
4. Pricing / Settings no longer show a Discord VPS funding bar.
5. `apps/realtime` deploy does not reconnect Discord Gateway.

## Open questions

_None — brainstorm locked on A / 1 / Lanyard-shaped reads / drop funding bar._
