import { describe, expect, test } from "bun:test";

import {
	cellCanReceivePoster,
	freezePosterFlightForFade,
	motionNumeric,
	readLiveFlightSample,
} from "./diary-tv-poster-flight";

const current = {
	origin: { left: 10, top: 20, width: 80, height: 120 },
	x: 400,
	y: 80,
	scale: 2.2,
	rotateY: 40,
	borderRadius: 12,
	opacity: 1,
	moveDuration: 0.45,
};

function fakeCell(opts: {
	connected: boolean;
	width: number;
	height: number;
}): HTMLElement {
	return {
		isConnected: opts.connected,
		getBoundingClientRect: () => ({
			width: opts.width,
			height: opts.height,
			top: 0,
			left: 0,
			bottom: opts.height,
			right: opts.width,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		}),
	} as HTMLElement;
}

describe("freezePosterFlightForFade", () => {
	test("freezes at the live sample and fades without moving", () => {
		const frozen = freezePosterFlightForFade(current, {
			x: 120,
			y: 36,
			scale: 1.4,
			rotateY: 90,
			borderRadius: 18,
		});
		expect(frozen).toEqual({
			...current,
			x: 120,
			y: 36,
			scale: 1.4,
			rotateY: 90,
			borderRadius: 18,
			opacity: 0,
			moveDuration: 0,
		});
	});

	test("falls back to the current targets when no live sample exists", () => {
		const frozen = freezePosterFlightForFade(current, null);
		expect(frozen.x).toBe(current.x);
		expect(frozen.y).toBe(current.y);
		expect(frozen.scale).toBe(current.scale);
		expect(frozen.rotateY).toBe(current.rotateY);
		expect(frozen.borderRadius).toBe(current.borderRadius);
		expect(frozen.opacity).toBe(0);
		expect(frozen.moveDuration).toBe(0);
	});
});

describe("readLiveFlightSample", () => {
	test("reads numbers and unit strings from onUpdate", () => {
		expect(
			readLiveFlightSample(
				{
					x: 16,
					y: "24px",
					scale: 1.1,
					rotateY: "90",
					borderRadius: "8px",
				},
				{
					x: 0,
					y: 0,
					scale: 1,
					rotateY: 0,
					borderRadius: 0,
				},
			),
		).toEqual({
			x: 16,
			y: 24,
			scale: 1.1,
			rotateY: 90,
			borderRadius: 8,
		});
	});

	test("keeps the fallback when a key is missing", () => {
		expect(motionNumeric(undefined, 7)).toBe(7);
		expect(
			readLiveFlightSample(
				{},
				{ x: 1, y: 2, scale: 3, rotateY: 4, borderRadius: 5 },
			),
		).toEqual({ x: 1, y: 2, scale: 3, rotateY: 4, borderRadius: 5 });
	});
});

describe("cellCanReceivePoster", () => {
	test("rejects a missing, detached, or zero-size cell", () => {
		expect(cellCanReceivePoster(null)).toBe(false);
		expect(
			cellCanReceivePoster(
				fakeCell({ connected: false, width: 80, height: 120 }),
			),
		).toBe(false);
		expect(
			cellCanReceivePoster(
				fakeCell({ connected: true, width: 0, height: 120 }),
			),
		).toBe(false);
		expect(
			cellCanReceivePoster(fakeCell({ connected: true, width: 80, height: 0 })),
		).toBe(false);
	});

	test("accepts a connected cell with a real box", () => {
		expect(
			cellCanReceivePoster(
				fakeCell({ connected: true, width: 80, height: 120 }),
			),
		).toBe(true);
	});
});
