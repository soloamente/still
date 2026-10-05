import {
	buildClearActivity,
	buildHandshake,
	buildSetWatchingActivity,
	DISCORD_PAUSE_TIMESTAMP_DRIFT_MS,
	type DiscordPlaybackTimestamps,
	type DiscordPresenceDecision,
	decideDiscordPresence,
	playbackTimestampsStable,
} from "../../../sense-companion-host/src/discord-presence";
import type { CompanionActivityMessage } from "../presence/activity-log";
import { readSenseDiscordClientId } from "./application-id";
import {
	DISCORD_IPC_FRAME,
	DISCORD_IPC_HANDSHAKE,
	DISCORD_IPC_PING,
	DISCORD_IPC_PONG,
	decodeDiscordIpcFrames,
	encodeDiscordIpcFrame,
} from "./ipc-frame";

/** Discord desktop listens here. The first open port is the running client. */
export const DISCORD_DESKTOP_PORTS = [
	6463, 6464, 6465, 6466, 6467, 6468, 6469, 6470, 6471, 6472,
] as const;

export function discordDesktopSocketUrl(port: number): string {
	return `ws://127.0.0.1:${port}/?v=1&encoding=json`;
}

type DiscordSocket = {
	binaryType: BinaryType;
	onopen: ((event: Event) => void) | null;
	onmessage: ((event: MessageEvent) => void) | null;
	onclose: ((event: Event) => void) | null;
	onerror: ((event: Event) => void) | null;
	send(data: Uint8Array<ArrayBufferLike>): void;
	close(): void;
};

type DiscordSocketFactory = (url: string) => DiscordSocket;

const OPEN_TIMEOUT_MS = 400;

/**
 * One Discord desktop session over the local websocket.
 * Handshake on connect, answer pings, and skip repeat writes.
 */
export class DiscordDesktopSession {
	private buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
	private nonce = 0;
	private lastKey: string | null = null;
	private lastTimestamps: DiscordPlaybackTimestamps | null = null;
	private opened = false;

	constructor(
		private readonly socket: DiscordSocket,
		private readonly clientId: string,
		private readonly pid: number,
	) {
		// The scanner only hands over a socket that has already opened.
		this.socket.binaryType = "arraybuffer";
		this.socket.onmessage = (event) => {
			this.onMessage(event.data);
		};
		this.opened = true;
		this.socket.send(
			encodeDiscordIpcFrame(
				DISCORD_IPC_HANDSHAKE,
				buildHandshake(this.clientId),
			),
		);
	}

	get isOpen(): boolean {
		return this.opened;
	}

	apply(decision: DiscordPresenceDecision): void {
		switch (decision.action) {
			case "hold":
				return;
			case "clear": {
				if (this.lastKey === "clear") return;
				this.lastKey = "clear";
				this.lastTimestamps = null;
				this.sendFrame(
					buildClearActivity({ pid: this.pid, nonce: this.nextNonce() }),
				);
				return;
			}
			case "set": {
				const key = `${decision.activityType}\0${decision.title}\0${decision.details ?? ""}\0${decision.state ?? ""}\0${decision.largeText ?? ""}\0${decision.largeImage ?? ""}\0${decision.smallImage ?? ""}\0${decision.smallText ?? ""}\0${decision.profileButtonUrl ?? ""}\0${decision.titleButtonUrl ?? ""}`;
				const drift =
					decision.smallText === "Paused"
						? DISCORD_PAUSE_TIMESTAMP_DRIFT_MS
						: undefined;
				if (
					this.lastKey === key &&
					playbackTimestampsStable(
						this.lastTimestamps,
						decision.timestamps,
						drift,
					)
				) {
					return;
				}
				this.lastKey = key;
				this.lastTimestamps = decision.timestamps;
				this.sendFrame(
					buildSetWatchingActivity({
						pid: this.pid,
						nonce: this.nextNonce(),
						activityType: decision.activityType,
						title: decision.title,
						details: decision.details,
						largeImage: decision.largeImage,
						largeText: decision.largeText,
						smallImage: decision.smallImage,
						smallText: decision.smallText,
						state: decision.state,
						timestamps: decision.timestamps,
						profileButtonUrl: decision.profileButtonUrl,
						titleButtonUrl: decision.titleButtonUrl,
					}),
				);
				return;
			}
			default: {
				const unreachable: never = decision;
				throw new Error(`Unknown Discord presence action: ${unreachable}`);
			}
		}
	}

	private nextNonce(): string {
		this.nonce += 1;
		return String(this.nonce);
	}

	private sendFrame(payload: unknown): void {
		if (!this.opened) return;
		this.socket.send(encodeDiscordIpcFrame(DISCORD_IPC_FRAME, payload));
	}

