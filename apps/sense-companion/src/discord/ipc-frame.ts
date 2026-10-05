/** Discord IPC opcodes. Handshake first, then JSON frames. Ping must be ponged. */
export const DISCORD_IPC_HANDSHAKE = 0;
export const DISCORD_IPC_FRAME = 1;
export const DISCORD_IPC_PING = 3;
export const DISCORD_IPC_PONG = 4;

export type DiscordIpcFrame = {
	opcode: number;
	payload: unknown;
};

/**
 * Discord desktop's local socket uses the same 8-byte header as the named pipe:
 * opcode and JSON length, little-endian, then the JSON body.
 */
export function encodeDiscordIpcFrame(
	opcode: number,
	payload: unknown,
): Uint8Array {
	const json = new TextEncoder().encode(JSON.stringify(payload));
	const frame = new Uint8Array(8 + json.length);
	const view = new DataView(frame.buffer);
	view.setUint32(0, opcode, true);
	view.setUint32(4, json.length, true);
	frame.set(json, 8);
	return frame;
}

/** Pull every complete frame out of a socket buffer. `rest` is the unfinished tail. */
export function decodeDiscordIpcFrames(buffer: Uint8Array): {
	frames: DiscordIpcFrame[];
	rest: Uint8Array;
} {
	const frames: DiscordIpcFrame[] = [];
	const view = new DataView(
		buffer.buffer,
		buffer.byteOffset,
		buffer.byteLength,
	);
	let offset = 0;
	while (offset + 8 <= buffer.length) {
		const opcode = view.getUint32(offset, true);
		const length = view.getUint32(offset + 4, true);
		if (offset + 8 + length > buffer.length) break;
		const json = new TextDecoder().decode(
			buffer.subarray(offset + 8, offset + 8 + length),
		);
		frames.push({ opcode, payload: JSON.parse(json) as unknown });
		offset += 8 + length;
	}
	return { frames, rest: buffer.subarray(offset) };
}
