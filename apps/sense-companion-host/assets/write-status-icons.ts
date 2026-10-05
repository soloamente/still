import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

/** Discord crops this to a circle. The glyph stays inset so it does not fill the badge. */
const SIZE = 128;

function crc32(data: Buffer): number {
	let crc = ~0;
	for (const byte of data) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}
	return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const name = Buffer.from(type);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
	return Buffer.concat([length, name, data, crc]);
}

function png(pixels: Uint8Array): Buffer {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(SIZE, 0);
	ihdr.writeUInt32BE(SIZE, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
	for (let y = 0; y < SIZE; y++) {
		const row = y * (SIZE * 4 + 1);
		raw[row] = 0;
		raw.set(pixels.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), row + 1);
	}
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([
		signature,
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

function paint(inside: (x: number, y: number) => boolean): Uint8Array {
	const pixels = new Uint8Array(SIZE * SIZE * 4);
	for (let y = 0; y < SIZE; y++) {
		for (let x = 0; x < SIZE; x++) {
			let cover = 0;
			for (const dx of [0.25, 0.75]) {
				for (const dy of [0.25, 0.75]) {
					if (inside(x + dx, y + dy)) cover++;
				}
			}
			const alpha = cover / 4;
			const index = (y * SIZE + x) * 4;
			// Dark badge, cream glyph. Corners are clipped by Discord's circle.
			pixels[index] = Math.round(20 * (1 - alpha) + 244 * alpha);
			pixels[index + 1] = Math.round(20 * (1 - alpha) + 241 * alpha);
			pixels[index + 2] = Math.round(20 * (1 - alpha) + 234 * alpha);
			pixels[index + 3] = 255;
		}
	}
	return pixels;
}

function inPlay(x: number, y: number): boolean {
	const left = 46;
	const right = 88;
	const top = 36;
	const bottom = 92;
	const mid = (top + bottom) / 2;
	if (x < left || x > right || y < top || y > bottom) return false;
	const reach = ((bottom - top) / 2) * (1 - (x - left) / (right - left));
	return Math.abs(y - mid) <= reach;
}

function inPause(x: number, y: number): boolean {
	const barWidth = 12;
	const barHeight = 52;
	const gap = 12;
	const top = (SIZE - barHeight) / 2;
	const total = barWidth * 2 + gap;
	const left = (SIZE - total) / 2;
	const inBar = (origin: number) =>
		x >= origin && x <= origin + barWidth && y >= top && y <= top + barHeight;
	return inBar(left) || inBar(left + barWidth + gap);
}

writeFileSync(
	new URL("./discord-play.png", import.meta.url),
	png(paint(inPlay)),
);
writeFileSync(
	new URL("./discord-pause.png", import.meta.url),
	png(paint(inPause)),
);
