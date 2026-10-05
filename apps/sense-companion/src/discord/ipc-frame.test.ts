import { describe, expect, test } from "bun:test";

import {
	DISCORD_IPC_HANDSHAKE,
	decodeDiscordIpcFrames,
	encodeDiscordIpcFrame,
} from "./ipc-frame";

describe("Discord IPC frames", () => {
	test("a handshake round-trips the application id", () => {
		const frame = encodeDiscordIpcFrame(DISCORD_IPC_HANDSHAKE, {
			v: 1,
			client_id: "123456789012345678",
		});
		const decoded = decodeDiscordIpcFrames(frame);
		expect(decoded.frames).toEqual([
			{
				opcode: DISCORD_IPC_HANDSHAKE,
				payload: { v: 1, client_id: "123456789012345678" },
			},
		]);
		expect(decoded.rest.length).toBe(0);
	});

	test("a split frame waits for the rest of the body", () => {
		const frame = encodeDiscordIpcFrame(DISCORD_IPC_HANDSHAKE, { v: 1 });
		const partial = decodeDiscordIpcFrames(frame.subarray(0, 6));
		expect(partial.frames).toEqual([]);
		const done = decodeDiscordIpcFrames(
			concatBytes(partial.rest, frame.subarray(6)),
		);
		expect(done.frames[0]).toEqual({
			opcode: DISCORD_IPC_HANDSHAKE,
			payload: { v: 1 },
		});
	});
});

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
	const merged = new Uint8Array(left.length + right.length);
	merged.set(left, 0);
	merged.set(right, left.length);
	return merged;
}
