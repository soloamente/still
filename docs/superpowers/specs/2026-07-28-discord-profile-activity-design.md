# Sense — Discord profile activity (Listening / Playing)

**Status:** Approved (2026-07-29) — brainstorm locked  
**Date:** 2026-07-28  
**Topic:** Live Discord activity lines on profile via Sense-owned presence guild + self-hosted Lanyard  
**Related:** [`2026-06-16-presence-online-visibility-design.md`](./2026-06-16-presence-online-visibility-design.md), [`2026-06-30-presence-self-view-design.md`](./2026-06-30-presence-self-view-design.md)

## Summary

Patrons **Connect Discord** in Settings with a **one-click OAuth** flow. Sense adds them to a **minimal Sense Presence Discord guild** (no community/chat pressure) and reads live Discord activities (Spotify, games, streaming, custom status) through a **self-hosted Lanyard** stack. Activity renders as a compact row on **`/profile/[handle]`** and as a live self-preview in the **account menu** — not on every portrait in feed/ranks.

Sense **online/away dots** remain the existing Redis presence system; Discord activity is a separate, opt-out-capable profile layer.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Content | Activity lines — **Listening to** / **Playing** / **Streaming** / custom status; hide when empty |
| Surfaces | **Profile hero** + **own account menu** preview only (not inline on every portrait) |
| Source | **Discord** live presence (not Spotify-only substitute) |
| Third-party Lanyard server | **No** — self-hosted Lanyard + Sense bot |
| Patron Discord server | **Sense Presence guild** — utilitarian, presence-only; no chat expectation |
| Connect UX | **One click** — OAuth (`identify` + `guilds.join`); bot adds patron to presence guild (no manual invite link) |
| Manual / auto guild join copy | Patrons never hunt a Lanyard invite; guild membership is disclosed in privacy copy as required for activity |
| Privacy visibility | Reuse `preferences.privacy.presenceVisibility`: **`friends`** (mutual follow) default · **`public`** |
| Activity master toggle | `preferences.integrations.discordActivityEnabled` — default **`true`** when connected; **`false`** on disconnect |
| Self-view | Patron always sees own activity in account menu when connected + enabled (same pattern as presence self-view) |
| Refresh | Server-side fetch + **~15s cache** per Discord user; account menu **~30s poll on open**; no browser WebSocket to Lanyard in v1 |
| Recommendation | Settings card + optional post-onboarding nudge; **skippable**, not blocking |
| Tier gating | **None** for v1 — available to all signed-in patrons who connect |
| Architecture | **Self-hosted Lanyard (Docker + Redis)** + Better Auth Discord OAuth + Elysia proxy route |

## Problem

Patrons want taste identity to extend beyond diary logs — including **what they are listening to or playing right now**, Discord-style, without leaving Sense. Hosted Lanyard requires joining a third-party server; patrons rejected that. Discord’s API only exposes live presence to bots that **share a guild** with the user, so Sense must operate its own minimal presence guild and infra while keeping connect **easy and recommended**.

## Non-goals (v1)

- Live Discord activity on feed rows, leaderboards, comments, or listing presence corner
- Replacing or merging Sense online/away dots with Discord status colors
- Discord login as primary auth (link-only; email/password remains primary)
- Public client access to Lanyard or raw Discord snowflakes
- Sense Community Discord features (announcements, channels) — presence guild is separate and minimal
- Rich Presence **from Sense → Discord** (showing “On Sense” inside Discord client)

## Product behavior

### Connect (Settings → Profile)

1. Patron taps **Connect Discord** (recommended card; optional onboarding chip after taste setup).
2. Discord OAuth with scopes **`identify`** + **`guilds.join`**.
3. On success:
   - Better Auth stores/updates `account` row (`providerId: "discord"`, `accountId` = snowflake).
   - Sense bot REST-adds patron to **Sense Presence guild**.
   - Set `preferences.integrations.discordActivityEnabled: true` (if unset).
4. Success copy: *Discord connected — your profile can show what you're up to.*
5. Helper text (plain language): activity requires Sense’s presence Discord guild; **no posting or chatting required**; channels locked/hidden.

### Disconnect

1. Patron taps **Disconnect Discord** in Settings.
2. Better Auth unlinks Discord `account` row.
3. Bot removes patron from presence guild (best effort).
4. Set `discordActivityEnabled: false`.
5. Activity row hidden **immediately** on profile and account menu.

### Profile activity row

- Renders below bio / near portrait hero when **activity exists** and viewer passes visibility gates.
- Formats (examples):
  - **Listening to** *Let Go* · Spotify (+ optional 40×40 album art)
  - **Playing** *Hades II*
  - **Streaming** *Episode title* (when Discord activity type = streaming)
  - Custom status only: *🎬 movie night* (when no richer activity)
- **Hidden** when: not connected, toggle off, no current activity, viewer not allowed, Lanyard unavailable, patron left guild.
- **No** “Offline on Discord” or idle/DND badge row when activity empty.
- Optional outbound link: Discord profile (`discord.com/users/{id}`) on row tap — opens new tab; not required for v1.

