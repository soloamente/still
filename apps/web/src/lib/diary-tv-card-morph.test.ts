import { describe, expect, test } from "bun:test";

import {
	type DiaryTvCardBox,
	morphFade,
	morphFromCell,
	morphHome,
	morphToPanel,
	posterBoxInsideCard,
} from "./diary-tv-card-morph";

const cell: DiaryTvCardBox = {
	left: 40,
	top: 80,
	width: 120,
	height: 180,
	radius: 48,
};

const panel: DiaryTvCardBox = {
	left: 200,
	top: 60,
	width: 800,
	height: 520,
	radius: 32,
};

const slot: DiaryTvCardBox = {
	left: 224,
	top: 116,
	width: 176,
	height: 264,
	radius: 20,
};

describe("diary TV card morph", () => {
	test("starts as the poster, with the card the same size behind it", () => {
		const start = morphFromCell(cell);
		expect(start.card).toEqual(cell);
		expect(start.poster).toEqual({
			left: 0,
			top: 0,
			width: 120,
			height: 180,
			radius: 48,
		});
		expect(start.contentOpacity).toBe(0);
		expect(start.duration).toBe(0);
	});

	test("puts the poster in the left slot once the card is the dialog", () => {
		const poster = posterBoxInsideCard(panel, slot);
		expect(poster).toEqual({
			left: 24,
			top: 56,
			width: 176,
			height: 264,
			radius: 20,
		});
		const end = morphToPanel(panel, poster);
		expect(end.card).toEqual(panel);
		expect(end.contentOpacity).toBe(1);
		expect(end.duration).toBe(0.45);
	});

	test("the trip home fills the card with the poster again", () => {
		const home = morphHome(cell);
		expect(home.poster.left).toBe(0);
		expect(home.poster.width).toBe(cell.width);
		expect(home.contentOpacity).toBe(0);
		expect(home.duration).toBe(0.45);
	});

	test("a missing cell fades in place", () => {
		const faded = morphFade(
			morphToPanel(panel, posterBoxInsideCard(panel, slot)),
		);
		expect(faded.card).toEqual(panel);
		expect(faded.cardOpacity).toBe(0);
		expect(faded.contentOpacity).toBe(0);
		expect(faded.duration).toBe(0.2);
	});
});
