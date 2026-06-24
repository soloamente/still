import {
	classifyRoom,
	parseClientFrame,
	type RealtimeActivityState,
	realtimeEventSchema,
} from "@still/realtime";

export interface Env {
	HUB: DurableObjectNamespace;
	SERVER_ORIGIN: string;
	REALTIME_JWT_SECRET: string;
	REALTIME_INTERNAL_SECRET: string;
	ALLOWED_ORIGINS?: string;
}

type SocketMeta = { userId: string; rooms: string[] };

type PresenceEntry = { lastSeen: number; activityState: RealtimeActivityState };

const PRESENCE_STALE_MS = 45_000;

export class RealtimeHub implements DurableObject {
	constructor(
		private readonly state: DurableObjectState,
		private readonly env: Env,
	) {}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/publish" && request.method === "POST") {
			return this.handlePublish(request);
		}
		if (url.pathname === "/occupancy" && request.method === "GET") {
			return this.handleOccupancy(url);
		}
		if (request.headers.get("Upgrade") === "websocket") {
			return this.handleConnect(url);
		}
		return new Response("Not Found", { status: 404 });
	}

	private async handlePublish(request: Request): Promise<Response> {
		const body = (await request.json()) as { room?: string; event?: unknown };
		if (!body.room) {
			return Response.json({ error: "room required" }, { status: 400 });
		}
		const parsed = realtimeEventSchema.safeParse(body.event);
		if (!parsed.success) {
			return Response.json({ error: "Invalid event" }, { status: 400 });
		}
		this.broadcast(
			body.room,
			JSON.stringify({ kind: "event", room: body.room, event: parsed.data }),
		);
		return Response.json({ ok: true });
	}

	private async handleOccupancy(url: URL): Promise<Response> {
		const room = url.searchParams.get("room");
		if (!room) {
			return Response.json({ error: "room required" }, { status: 400 });
		}
		const entries = await this.activeEntries(room);
		return Response.json({ entries });
	}

	private async handleConnect(url: URL): Promise<Response> {
		const userId = url.searchParams.get("userId");
		const roomsParam = url.searchParams.get("rooms") ?? "";
		if (!userId) return new Response("Missing userId", { status: 400 });

		const rooms = roomsParam.split(",").filter(Boolean);
		const pair = new WebSocketPair();
		const [client, server] = [pair[0], pair[1]];

		this.state.acceptWebSocket(server);
		const meta: SocketMeta = { userId, rooms };
		server.serializeAttachment(meta);

		for (const room of rooms) {
			await this.recordHeartbeat(userId, room, "active");
		}

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(
		ws: WebSocket,
		message: string | ArrayBuffer,
	): Promise<void> {
		const meta = ws.deserializeAttachment() as SocketMeta | null;
		if (!meta) return;

		const raw =
			typeof message === "string" ? message : new TextDecoder().decode(message);
		const frame = parseClientFrame(raw);
		if (!frame) return;

		if (frame.kind === "join") {
			const allowed = await this.authorizeRoom(meta.userId, frame.room);
			if (!allowed) {
				ws.send(
					JSON.stringify({
						kind: "error",
						room: frame.room,
						code: "forbidden",
					}),
				);
				return;
			}
			if (!meta.rooms.includes(frame.room)) {
				meta.rooms.push(frame.room);
				ws.serializeAttachment(meta);
			}
			await this.recordHeartbeat(meta.userId, frame.room, "active");
			ws.send(JSON.stringify({ kind: "joined", room: frame.room }));
		} else if (frame.kind === "leave") {
			meta.rooms = meta.rooms.filter((r) => r !== frame.room);
			ws.serializeAttachment(meta);
			await this.cleanupFromRoom(meta.userId, frame.room, ws);
		} else if (frame.kind === "heartbeat") {
			if (meta.rooms.includes(frame.room)) {
				await this.recordHeartbeat(
					meta.userId,
					frame.room,
					frame.activityState,
				);
			}
		} else if (frame.kind === "ping") {
			ws.send(JSON.stringify({ kind: "pong" }));
		}
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		await this.cleanupSocket(ws);
	}

	async webSocketError(ws: WebSocket): Promise<void> {
		await this.cleanupSocket(ws);
	}

	private async cleanupSocket(ws: WebSocket): Promise<void> {
		const meta = ws.deserializeAttachment() as SocketMeta | null;
		if (!meta) return;
		for (const room of meta.rooms) {
			await this.cleanupFromRoom(meta.userId, room, ws);
		}
	}

	private async authorizeRoom(userId: string, room: string): Promise<boolean> {
		const { tier, ownerUserId } = classifyRoom(room);
		if (tier === "allow") return true;
		if (tier === "deny") return false;
		if (tier === "self") return userId === ownerUserId;

		try {
			const res = await fetch(
				`${this.env.SERVER_ORIGIN}/api/realtime/authorize`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.env.REALTIME_INTERNAL_SECRET}`,
					},
					body: JSON.stringify({ userId, room }),
				},
			);
			if (!res.ok) return false;
			const body = (await res.json()) as { allowed?: boolean };
			return body.allowed === true;
		} catch {
			return false;
		}
	}

	private async recordHeartbeat(
		userId: string,
		room: string,
		activityState: RealtimeActivityState,
	): Promise<void> {
		const key = `presence:${room}`;
		const stored =
			(await this.state.storage.get<Record<string, PresenceEntry>>(key)) ?? {};
		const prev = stored[userId];
		const changed = !prev || prev.activityState !== activityState;
		stored[userId] = { lastSeen: Date.now(), activityState };
		await this.state.storage.put(key, stored);

		if (changed) {
			this.broadcast(
				room,
				JSON.stringify({
					kind: "event",
					room,
					event: { type: "presence.updated" },
				}),
			);
		}
	}

	private async activeEntries(
		room: string,
	): Promise<{ userId: string; activityState: RealtimeActivityState }[]> {
		const key = `presence:${room}`;
		const stored =
			(await this.state.storage.get<Record<string, PresenceEntry>>(key)) ?? {};
		const staleThreshold = Date.now() - PRESENCE_STALE_MS;
		const result: { userId: string; activityState: RealtimeActivityState }[] =
			[];
		let pruned = false;

		for (const [userId, entry] of Object.entries(stored)) {
			if (entry.lastSeen < staleThreshold) {
				delete stored[userId];
				pruned = true;
			} else {
				result.push({ userId, activityState: entry.activityState });
			}
		}

		if (pruned) await this.state.storage.put(key, stored);
		return result;
	}

	private async cleanupFromRoom(
		userId: string,
		room: string,
		closedWs: WebSocket,
	): Promise<void> {
		const hasOtherSocket = this.state.getWebSockets().some((s) => {
			if (s === closedWs) return false;
			const m = s.deserializeAttachment() as SocketMeta | null;
			return m?.userId === userId && m.rooms.includes(room);
		});
		if (hasOtherSocket) return;

		const key = `presence:${room}`;
		const stored =
			(await this.state.storage.get<Record<string, PresenceEntry>>(key)) ?? {};
		if (stored[userId]) {
			delete stored[userId];
			await this.state.storage.put(key, stored);
			this.broadcast(
				room,
				JSON.stringify({
					kind: "event",
					room,
					event: { type: "presence.updated" },
				}),
			);
		}
	}

	private broadcast(room: string, frame: string): void {
		for (const ws of this.state.getWebSockets()) {
			const meta = ws.deserializeAttachment() as SocketMeta | null;
			if (!meta?.rooms.includes(room)) continue;
			try {
				ws.send(frame);
			} catch {
				// Socket closed mid-iteration
			}
		}
	}
}
