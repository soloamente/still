import { DurableObject } from "cloudflare:workers";

import type { Env } from "./env";
import {
	applyGatewayMessage,
	buildGatewaySocketUrl,
	buildHeartbeatPayload,
	buildIdentifyPayload,
	buildResumePayload,
	emptyGatewaySession,
	type GatewayAction,
	type GatewayBotInfo,
	type GatewaySessionState,
	nextAlarmDelayMs,
	nextReconnectDelayMs,
	type PersistedSessionFields,
	parseGatewayBotResponse,
	sessionStateFromRows,
	shouldReconnectForMissedHeartbeat,
	shouldWaitForSessionStartLimit,
} from "./gateway-protocol";
import { presenceFromStoredJson } from "./presence-from-stored";
import type {
	DiscordPresenceSnapshot,
	LanyardPresencePayload,
} from "./presence-mapper";

export type GatewayStatus = "connected" | "connecting" | "disconnected";

const DISCORD_GATEWAY_BOT_URL = "https://discord.com/api/v10/gateway/bot";

/**
 * Cloudflare stops treating an outbound WebSocket as a reason to keep the isolate
 * alive after ~15 minutes. Reschedule this often while we want the session up.
 */
const ALARM_KEEPALIVE_MS = 25_000;

/**
 * Single named Gateway Durable Object (`get(idFromName("gateway"))`).
 * Holds the outbound Discord Gateway WebSocket, SQLite presence + session, and
 * an alarm keepalive (heartbeat + reconnect after eviction).
 */
