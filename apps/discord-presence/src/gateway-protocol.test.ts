import { describe, expect, test } from "bun:test";

import {
	applyGatewayMessage,
	buildGatewaySocketUrl,
	buildHeartbeatPayload,
	buildIdentifyPayload,
	buildResumePayload,
	DISCORD_GATEWAY_INTENTS,
	emptyGatewaySession,
	type GatewayAction,
	nextAlarmDelayMs,
	nextReconnectDelayMs,
	parseGatewayBotResponse,
	sessionStateFromRows,
	shouldReconnectForMissedHeartbeat,
	shouldWaitForSessionStartLimit,
} from "./gateway-protocol";

const GUILD = "presence-guild-1";
const NOW = 1_700_000_000_000;

function emptyState() {
	return emptyGatewaySession(GUILD);
}

function resumableState() {
	return {
		...emptyState(),
		sessionId: "session-abc",
		seq: 7,
		resumeGatewayUrl: "wss://gateway-us-east1-b.discord.gg",
	};
}

function actionOfType<T extends GatewayAction["type"]>(
	actions: GatewayAction[],
	type: T,
): Extract<GatewayAction, { type: T }> | undefined {
	return actions.find(
		(action): action is Extract<GatewayAction, { type: T }> =>
			action.type === type,
	);
}

function upsertIds(actions: GatewayAction[]): string[] {
	return actions
		.filter(
			(action): action is Extract<GatewayAction, { type: "upsert_presence" }> =>
				action.type === "upsert_presence",
		)
		.map((action) => action.discordUserId);
}

describe("DISCORD_GATEWAY_INTENTS", () => {
	test("is GUILDS | GUILD_MEMBERS | GUILD_PRESENCES", () => {
		expect(DISCORD_GATEWAY_INTENTS).toBe((1 << 0) | (1 << 1) | (1 << 8));
		expect(DISCORD_GATEWAY_INTENTS).toBe(259);
	});
});

describe("buildIdentifyPayload", () => {
	test("Identify JSON includes token, intents 259, and Sense client properties", () => {
		const payload = buildIdentifyPayload("bot-token");
		expect(payload).toEqual({
			op: 2,
			d: {
				token: "bot-token",
				intents: 259,
				properties: {
					os: expect.any(String),
					browser: "sense-discord-presence",
					device: "sense-discord-presence",
				},
			},
		});
		const os = (payload as { d: { properties: { os: string } } }).d.properties
			.os;
		expect(os.length).toBeGreaterThan(0);
		expect(os.length).toBeLessThan(32);
	});
});

describe("buildResumePayload / buildHeartbeatPayload", () => {
	test("Resume is op 6 with token, session_id, and seq", () => {
		expect(buildResumePayload("bot-token", "session-abc", 12)).toEqual({
			op: 6,
			d: { token: "bot-token", session_id: "session-abc", seq: 12 },
		});
	});

	test("Heartbeat is op 1 with the last seq (including null)", () => {
		expect(buildHeartbeatPayload(12)).toEqual({ op: 1, d: 12 });
		expect(buildHeartbeatPayload(null)).toEqual({ op: 1, d: null });
	});
});

describe("nextReconnectDelayMs", () => {
	test("starts at 1s, caps at 60s, and stays in bounds with jitter", () => {
		expect(nextReconnectDelayMs(0, () => 0)).toBeGreaterThanOrEqual(1_000);
		expect(nextReconnectDelayMs(0, () => 1)).toBeLessThanOrEqual(60_000);
		expect(nextReconnectDelayMs(10, () => 1)).toBe(60_000);
		expect(nextReconnectDelayMs(10, () => 0)).toBeGreaterThanOrEqual(1_000);
		expect(nextReconnectDelayMs(10, () => 0)).toBeLessThanOrEqual(60_000);
	});

	test("is deterministic when rng is provided", () => {
		expect(nextReconnectDelayMs(3, () => 0.25)).toBe(
			nextReconnectDelayMs(3, () => 0.25),
		);
	});
});

