import net from "node:net";

import {
	buildClearActivity,
	buildHandshake,
	buildSetWatchingActivity,
	DISCORD_IPC_FRAME,
	DISCORD_IPC_HANDSHAKE,
	DISCORD_IPC_PING,
	DISCORD_IPC_PONG,
	DISCORD_PAUSE_TIMESTAMP_DRIFT_MS,
	type DiscordPlaybackTimestamps,
	type DiscordPresenceDecision,
	decodeDiscordFrames,
	discordIpcPipePath,
	encodeDiscordFrame,
	playbackTimestampsStable,
} from "./discord-presence";

function connectPipe(pipePath: string): Promise<net.Socket> {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection(pipePath);
		const onError = (error: Error) => {
			socket.destroy();
			reject(error);
		};
		socket.once("error", onError);
		socket.once("connect", () => {
			socket.off("error", onError);
			resolve(socket);
		});
	});
}

/** First live Discord desktop pipe, or null when Discord is closed. */
export async function openDiscordPipe(): Promise<net.Socket | null> {
	for (let index = 0; index <= 9; index += 1) {
		const pipePath = discordIpcPipePath(index, process.platform);
		try {
			return await connectPipe(pipePath);
		} catch {
			// The next index is another client instance. Keep going.
		}
	}
	return null;
}

/**
 * One Discord IPC session. Handshake on connect, answer pings, and skip
 * repeat writes so a 1s playback tick does not spam SET_ACTIVITY.
 */
export class DiscordPresenceSession {
	private buffer = Buffer.alloc(0);
	private nonce = 0;
	private lastKey: string | null = null;
	private lastTimestamps: DiscordPlaybackTimestamps | null = null;

	constructor(
		private readonly socket: net.Socket,
		clientId: string,
		private readonly pid: number,
	) {
		this.socket.on("data", (chunk: Buffer) => {
			this.onData(chunk);
		});
		this.socket.write(
			encodeDiscordFrame(DISCORD_IPC_HANDSHAKE, buildHandshake(clientId)),
		);
	}

	apply(decision: DiscordPresenceDecision): void {
		switch (decision.action) {
			case "hold":
				return;
			case "clear": {
				if (this.lastKey === "clear") return;
				this.lastKey = "clear";
				this.lastTimestamps = null;
				this.socket.write(
					encodeDiscordFrame(
						DISCORD_IPC_FRAME,
						buildClearActivity({ pid: this.pid, nonce: this.nextNonce() }),
					),
				);
				return;
			}
			case "set": {
				const key = `${decision.title}\0${decision.details ?? ""}\0${decision.state ?? ""}\0${decision.largeText ?? ""}\0${decision.largeImage ?? ""}\0${decision.smallImage ?? ""}\0${decision.smallText ?? ""}\0${decision.profileButtonUrl ?? ""}`;
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
				this.socket.write(
					encodeDiscordFrame(
						DISCORD_IPC_FRAME,
						buildSetWatchingActivity({
							pid: this.pid,
							nonce: this.nextNonce(),
							title: decision.title,
							details: decision.details,
							largeImage: decision.largeImage,
							largeText: decision.largeText,
							smallImage: decision.smallImage,
							smallText: decision.smallText,
							state: decision.state,
							timestamps: decision.timestamps,
							profileButtonUrl: decision.profileButtonUrl,
						}),
					),
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

	private onData(chunk: Buffer): void {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		const decoded = decodeDiscordFrames(this.buffer);
		this.buffer = Buffer.from(decoded.rest);
		for (const frame of decoded.frames) {
			if (frame.opcode === DISCORD_IPC_PING) {
				this.socket.write(encodeDiscordFrame(DISCORD_IPC_PONG, frame.payload));
			}
		}
	}
}