	private onMessage(data: unknown): void {
		const chunk = bytesFromSocket(data);
		if (!chunk) return;
		this.buffer = concatBytes(this.buffer, chunk);
		const decoded = decodeDiscordIpcFrames(this.buffer);
		this.buffer = decoded.rest;
		for (const frame of decoded.frames) {
			if (frame.opcode === DISCORD_IPC_PING) {
				this.socket.send(
					encodeDiscordIpcFrame(DISCORD_IPC_PONG, frame.payload),
				);
			}
		}
	}
}

/** First Discord desktop port that accepts a socket, or null when Discord is closed. */
export function openDiscordDesktopSocket(input?: {
	ports?: readonly number[];
	timeoutMs?: number;
	createSocket?: DiscordSocketFactory;
}): Promise<DiscordSocket | null> {
	const ports = input?.ports ?? DISCORD_DESKTOP_PORTS;
	const timeoutMs = input?.timeoutMs ?? OPEN_TIMEOUT_MS;
	const createSocket =
		input?.createSocket ??
		((url) => new WebSocket(url) as unknown as DiscordSocket);
	return new Promise((resolve) => {
		let index = 0;
		const tryNext = () => {
			const port = ports[index];
			if (port == null) {
				resolve(null);
				return;
			}
			index += 1;
			let settled = false;
			const socket = createSocket(discordDesktopSocketUrl(port));
			const timer = setTimeout(() => {
				finish(false);
			}, timeoutMs);
			const finish = (opened: boolean) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				if (opened) {
					socket.onerror = null;
					resolve(socket);
					return;
				}
				try {
					socket.close();
				} catch {
					// A refused port has nothing to close.
				}
				tryNext();
			};
			const previousOpen = socket.onopen;
			socket.onopen = (event) => {
				previousOpen?.call(socket, event);
				finish(true);
			};
			socket.onerror = () => {
				finish(false);
			};
		};
		tryNext();
	});
}

let session: DiscordDesktopSession | null = null;
let pausedSince: number | null = null;
let opening: Promise<DiscordDesktopSession | null> | null = null;

/** Connect once and reuse the socket. A closed Discord comes back as null. */
export async function ensureDiscordDesktop(input?: {
	clientId?: string | null;
	createSocket?: DiscordSocketFactory;
	ports?: readonly number[];
}): Promise<DiscordDesktopSession | null> {
	if (session?.isOpen) return session;
	if (opening) return opening;
	const clientId = input?.clientId ?? readSenseDiscordClientId();
	if (!clientId) return null;
	opening = openDiscordDesktopSocket({
		ports: input?.ports,
		createSocket: input?.createSocket,
	}).then((socket) => {
		opening = null;
		if (!socket) {
			session = null;
			return null;
		}
		const created = new DiscordDesktopSession(socket, clientId, 1);
		socket.onclose = () => {
			if (session === created) session = null;
		};
		session = created;
		return created;
	});
	return opening;
}

/** Push one playback message to Discord desktop. False when Discord is closed. */
export async function publishDiscordDesktopActivity(
	message: CompanionActivityMessage & {
		profileButtonUrl?: string | null;
		titleButtonUrl?: string | null;
	},
	input?: {
		now?: number;
		clientId?: string | null;
		createSocket?: DiscordSocketFactory;
		ports?: readonly number[];
	},
): Promise<boolean> {
	const active = await ensureDiscordDesktop(input);
	if (!active) return false;
	const now = input?.now ?? Date.now();
	const next = decideDiscordPresence({
		message,
		now,
		pausedSince,
	});
	pausedSince = next.pausedSince;
	active.apply(next.decision);
	return true;
}

/** Popup status. Connected means Discord desktop accepted the local socket. */
export async function requestDiscordDesktopStatus(input?: {
	clientId?: string | null;
	createSocket?: DiscordSocketFactory;
	ports?: readonly number[];
}): Promise<"connected" | "closed" | "missing"> {
	if (
		input?.clientId === null ||
		(input?.clientId == null && !readSenseDiscordClientId())
	) {
		return "missing";
	}
	const active = await ensureDiscordDesktop(input);
	return active ? "connected" : "closed";
}

/** Test hook. The next publish opens a fresh socket. */
export function resetDiscordDesktopSession(): void {
	session = null;
	pausedSince = null;
	opening = null;
}

function bytesFromSocket(data: unknown): Uint8Array | null {
	if (data instanceof Uint8Array) return data;
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	return null;
}

function concatBytes(
	left: Uint8Array<ArrayBufferLike>,
	right: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
	const merged = new Uint8Array(left.length + right.length);
	merged.set(left, 0);
	merged.set(right, left.length);
	return merged;
}