describe("applyGatewayMessage", () => {
	test("unknown ops and garbage payloads never throw and emit no actions", () => {
		expect(applyGatewayMessage(emptyState(), null, NOW).actions).toEqual([]);
		expect(applyGatewayMessage(emptyState(), "nope", NOW).actions).toEqual([]);
		expect(applyGatewayMessage(emptyState(), 42, NOW).actions).toEqual([]);
		expect(
			applyGatewayMessage(emptyState(), { op: 99, d: { weird: true } }, NOW)
				.actions,
		).toEqual([]);
	});

	test("op 10 HELLO stores heartbeat_interval ms, acks now, and Identifies without a session", () => {
		const { state, actions } = applyGatewayMessage(
			emptyState(),
			{ op: 10, d: { heartbeat_interval: 41_250 } },
			NOW,
		);
		expect(state.heartbeatIntervalMs).toBe(41_250);
		expect(state.lastHeartbeatAckAt).toBe(NOW);
		expect(actionOfType(actions, "identify")).toBeDefined();
		expect(actionOfType(actions, "resume")).toBeUndefined();
		expect(actionOfType(actions, "persist_session")).toMatchObject({
			type: "persist_session",
			heartbeatIntervalMs: 41_250,
			sessionId: null,
			seq: null,
			resumeGatewayUrl: null,
		});
		expect(shouldReconnectForMissedHeartbeat(state, NOW)).toBe(false);
	});

	test("op 10 HELLO Resumes when session_id and seq exist", () => {
		const { actions } = applyGatewayMessage(
			resumableState(),
			{ op: 10, d: { heartbeat_interval: 41_250 } },
			NOW,
		);
		expect(actionOfType(actions, "resume")).toBeDefined();
		expect(actionOfType(actions, "identify")).toBeUndefined();
	});

	test("op 0 READY stores session fields, seq, and ingest presences with guild filter", () => {
		const { state, actions } = applyGatewayMessage(
			{
				...emptyState(),
				heartbeatIntervalMs: 41_250,
				lastHeartbeatAckAt: NOW,
			},
			{
				op: 0,
				t: "READY",
				s: 1,
				d: {
					session_id: "sess_ready",
					resume_gateway_url: "wss://gateway-us-east1-b.discord.gg",
					presences: [
						{
							user: { id: "user-keep" },
							guild_id: GUILD,
							status: "online",
							activities: [{ type: 0, name: "Hades II" }],
						},
						{
							user: { id: "user-other-guild" },
							guild_id: "some-other-guild",
							status: "idle",
							activities: [],
						},
						{
							user: { id: "user-no-guild" },
							status: "dnd",
							activities: [],
						},
					],
				},
			},
			NOW,
		);

		expect(state.sessionId).toBe("sess_ready");
		expect(state.resumeGatewayUrl).toBe("wss://gateway-us-east1-b.discord.gg");
		expect(state.seq).toBe(1);
		expect(upsertIds(actions)).toEqual(["user-keep", "user-no-guild"]);
		expect(actionOfType(actions, "persist_session")).toMatchObject({
			sessionId: "sess_ready",
			seq: 1,
			resumeGatewayUrl: "wss://gateway-us-east1-b.discord.gg",
			heartbeatIntervalMs: 41_250,
		});
		const kept = actions.find(
			(action) =>
				action.type === "upsert_presence" &&
				action.discordUserId === "user-keep",
		);
		expect(kept).toMatchObject({
			type: "upsert_presence",
			discordUserId: "user-keep",
			snapshot: {
				user: { id: "user-keep" },
				guild_id: GUILD,
				status: "online",
				activities: [{ type: 0, name: "Hades II" }],
			},
		});
	});

	test("op 0 PRESENCE_UPDATE upserts when guild matches", () => {
		const snapshot = {
			user: { id: "user-1" },
			guild_id: GUILD,
			status: "online",
			activities: [{ type: 0, name: "Celeste" }],
		};
		const { state, actions } = applyGatewayMessage(
			emptyState(),
			{ op: 0, t: "PRESENCE_UPDATE", s: 12, d: snapshot },
			NOW,
		);
		expect(state.seq).toBe(12);
		expect(actionOfType(actions, "upsert_presence")).toEqual({
			type: "upsert_presence",
			discordUserId: "user-1",
			snapshot,
		});
		expect(actionOfType(actions, "persist_session")?.seq).toBe(12);
	});

	test("op 0 PRESENCE_UPDATE ignores a non-empty guild_id that is not the presence guild", () => {
		const { state, actions } = applyGatewayMessage(
			emptyState(),
			{
				op: 0,
				t: "PRESENCE_UPDATE",
				s: 13,
				d: {
					user: { id: "user-1" },
					guild_id: "other-guild",
					status: "online",
					activities: [],
				},
			},
			NOW,
		);
		expect(state.seq).toBe(13);
		expect(actionOfType(actions, "upsert_presence")).toBeUndefined();
		expect(actionOfType(actions, "persist_session")?.seq).toBe(13);
	});

	test("op 0 PRESENCE_UPDATE upserts when guild_id is missing (DMs / unscoped)", () => {
		const snapshot = {
			user: { id: "user-dm" },
			status: "online",
			activities: [],
		};
		const { actions } = applyGatewayMessage(
			emptyState(),
			{ op: 0, t: "PRESENCE_UPDATE", s: 14, d: snapshot },
			NOW,
		);
		expect(actionOfType(actions, "upsert_presence")).toEqual({
			type: "upsert_presence",
			discordUserId: "user-dm",
			snapshot,
		});
	});

	test("op 11 marks heartbeat ack without reconnect", () => {
		const helloed = {
			...emptyState(),
			heartbeatIntervalMs: 41_250,
			lastHeartbeatAckAt: NOW,
		};
		const { state, actions } = applyGatewayMessage(
			helloed,
			{ op: 11 },
			NOW + 5_000,
		);
		expect(state.lastHeartbeatAckAt).toBe(NOW + 5_000);
		expect(actions).toEqual([]);
		expect(shouldReconnectForMissedHeartbeat(state, NOW + 5_000)).toBe(false);
	});

	test("op 7 requests reconnect", () => {
		const { actions } = applyGatewayMessage(emptyState(), { op: 7 }, NOW);
		expect(actionOfType(actions, "reconnect")).toBeDefined();
	});

	test("op 1 from Discord requests an immediate heartbeat", () => {
		const { actions } = applyGatewayMessage(emptyState(), { op: 1 }, NOW);
		expect(actionOfType(actions, "heartbeat")).toBeDefined();
	});

	test("op 9 d:false clears session and Identifies after 1–5s", () => {
		const { state, actions } = applyGatewayMessage(
			resumableState(),
			{ op: 9, d: false },
			NOW,
			() => 0,
		);
		expect(state.sessionId).toBeNull();
		expect(state.seq).toBeNull();
		expect(state.resumeGatewayUrl).toBeNull();
		const delay = actionOfType(actions, "identify_after_ms");
		expect(delay).toBeDefined();
		expect(delay?.delayMs).toBeGreaterThanOrEqual(1_000);
		expect(delay?.delayMs).toBeLessThanOrEqual(5_000);
		expect(actionOfType(actions, "identify")).toBeUndefined();
		expect(actionOfType(actions, "resume")).toBeUndefined();
		expect(actionOfType(actions, "persist_session")).toMatchObject({
			sessionId: null,
			seq: null,
			resumeGatewayUrl: null,
		});
	});

	test("op 9 d:true Resumes the existing session", () => {
		const { state, actions } = applyGatewayMessage(
			resumableState(),
			{ op: 9, d: true },
			NOW,
		);
		expect(state.sessionId).toBe("session-abc");
		expect(state.seq).toBe(7);
		expect(actionOfType(actions, "resume")).toBeDefined();
		expect(actionOfType(actions, "identify_after_ms")).toBeUndefined();
	});
});

