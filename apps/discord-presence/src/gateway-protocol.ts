/**
 * Pure Discord Gateway protocol helpers.
 * Keep WebSockets, fetch, and Durable Object I/O out of this module so Bun can
 * unit-test Identify/Resume/heartbeat without hitting Discord.
 */

import type { DiscordPresenceSnapshot } from "./presence-mapper";

/** GUILDS (1<<0) | GUILD_MEMBERS (1<<1) | GUILD_PRESENCES (1<<8). */
export const DISCORD_GATEWAY_INTENTS = (1 << 0) | (1 << 1) | (1 << 8);

/** Discord Gateway opcodes we handle. Unknown ops are ignored, never thrown. */
export const GatewayOp = {
	DISPATCH: 0,
	HEARTBEAT: 1,
	IDENTIFY: 2,
	RESUME: 6,
	RECONNECT: 7,
	INVALID_SESSION: 9,
	HELLO: 10,
	HEARTBEAT_ACK: 11,
} as const;

const IDENTIFY_CLIENT = "sense-discord-presence";
const IDENTIFY_OS = "cloudflare";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_CAP_MS = 60_000;
const INVALID_SESSION_IDENTIFY_MIN_MS = 1_000;
const INVALID_SESSION_IDENTIFY_SPAN_MS = 4_000;

export type GatewaySessionState = {
	sessionId: string | null;
	seq: number | null;
	resumeGatewayUrl: string | null;
	heartbeatIntervalMs: number | null;
	lastHeartbeatAckAt: number | null;
	presenceGuildId: string;
};

export type PersistedSessionFields = {
	sessionId: string | null;
	seq: number | null;
	resumeGatewayUrl: string | null;
	heartbeatIntervalMs: number | null;
};

export type GatewayAction =
	| { type: "identify" }
	| { type: "resume" }
	| { type: "heartbeat" }
	| { type: "reconnect" }
	| { type: "identify_after_ms"; delayMs: number }
	| {
			type: "upsert_presence";
			discordUserId: string;
			snapshot: DiscordPresenceSnapshot;
	  }
	| ({ type: "persist_session" } & PersistedSessionFields);

export type GatewayBotInfo = {
	url: string;
	remaining: number | null;
	resetAfterMs: number | null;
};

export function emptyGatewaySession(
	presenceGuildId: string,
): GatewaySessionState {
	return {
		sessionId: null,
		seq: null,
		resumeGatewayUrl: null,
		heartbeatIntervalMs: null,
		lastHeartbeatAckAt: null,
		presenceGuildId,
	};
}

export function persistFieldsFromState(
	state: GatewaySessionState,
): PersistedSessionFields {
	return {
		sessionId: state.sessionId,
		seq: state.seq,
		resumeGatewayUrl: state.resumeGatewayUrl,
		heartbeatIntervalMs: state.heartbeatIntervalMs,
	};
}

/** Restore SQLite `session` rows after Durable Object eviction. */
export function sessionStateFromRows(
	base: GatewaySessionState,
	rows: readonly { k: string; v: string }[],
): GatewaySessionState {
	const values = new Map(rows.map((row) => [row.k, row.v]));
	return {
		...base,
		sessionId: emptyToNull(values.get("session_id")),
		seq: parseStoredInt(values.get("seq")),
		resumeGatewayUrl: emptyToNull(values.get("resume_gateway_url")),
		heartbeatIntervalMs: parseStoredInt(values.get("heartbeat_interval_ms")),
	};
}

/**
 * Identify (op 2). `properties.browser` and `properties.device` identify this
 * Worker to Discord; `os` is any short string.
 */
export function buildIdentifyPayload(token: string): unknown {
	return {
		op: GatewayOp.IDENTIFY,
		d: {
			token,
			intents: DISCORD_GATEWAY_INTENTS,
			properties: {
				os: IDENTIFY_OS,
				browser: IDENTIFY_CLIENT,
				device: IDENTIFY_CLIENT,
			},
		},
	};
}

/** Resume (op 6) after eviction when session_id + seq are still valid. */
export function buildResumePayload(
	token: string,
	sessionId: string,
	seq: number,
): unknown {
	return {
		op: GatewayOp.RESUME,
		d: {
			token,
			session_id: sessionId,
			seq,
		},
	};
}

/** Heartbeat (op 1). `d` is the last dispatch seq, or null before READY. */
export function buildHeartbeatPayload(seq: number | null): unknown {
	return { op: GatewayOp.HEARTBEAT, d: seq };
}

