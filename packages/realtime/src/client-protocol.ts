export type RealtimeActivityState = "active" | "away";

// ── Client → Worker frames ────────────────────────────────────────────────────

export type JoinFrame = { kind: "join"; room: string };
export type LeaveFrame = { kind: "leave"; room: string };
export type HeartbeatFrame = {
	kind: "heartbeat";
	room: string;
	activityState: RealtimeActivityState;
};
export type TypingFrame = { kind: "typing"; room: string; isTyping: boolean };
export type PingFrame = { kind: "ping" };

export type ClientFrame =
	| JoinFrame
	| LeaveFrame
	| HeartbeatFrame
	| TypingFrame
	| PingFrame;

// ── Worker → Client frames ────────────────────────────────────────────────────

export type EventFrame = { kind: "event"; room: string; event: unknown };
export type JoinedFrame = { kind: "joined"; room: string };
export type ErrorFrame = { kind: "error"; room: string; code: string };
export type PongFrame = { kind: "pong" };

export type ServerFrame = EventFrame | JoinedFrame | ErrorFrame | PongFrame;

// ── Parsers ───────────────────────────────────────────────────────────────────

export function parseClientFrame(data: string): ClientFrame | null {
	try {
		const raw = JSON.parse(data) as Record<string, unknown>;
		if (!raw || typeof raw !== "object" || typeof raw.kind !== "string")
			return null;
		switch (raw.kind) {
			case "join":
				if (typeof raw.room !== "string") return null;
				return { kind: "join", room: raw.room };
			case "leave":
				if (typeof raw.room !== "string") return null;
				return { kind: "leave", room: raw.room };
			case "heartbeat":
				if (typeof raw.room !== "string") return null;
				return {
					kind: "heartbeat",
					room: raw.room,
					activityState: raw.activityState === "away" ? "away" : "active",
				};
			case "typing":
				if (typeof raw.room !== "string") return null;
				return {
					kind: "typing",
					room: raw.room,
					isTyping: Boolean(raw.isTyping),
				};
			case "ping":
				return { kind: "ping" };
			default:
				return null;
		}
	} catch {
		return null;
	}
}

export function parseServerFrame(data: string): ServerFrame | null {
	try {
		const raw = JSON.parse(data) as Record<string, unknown>;
		if (!raw || typeof raw !== "object" || typeof raw.kind !== "string")
			return null;
		switch (raw.kind) {
			case "event":
				if (typeof raw.room !== "string") return null;
				return { kind: "event", room: raw.room, event: raw.event };
			case "joined":
				if (typeof raw.room !== "string") return null;
				return { kind: "joined", room: raw.room };
			case "error":
				if (typeof raw.room !== "string" || typeof raw.code !== "string")
					return null;
				return { kind: "error", room: raw.room, code: raw.code };
			case "pong":
				return { kind: "pong" };
			default:
				return null;
		}
	} catch {
		return null;
	}
}