### Account menu (self only)

- When connected + enabled, show the same formatted line under the patron name block.
- Screen reader: second person — *You are listening to …* / *You are playing …*
- Poll/refetch on menu open (max ~30s interval while open).

### Privacy

- **`presenceVisibility: "friends"`** (default): mutual followers only.
- **`presenceVisibility: "public"`**: any signed-in viewer who can view the profile.
- **Unsigned viewers:** never see Discord activity (even on public profiles).
- **Private profiles:** follow existing profile view rules; activity never leaks via API when profile is 404/hidden.
- **`discordActivityEnabled: false`:** hide activity from others; patron still sees disconnected state in Settings (not live preview in menu).
- Patron **always** sees own live activity in account menu when connected + enabled (ignores `presenceVisibility` for self).

### Sense presence parity

- Green/orange **online dot** unchanged (`PatronOnlineProvider`, listing presence).
- Discord activity row is **additive**; do not duplicate dot semantics or replace Sense AFK logic.

## Architecture

```text
Settings Connect
  → Better Auth Discord OAuth (identify + guilds.join)
  → account table (providerId discord)
  → Sense bot: PUT /guilds/{presenceGuildId}/members/{userId}
  → Self-hosted Lanyard monitors snowflake via Discord Gateway

Profile / account menu read
  → GET /api/profiles/:handle/discord-activity
  → resolve viewer + profile owner + visibility
  → if allowed: GET {LANYARD_INTERNAL}/v1/users/{discordId}
  → normalize → { kind, title, subtitle?, imageUrl? }
  → cache 15s per discordId in server memory/Redis

Disconnect / delete account
  → unlink account + bot kick member (best effort)
```

### Components

| Component | Responsibility |
|-----------|----------------|
| **Sense Presence Discord guild** | Minimal guild; locked channels; no community IA |
| **Sense Discord application + bot** | Privileged intents: **Presence**, **Server Members**; handles `guilds.join` adds |
| **Self-hosted Lanyard** | Docker image `phineas/lanyard` + Redis; internal network only |
| **Better Auth** | `socialProviders.discord` with extended scopes |
| **`account` table** | Existing Better Auth storage for Discord link |
| **`discord-activity.ts` (server lib)** | Lanyard response → Sense display model + copy formatter |
| **`GET .../discord-activity` (Elysia)** | Viewer-scoped read; never returns discordId to clients |
| **`ProfileDiscordActivityRow` (web)** | Profile hero UI |
| **Account menu strip** | Self preview; reuses formatter types |

### Activity normalization

| Lanyard / Discord input | `kind` | Display template |
|-------------------------|--------|------------------|
| `listening_to_spotify` + `spotify` object | `listening` | Listening to **{song}** · Spotify |
| Activity `type: 0` (Playing) | `playing` | Playing **{name}** |
| Activity `type: 1` (Streaming) | `streaming` | Streaming **{details}** |
| Custom status in activities | `custom` | **{emoji}** {text} |
| None / offline / missing guild | — | omit row |

Formatter lives in `apps/server/src/lib/discord-activity.ts` with unit tests; web receives already-formatted strings + optional `imageUrl` (Spotify album art).

### Caching and performance

- **15s TTL** cache keyed by Discord snowflake on Elysia (in-process OK for v1; Redis optional if multi-instance).
- Profile RSC may embed initial activity in profile payload to avoid waterfall; respect cache.
- Do not subscribe browsers to Lanyard WebSocket (keeps Discord IDs server-side; fewer open sockets).
- Account menu: fetch on open only; `staleTime` 30s.

## Data model

### Better Auth `account` (existing)

- `providerId: "discord"`
- `accountId`: Discord snowflake (used for Lanyard lookup and guild member id)

No migration required for link storage.

### Profile `preferences` (JSON)

```ts
preferences.integrations.discordActivityEnabled?: boolean // default true when connected
```

Privacy continues to use nested:

```ts
preferences.privacy.presenceVisibility: "friends" | "public"
```

Helpers mirror `readProfilePresenceVisibilityPref` in `profile-media.ts` / `profile-preferences.ts`.

## API

### `GET /api/profiles/:handle/discord-activity`

**Auth:** optional session (unsigned → always `{ visible: false }`).

**Response (200):**

```ts
type DiscordActivityResponse =
  | { visible: false }
  | {
      visible: true;
      activity: {
        kind: "listening" | "playing" | "streaming" | "custom";
        label: string;       // primary line, e.g. "Listening to Let Go"
        detail?: string;     // e.g. "Spotify" or artist line
        imageUrl?: string | null;
      };
    };
```

**Server rules:**

