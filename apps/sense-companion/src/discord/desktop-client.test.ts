import { describe, expect, test } from "bun:test";
import type { CompanionActivityMessage } from "../presence/activity-log";
import {
	publishDiscordDesktopActivity,
	requestDiscordDesktopStatus,
	resetDiscordDesktopSession,
} from "./desktop-client";
import {
	DISCORD_IPC_FRAME,
	DISCORD_IPC_HANDSHAKE,
	decodeDiscordIpcFrames,
} from "./ipc-frame";

type FakeSocket = {
	url: string;
	binaryType: BinaryType;
	onopen: ((event: Event) => void) | null;
	onmessage: ((event: MessageEvent) => void) | null;
	onclose: ((event: Event) => void) | null;
	onerror: ((event: Event) => void) | null;
	sent: Uint8Array[];
	send(data: Uint8Array): void;
	close(): void;
	open(): void;
};

function fakeSocket(url: string): FakeSocket {
	const socket: FakeSocket = {
		url,
		binaryType: "blob",
		onopen: null,
		onmessage: null,
		onclose: null,
		onerror: null,
		sent: [],
		send(data) {
			this.sent.push(data);
		},
		close() {
			this.onclose?.(new Event("close"));
		},
		open() {
			this.onopen?.(new Event("open"));
		},
	};
	queueMicrotask(() => {
		socket.open();
	});
	return socket;
}

const PLAYING: CompanionActivityMessage = {
	type: "sense-companion:activity",
	service: "netflix",
	activity: {
		name: "Stranger Things",
		details: "Chapter One",
		state: null,
		largeImageKey: "https://image.tmdb.org/poster.jpg",
		largeImageText: "Stranger Things",
		smallImageKey: null,
		smallImageText: null,
		startTimestamp: 1_700_000_000,
		endTimestamp: 1_700_003_600,
		type: 3,
	},
	senseMedia: {
		provider: "netflix",
		kind: "episode",
		title: "Stranger Things",
		season: 4,
		episode: 1,
		positionSec: 30,
		durationSec: 3600,
	},
	profileButtonUrl: "https://sense.example/profile/ada",
};

describe("Discord desktop socket", () => {
	test("a handshake and a View profile activity go out once Discord opens", async () => {
		resetDiscordDesktopSession();
		const sockets: FakeSocket[] = [];
		const connected = await requestDiscordDesktopStatus({
			clientId: "123456789012345678",
			ports: [6463],
			createSocket: (url) => {
				const socket = fakeSocket(url);
				sockets.push(socket);
				return socket;
			},
		});
		expect(connected).toBe("connected");
		expect(sockets[0]?.url).toBe("ws://127.0.0.1:6463/?v=1&encoding=json");
		const handshake = decodeDiscordIpcFrames(
			sockets[0]?.sent[0] ?? new Uint8Array(),
		);
		expect(handshake.frames[0]).toEqual({
			opcode: DISCORD_IPC_HANDSHAKE,
			payload: { v: 1, client_id: "123456789012345678" },
		});

		const posted = await publishDiscordDesktopActivity(PLAYING, {
			clientId: "123456789012345678",
			now: 1_700_000_030_000,
		});
		expect(posted).toBe(true);
		const activity = decodeDiscordIpcFrames(
			sockets[0]?.sent[1] ?? new Uint8Array(),
		);
		expect(activity.frames[0]?.opcode).toBe(DISCORD_IPC_FRAME);
		expect(activity.frames[0]?.payload).toMatchObject({
			cmd: "SET_ACTIVITY",
			args: {
				activity: {
					type: 3,
					name: "with Sense",
					details: "Stranger Things",
					state: "S4 E1 - Chapter One",
					buttons: [
						{ label: "View profile", url: "https://sense.example/profile/ada" },
					],
				},
			},
		});
	});

	test("a closed Discord stays disconnected", async () => {
		resetDiscordDesktopSession();
		const connected = await requestDiscordDesktopStatus({
			clientId: "123456789012345678",
			ports: [6463],
			createSocket: () => {
				const socket = fakeSocket("ws://127.0.0.1:6463/?v=1&encoding=json");
				queueMicrotask(() => {
					socket.onerror?.(new Event("error"));
				});
				socket.open = () => {};
				return socket;
			},
		});
		expect(connected).toBe("closed");
	});
});