/**
 * Reconnect backoff: 1s × 2^attempt, cap 60s, equal jitter.
 * Pass `random` (0–1) for deterministic tests.
 */
export function nextReconnectDelayMs(
	attempt: number,
	random: () => number = Math.random,
): number {
	const exp = Math.max(0, attempt);
	const base = Math.min(RECONNECT_BASE_MS * 2 ** exp, RECONNECT_CAP_MS);
	const jittered = Math.floor(base * (0.5 + 0.5 * clamp01(random())));
	return Math.min(RECONNECT_CAP_MS, Math.max(RECONNECT_BASE_MS, jittered));
}

/**
 * Delay until the next Durable Object alarm.
 * `keepaliveMs` (25s) is a ceiling so Cloudflare does not evict the isolate
 * (~15 min outbound WebSocket idle). When a Discord heartbeat is due sooner,
 * wake at that instant: `min(keepalive, lastSent + interval - now)`.
 *
 * Callers should send first when due (`lastSent == null` or
 * `now - lastSent >= interval`), then schedule with the updated `lastSent`.
 *
 * After a send at t=25000 with interval 41250: at t=25000 delay is 25000;
 * at t=50000 delay is 16250; next send lands at 66250 (one interval later).
 */
export function nextAlarmDelayMs(args: {
	nowMs: number;
	lastHeartbeatSentAt: number | null;
	heartbeatIntervalMs: number | null;
	keepaliveMs: number;
}): number {
	const { nowMs, lastHeartbeatSentAt, heartbeatIntervalMs, keepaliveMs } = args;
	if (heartbeatIntervalMs == null || lastHeartbeatSentAt == null) {
		return keepaliveMs;
	}
	const untilHeartbeat = lastHeartbeatSentAt + heartbeatIntervalMs - nowMs;
	return Math.min(keepaliveMs, Math.max(0, untilHeartbeat));
}

/**
 * Discord disconnects if we miss heartbeats. Treat as missed when HELLO has
 * set an interval and the last ACK is missing or older than 2× that interval.
 */
export function shouldReconnectForMissedHeartbeat(
	state: GatewaySessionState,
	nowMs: number,
): boolean {
	if (state.heartbeatIntervalMs == null) return false;
	if (state.lastHeartbeatAckAt == null) return true;
	return nowMs - state.lastHeartbeatAckAt > 2 * state.heartbeatIntervalMs;
}

export function parseGatewayBotResponse(body: unknown): GatewayBotInfo | null {
	if (!isRecord(body)) return null;
	if (typeof body.url !== "string" || body.url.length === 0) return null;
	const limit = body.session_start_limit;
	let remaining: number | null = null;
	let resetAfterMs: number | null = null;
	if (isRecord(limit)) {
		if (typeof limit.remaining === "number") remaining = limit.remaining;
		if (typeof limit.reset_after === "number") resetAfterMs = limit.reset_after;
	}
	return { url: body.url, remaining, resetAfterMs };
}

/** `session_start_limit.remaining === 0` → wait, do not Identify/open yet. */
export function shouldWaitForSessionStartLimit(info: GatewayBotInfo): boolean {
	return info.remaining === 0;
}

/** `new WebSocket(url)` query — never `fetch` + Upgrade for Discord wss. */
export function buildGatewaySocketUrl(gatewayUrl: string): string {
	const url = new URL(gatewayUrl);
	url.searchParams.set("v", "10");
	url.searchParams.set("encoding", "json");
	return url.toString();
}

export function canResumeSession(state: GatewaySessionState): boolean {
	return state.sessionId != null && state.seq != null;
}

/**
 * Apply one Gateway JSON payload. Returns 0+ actions. Never throws on unknown
 * ops or malformed shapes.
 */
export function applyGatewayMessage(
	state: GatewaySessionState,
	message: unknown,
	nowMs: number,
	random: () => number = Math.random,
): { state: GatewaySessionState; actions: GatewayAction[] } {
	if (!isRecord(message) || typeof message.op !== "number") {
		return { state, actions: [] };
	}

	const next: GatewaySessionState = { ...state };
	if (typeof message.s === "number") {
		next.seq = message.s;
	}

	switch (message.op) {
		case GatewayOp.HELLO:
			return applyHello(next, message.d, nowMs);
		case GatewayOp.HEARTBEAT:
			// Discord may request an immediate heartbeat (op 1) on this socket.
			return { state: next, actions: [{ type: "heartbeat" }] };
		case GatewayOp.HEARTBEAT_ACK:
			next.lastHeartbeatAckAt = nowMs;
			return { state: next, actions: [] };
		case GatewayOp.RECONNECT:
			return { state: next, actions: [{ type: "reconnect" }] };
		case GatewayOp.INVALID_SESSION:
			return applyInvalidSession(next, message.d, random);
		case GatewayOp.DISPATCH:
			return applyDispatch(next, message);
		default:
			return { state, actions: [] };
	}
}