1. Resolve profile by handle; 404 if profile not viewable (same as profile page).
2. If owner has no Discord `account` link or `discordActivityEnabled === false` → `{ visible: false }`.
3. Apply `presenceVisibility` + mutual follow check (reuse patron-presence visibility helpers).
4. If viewer is owner → return activity when connected + enabled (self-view).
5. Fetch Lanyard internally; on failure → `{ visible: false }` (no error banner on profile).

### Settings PATCH

- Shallow-merge `preferences.integrations.discordActivityEnabled`.
- Connect/disconnect flows use Better Auth link/unlink endpoints + bot guild member API (not PATCH alone).

## Web UI

### Settings → Profile

- **Discord** section:
  - Disconnected: **Connect Discord** primary button + short benefit copy.
  - Connected: show Discord username, **Show activity on profile** toggle (`discordActivityEnabled`), **Disconnect** (destructive text button).
- Link to privacy explainer: uses same audience as **online presence** (`friends` / `public` in Settings → Privacy).

### Profile hero

- `ProfileDiscordActivityRow` under bio block (after taste pill / before showcase strips).
- Single line + optional 32–40px rounded artwork; `text-muted-foreground` secondary detail.
- `@media (hover: hover)` only enhancements; no hover-only core info.
- `prefers-reduced-motion`: no live ticker/marquee on long song titles — truncate with ellipsis.

### Account menu

- Compact row under name/handle when self connected.
- Truncation + `title` attribute for full string.

## Discord & Lanyard operations

### Discord application setup

1. Create Discord application + bot.
2. Enable **Presence Intent** and **Server Members Intent** (apply for verification before scale).
3. Create **Sense Presence** guild; bot is sole admin; no public invite URL marketed.
4. Configure OAuth redirect via Better Auth.

### Self-hosted Lanyard

- Deploy alongside API or internal network (Docker Compose: `lanyard` + `redis`).
- **Local dev:** `docker/discord-lanyard.compose.yml` — see Task 0 checklist in file header.
- `BOT_TOKEN` = same Sense bot token as `DISCORD_BOT_TOKEN`.
- `LANYARD_INTERNAL_URL` reachable from `apps/server` only (not public internet).

### Environment variables (server)

| Variable | Purpose |
|----------|---------|
| `DISCORD_CLIENT_ID` | OAuth |
| `DISCORD_CLIENT_SECRET` | OAuth |
| `DISCORD_BOT_TOKEN` | Guild join/kick + Lanyard |
| `DISCORD_PRESENCE_GUILD_ID` | Presence-only guild snowflake |
| `LANYARD_INTERNAL_URL` | e.g. `http://lanyard:4001` |
| `LANYARD_REDIS_URL` | if server cache shares Redis (optional) |

Web env: none (all reads proxied through Elysia).

## Error handling & edge cases

| Case | Behavior |
|------|----------|
| Patron left Sense Presence guild manually | Activity empty; Settings banner: **Reconnect Discord** |
| Lanyard / Redis down | Profile omits row silently; log server-side |
| Discord rate limit | Serve stale cache; backoff |
| OAuth denied / missing `guilds.join` | Connect fails with clear copy; no partial link |
| Guild join fails after OAuth | Keep OAuth link; show **Finish setup** retry that runs guild join only (do not force full re-auth) |
| User bans / account delete | `beforeDelete` kicks guild member; cascade deletes `account` |
| Impersonation | Staff do not see target Discord activity unless visibility rules pass; no staff bypass |

## Security & privacy

- Never expose Discord snowflake in HTML/JSON to other patrons.
- Lanyard not exposed publicly; firewall to server VPC.
- Privacy policy update: Discord presence read while member of Sense Presence guild; data used only for profile activity display.
- Do not store full Lanyard payload historically (ephemeral cache only).

## Accessibility

- Activity row: `aria-live="polite"` on account menu self row only (not profile visitor view — avoids noisy announcements).
- Icon + text; album art `alt=""` decorative when adjacent text repeats title.
- Connect button: visible focus ring (box-shadow pattern per design system).

## Testing

| Area | Tests |
|------|-------|
| `formatDiscordActivity(lanyardPayload)` | Spotify, playing, streaming, custom, empty |
| Visibility gate | friends/public/self/unsigned/private profile |
| API route | mocked Lanyard; 404 profile; disconnected |
| Connect callback | guild join mocked; failure retry path |
| Disconnect | unlinks + disables preference |

## Rollout

1. Deploy Lanyard + bot + presence guild in staging.
2. Ship Settings connect behind env flag `DISCORD_ACTIVITY_ENABLED=true`.
3. Dogfood with team accounts; verify Spotify + game activities.
4. Enable in production; add Settings recommendation copy.
5. Monitor Lanyard uptime + Discord intent health.

## Future (explicitly deferred)

- Hover preview on portraits (desktop) for followed patrons
- WebSocket push to profile for sub-minute updates
- Filter activities (hide games, show Spotify only)
- Merge with Sense “Watching …” from `tv_watch`
- Devoted community Discord separate from presence guild

## Open questions

_None — brainstorm locked. File issues during implementation if Discord verification timeline blocks staging._