describe("shouldReconnectForMissedHeartbeat", () => {
	test("reconnects when last ack is older than 2× heartbeat interval", () => {
		const state = {
			...emptyState(),
			heartbeatIntervalMs: 1_000,
			lastHeartbeatAckAt: NOW,
		};
		expect(shouldReconnectForMissedHeartbeat(state, NOW + 2_000)).toBe(false);
		expect(shouldReconnectForMissedHeartbeat(state, NOW + 2_001)).toBe(true);
	});

	test("reconnects when interval is set but last ack is null", () => {
		const state = {
			...emptyState(),
			heartbeatIntervalMs: 1_000,
			lastHeartbeatAckAt: null,
		};
		expect(shouldReconnectForMissedHeartbeat(state, NOW)).toBe(true);
	});

	test("does not reconnect before HELLO (no interval yet)", () => {
		expect(shouldReconnectForMissedHeartbeat(emptyState(), NOW)).toBe(false);
	});
});

describe("parseGatewayBotResponse / session start limit", () => {
	test("reads url and session_start_limit", () => {
		const info = parseGatewayBotResponse({
			url: "wss://gateway.discord.gg",
			session_start_limit: {
				total: 1000,
				remaining: 999,
				reset_after: 14_400_000,
			},
		});
		expect(info).toEqual({
			url: "wss://gateway.discord.gg",
			remaining: 999,
			resetAfterMs: 14_400_000,
		});
		expect(info).not.toBeNull();
		if (!info) return;
		expect(shouldWaitForSessionStartLimit(info)).toBe(false);
	});

	test("remaining 0 means wait for reset_after before opening", () => {
		const info = parseGatewayBotResponse({
			url: "wss://gateway.discord.gg",
			session_start_limit: { remaining: 0, reset_after: 5_000 },
		});
		expect(info).not.toBeNull();
		if (!info) return;
		expect(shouldWaitForSessionStartLimit(info)).toBe(true);
	});

	test("malformed bot payload is null, not a throw", () => {
		expect(parseGatewayBotResponse(null)).toBeNull();
		expect(parseGatewayBotResponse({ shards: 1 })).toBeNull();
	});
});