function applyHello(
	state: GatewaySessionState,
	data: unknown,
	nowMs: number,
): { state: GatewaySessionState; actions: GatewayAction[] } {
	if (isRecord(data) && typeof data.heartbeat_interval === "number") {
		state.heartbeatIntervalMs = data.heartbeat_interval;
	}
	// Seed last ACK so we do not immediately trip missed-heartbeat reconnect.
	state.lastHeartbeatAckAt = nowMs;
	const actions: GatewayAction[] = [
		persistAction(state),
		canResumeSession(state) ? { type: "resume" } : { type: "identify" },
	];
	return { state, actions };
}

function applyInvalidSession(
	state: GatewaySessionState,
	data: unknown,
	random: () => number,
): { state: GatewaySessionState; actions: GatewayAction[] } {
	if (data === true) {
		return { state, actions: [{ type: "resume" }] };
	}

	state.sessionId = null;
	state.seq = null;
	state.resumeGatewayUrl = null;
	const delayMs =
		INVALID_SESSION_IDENTIFY_MIN_MS +
		Math.floor(clamp01(random()) * INVALID_SESSION_IDENTIFY_SPAN_MS);
	return {
		state,
		actions: [persistAction(state), { type: "identify_after_ms", delayMs }],
	};
}

function applyDispatch(
	state: GatewaySessionState,
	message: Record<string, unknown>,
): { state: GatewaySessionState; actions: GatewayAction[] } {
	const eventName = message.t;
	const actions: GatewayAction[] = [];

	if (eventName === "READY") {
		applyReadyPayload(state, message.d);
	}

	if (typeof message.s === "number") {
		actions.push(persistAction(state));
	}

	if (eventName === "READY") {
		actions.push(...collectPresenceUpserts(state.presenceGuildId, message.d));
	} else if (eventName === "PRESENCE_UPDATE") {
		const upsert = presenceUpsertFromPayload(state.presenceGuildId, message.d);
		if (upsert) actions.push(upsert);
	}

	return { state, actions };
}

function applyReadyPayload(state: GatewaySessionState, data: unknown): void {
	if (!isRecord(data)) return;
	if (typeof data.session_id === "string") {
		state.sessionId = data.session_id;
	}
	if (typeof data.resume_gateway_url === "string") {
		state.resumeGatewayUrl = data.resume_gateway_url;
	}
}

function collectPresenceUpserts(
	presenceGuildId: string,
	readyData: unknown,
): GatewayAction[] {
	if (!isRecord(readyData) || !Array.isArray(readyData.presences)) return [];
	const actions: GatewayAction[] = [];
	for (const presence of readyData.presences) {
		const upsert = presenceUpsertFromPayload(presenceGuildId, presence);
		if (upsert) actions.push(upsert);
	}
	return actions;
}

function presenceUpsertFromPayload(
	presenceGuildId: string,
	payload: unknown,
): Extract<GatewayAction, { type: "upsert_presence" }> | null {
	if (!isRecord(payload)) return null;
	if (shouldIgnoreGuild(presenceGuildId, payload.guild_id)) return null;
	if (!isRecord(payload.user) || typeof payload.user.id !== "string") {
		return null;
	}
	return {
		type: "upsert_presence",
		discordUserId: payload.user.id,
		snapshot: payload as DiscordPresenceSnapshot,
	};
}

/**
 * Ignore presence when `guild_id` is a non-empty string that is not our Sense
 * Presence guild. Missing / empty `guild_id` still upserts (DMs, unscoped).
 */
function shouldIgnoreGuild(presenceGuildId: string, guildId: unknown): boolean {
	return (
		typeof guildId === "string" &&
		guildId.length > 0 &&
		guildId !== presenceGuildId
	);
}

function persistAction(state: GatewaySessionState): GatewayAction {
	return { type: "persist_session", ...persistFieldsFromState(state) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

function emptyToNull(value: string | undefined): string | null {
	if (value == null || value.length === 0) return null;
	return value;
}

function parseStoredInt(value: string | undefined): number | null {
	const raw = emptyToNull(value);
	if (raw == null) return null;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : null;
}

function clamp01(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}