export class DiscordGateway extends DurableObject<Env> {
	private gatewayStatus: GatewayStatus = "disconnected";
	private sessionState: GatewaySessionState;
	private socket: WebSocket | null = null;
	private reconnectAttempt = 0;
	private lastHeartbeatSentAt: number | null = null;
	private connectInFlight: Promise<void> | null = null;
	private closingForReconnect = false;
	private identifyTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sessionState = emptyGatewaySession(env.DISCORD_PRESENCE_GUILD_ID);
		// Schema only — never fetch or open sockets inside blockConcurrencyWhile.
		ctx.blockConcurrencyWhile(async () => {
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS presence (
					discord_user_id TEXT PRIMARY KEY,
					payload_json TEXT NOT NULL,
					updated_at INTEGER NOT NULL
				)
			`);
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS session (
					k TEXT PRIMARY KEY,
					v TEXT NOT NULL
				)
			`);
		});
	}

	getGatewayStatus(): GatewayStatus {
		return this.gatewayStatus;
	}

	getPresence(discordUserId: string): LanyardPresencePayload {
		const row = this.ctx.storage.sql
			.exec<{ payload_json: string }>(
				"SELECT payload_json FROM presence WHERE discord_user_id = ?",
				discordUserId,
			)
			.toArray()[0];
		return presenceFromStoredJson(row?.payload_json ?? null);
	}

	putPresence(discordUserId: string, snapshot: DiscordPresenceSnapshot): void {
		// Persist the raw Discord snapshot (not Lanyard). Mapping happens on read.
		this.ctx.storage.sql.exec(
			`INSERT INTO presence (discord_user_id, payload_json, updated_at)
			 VALUES (?, ?, ?)
			 ON CONFLICT(discord_user_id) DO UPDATE SET
			   payload_json = excluded.payload_json,
			   updated_at = excluded.updated_at`,
			discordUserId,
			JSON.stringify(snapshot),
			Date.now(),
		);
	}

	/**
	 * Wake path for `POST /internal/ensure`. Opens (or resumes) the Discord
	 * Gateway socket. Idempotent while a socket is already OPEN/CONNECTING.
	 *
	 * Not named `connect`: DurableObjectStub inherits Fetcher.connect(address),
	 * so `stub.connect()` is a TCP socket API (throws without a SocketAddress).
	 */
	async ensureConnected(): Promise<void> {
		if (this.connectInFlight) return this.connectInFlight;
		this.connectInFlight = this.openGateway().finally(() => {
			this.connectInFlight = null;
		});
		return this.connectInFlight;
	}

	/**
	 * Alarm is both Discord heartbeat cadence and isolate keepalive.
	 * Missing/closed socket → `ensureConnected()`. Open socket → heartbeat if HELLO
	 * interval elapsed (`lastSent == null` or `now - lastSent >= interval`),
	 * then `setAlarm` at `min(25s keepalive, time until next heartbeat)`.
	 */
	async alarm(): Promise<void> {
		if (!this.socketIsActive()) {
			await this.ensureConnected();
			return;
		}

		const now = Date.now();
		// lastHeartbeatAckAt is in-memory. After eviction it is null until HELLO
		// even if heartbeat_interval_ms was restored from SQLite — do not treat
		// that as a missed ACK or we reconnect in a loop before HELLO arrives.
		if (
			this.sessionState.lastHeartbeatAckAt != null &&
			shouldReconnectForMissedHeartbeat(this.sessionState, now)
		) {
			await this.reconnectNow();
			return;
		}

		this.maybeSendHeartbeat(now);
		const delayMs = nextAlarmDelayMs({
			nowMs: now,
			lastHeartbeatSentAt: this.lastHeartbeatSentAt,
			heartbeatIntervalMs: this.sessionState.heartbeatIntervalMs,
			keepaliveMs: ALARM_KEEPALIVE_MS,
		});
		await this.ctx.storage.setAlarm(now + delayMs);
	}

	private async openGateway(): Promise<void> {
		if (this.socketIsActive()) return;

		this.gatewayStatus = "connecting";
		this.sessionState = this.loadSessionState();

		try {
			const bot = await this.fetchGatewayBot();
			if (!bot) {
				this.gatewayStatus = "disconnected";
				await this.scheduleReconnect();
				return;
			}

			if (shouldWaitForSessionStartLimit(bot)) {
				this.gatewayStatus = "disconnected";
				const waitMs =
					bot.resetAfterMs != null && bot.resetAfterMs > 0
						? bot.resetAfterMs
						: nextReconnectDelayMs(this.reconnectAttempt);
				await this.ctx.storage.setAlarm(Date.now() + waitMs);
				return;
			}

			const baseUrl = this.sessionState.resumeGatewayUrl ?? bot.url;
			const socket = new WebSocket(buildGatewaySocketUrl(baseUrl));
			this.socket = socket;
			this.bindSocket(socket);
			await this.ctx.storage.setAlarm(Date.now() + ALARM_KEEPALIVE_MS);
		} catch (error) {
			console.error("[discord-presence] gateway connect failed", error);
			this.gatewayStatus = "disconnected";
			this.socket = null;
			await this.scheduleReconnect();
		}
	}

	private async fetchGatewayBot(): Promise<GatewayBotInfo | null> {
		const response = await fetch(DISCORD_GATEWAY_BOT_URL, {
			headers: {
				Authorization: `Bot ${this.env.DISCORD_BOT_TOKEN}`,
				"User-Agent": "SenseDiscordPresence (https://sense.app, 0.0.1)",
			},
		});
		if (!response.ok) {
			console.error(
				"[discord-presence] GET /gateway/bot failed",
				response.status,
			);
			return null;
		}
		const body: unknown = await response.json();
		return parseGatewayBotResponse(body);
	}

	private bindSocket(socket: WebSocket): void {
		socket.addEventListener("message", (event) => {
			this.onSocketMessage(event);
		});
		socket.addEventListener("close", () => {
			this.handleDisconnect();
		});
		socket.addEventListener("error", () => {
			this.handleDisconnect();
		});
	}

	private onSocketMessage(event: MessageEvent): void {
		let parsed: unknown;
		try {
			const text =
				typeof event.data === "string"
					? event.data
					: new TextDecoder().decode(event.data as ArrayBuffer);
			parsed = JSON.parse(text);
		} catch {
			console.error("[discord-presence] gateway message was not JSON");
			return;
		}

		try {
			const { state, actions } = applyGatewayMessage(
				this.sessionState,
				parsed,
				Date.now(),
			);
			this.applyActions(state, actions);
			this.markConnectedIfReady(parsed);
		} catch (error) {
			console.error("[discord-presence] gateway message handler failed", error);
		}
	}

	private applyActions(
		state: GatewaySessionState,
		actions: GatewayAction[],
	): void {
		// Persist session keys to SQL first, then accept the in-memory state.
		for (const action of actions) {
			if (action.type === "persist_session") {
				this.persistSession(action);
			}
		}
		this.sessionState = state;

		for (const action of actions) {
			switch (action.type) {
				case "persist_session":
					break;
				case "identify":
					this.sendJson(buildIdentifyPayload(this.env.DISCORD_BOT_TOKEN));
					break;
				case "resume": {
					const sessionId = this.sessionState.sessionId;
					const seq = this.sessionState.seq;
					if (sessionId != null && seq != null) {
						this.sendJson(
							buildResumePayload(this.env.DISCORD_BOT_TOKEN, sessionId, seq),
						);
					}
					break;
				}
				case "heartbeat":
					this.sendHeartbeat();
					break;
				case "reconnect":
					void this.reconnectNow();
					break;
				case "identify_after_ms":
					this.scheduleIdentify(action.delayMs);
					break;
				case "upsert_presence":
					this.putPresence(action.discordUserId, action.snapshot);
					break;
				default: {
					const _never: never = action;
					void _never;
				}
			}
		}
	}

	private persistSession(fields: PersistedSessionFields): void {
		this.writeSessionKey("session_id", fields.sessionId);
		this.writeSessionKey("seq", fields.seq == null ? null : String(fields.seq));
		this.writeSessionKey("resume_gateway_url", fields.resumeGatewayUrl);
		this.writeSessionKey(
			"heartbeat_interval_ms",
			fields.heartbeatIntervalMs == null
				? null
				: String(fields.heartbeatIntervalMs),
		);
	}

	private writeSessionKey(k: string, v: string | null): void {
		this.ctx.storage.sql.exec(
			`INSERT INTO session (k, v) VALUES (?, ?)
			 ON CONFLICT(k) DO UPDATE SET v = excluded.v`,
			k,
			v ?? "",
		);
	}

	private loadSessionState(): GatewaySessionState {
		const rows = this.ctx.storage.sql
			.exec<{ k: string; v: string }>("SELECT k, v FROM session")
			.toArray();
		return sessionStateFromRows(
			emptyGatewaySession(this.env.DISCORD_PRESENCE_GUILD_ID),
			rows,
		);
	}

	private markConnectedIfReady(message: unknown): void {
		if (typeof message !== "object" || message === null) return;
		if (!("t" in message)) return;
		const eventName = (message as { t: unknown }).t;
		if (eventName === "READY" || eventName === "RESUMED") {
			this.gatewayStatus = "connected";
			this.reconnectAttempt = 0;
		}
	}

	private maybeSendHeartbeat(now: number): void {
		const interval = this.sessionState.heartbeatIntervalMs;
		if (interval == null) return;
		if (this.socket?.readyState !== WebSocket.OPEN) return;
		const lastSent = this.lastHeartbeatSentAt;
		if (!(lastSent == null || now - lastSent >= interval)) {
			return;
		}
		this.sendHeartbeat();
	}

	private sendHeartbeat(): void {
		this.sendJson(buildHeartbeatPayload(this.sessionState.seq));
		this.lastHeartbeatSentAt = Date.now();
	}

	private sendJson(payload: unknown): void {
		if (this.socket?.readyState !== WebSocket.OPEN) return;
		this.socket.send(JSON.stringify(payload));
	}

	private scheduleIdentify(delayMs: number): void {
		this.clearIdentifyTimer();
		this.identifyTimer = setTimeout(() => {
			this.identifyTimer = null;
			this.sendJson(buildIdentifyPayload(this.env.DISCORD_BOT_TOKEN));
		}, delayMs);
	}

	/** Drop a pending op-9 Identify so it cannot fire on a newer socket. */
	private clearIdentifyTimer(): void {
		if (this.identifyTimer == null) return;
		clearTimeout(this.identifyTimer);
		this.identifyTimer = null;
	}

	private async reconnectNow(): Promise<void> {
		this.clearIdentifyTimer();
		this.closingForReconnect = true;
		this.closeSocket();
		this.gatewayStatus = "disconnected";
		this.lastHeartbeatSentAt = null;
		await this.scheduleReconnect();
	}

	private handleDisconnect(): void {
		this.clearIdentifyTimer();
		const skipSchedule =
			this.closingForReconnect || this.gatewayStatus === "disconnected";
		this.closingForReconnect = false;
		this.socket = null;
		this.gatewayStatus = "disconnected";
		this.lastHeartbeatSentAt = null;
		if (skipSchedule) return;
		void this.scheduleReconnect();
	}

	private closeSocket(): void {
		this.clearIdentifyTimer();
		const socket = this.socket;
		this.socket = null;
		if (!socket) return;
		try {
			socket.close(1000, "reconnect");
		} catch {
			// already closing / closed
		}
	}

	private socketIsActive(): boolean {
		if (!this.socket) return false;
		const ready = this.socket.readyState;
		return ready === WebSocket.OPEN || ready === WebSocket.CONNECTING;
	}

	private async scheduleReconnect(): Promise<void> {
		const delay = nextReconnectDelayMs(this.reconnectAttempt);
		this.reconnectAttempt += 1;
		await this.ctx.storage.setAlarm(Date.now() + delay);
	}
}