describe("buildGatewaySocketUrl", () => {
	test("appends v=10 and encoding=json", () => {
		const url = new URL(buildGatewaySocketUrl("wss://gateway.discord.gg"));
		expect(url.searchParams.get("v")).toBe("10");
		expect(url.searchParams.get("encoding")).toBe("json");
	});
});

describe("nextAlarmDelayMs", () => {
	const keepaliveMs = 25_000;
	const heartbeatIntervalMs = 41_250;

	test("after a send, delay is min(keepalive, interval) so 25s is a ceiling", () => {
		// Sent at t=25000 with Discord interval 41250 → next due at 66250.
		expect(
			nextAlarmDelayMs({
				nowMs: 25_000,
				lastHeartbeatSentAt: 25_000,
				heartbeatIntervalMs,
				keepaliveMs,
			}),
		).toBe(Math.min(25_000, 41_250));
	});

	test("mid-interval alarm shortens so the next send lands on lastSent + interval", () => {
		const delay = nextAlarmDelayMs({
			nowMs: 50_000,
			lastHeartbeatSentAt: 25_000,
			heartbeatIntervalMs,
			keepaliveMs,
		});
		expect(delay).toBe(16_250);
		// 50000 + 16250 = 66250 = 25000 + 41250 (exactly one interval after last send).
		expect(50_000 + delay).toBe(25_000 + heartbeatIntervalMs);
	});

	test("before HELLO (no interval) keeps the Cloudflare keepalive ceiling", () => {
		expect(
			nextAlarmDelayMs({
				nowMs: 25_000,
				lastHeartbeatSentAt: null,
				heartbeatIntervalMs: null,
				keepaliveMs,
			}),
		).toBe(keepaliveMs);
	});

	test("never-sent with an interval still uses keepalive (send happens on this tick first)", () => {
		expect(
			nextAlarmDelayMs({
				nowMs: 25_000,
				lastHeartbeatSentAt: null,
				heartbeatIntervalMs,
				keepaliveMs,
			}),
		).toBe(keepaliveMs);
	});
});

describe("sessionStateFromRows", () => {
	test("restores persisted session keys after eviction", () => {
		const state = sessionStateFromRows(emptyState(), [
			{ k: "session_id", v: "sess_sql" },
			{ k: "seq", v: "42" },
			{ k: "resume_gateway_url", v: "wss://resume.example" },
			{ k: "heartbeat_interval_ms", v: "41250" },
		]);
		expect(state.sessionId).toBe("sess_sql");
		expect(state.seq).toBe(42);
		expect(state.resumeGatewayUrl).toBe("wss://resume.example");
		expect(state.heartbeatIntervalMs).toBe(41_250);
		expect(state.presenceGuildId).toBe(GUILD);
	});

	test("empty stored values are null", () => {
		const state = sessionStateFromRows(emptyState(), [
			{ k: "session_id", v: "" },
			{ k: "seq", v: "" },
			{ k: "resume_gateway_url", v: "" },
			{ k: "heartbeat_interval_ms", v: "" },
		]);
		expect(state.sessionId).toBeNull();
		expect(state.seq).toBeNull();
		expect(state.resumeGatewayUrl).toBeNull();
		expect(state.heartbeatIntervalMs).toBeNull();
	});
});
