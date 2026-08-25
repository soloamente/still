import { describe, expect, test } from "bun:test";

import {
	LANDING_HERO_SPIRAL_IMAGE_SIZE_MAX,
	landingHeroSpiralLayout,
} from "./landing-hero-spiral-layout";

describe("landingHeroSpiralLayout", () => {
	test("keeps mobile tiles well under a short viewport so arms do not pile up", () => {
		const layout = landingHeroSpiralLayout(Math.min(432, 427));
		expect(layout.imageSize).toBeLessThan(56);
		expect(layout.imageSize).toBeGreaterThanOrEqual(40);
		// Portrait posters paint at imageSize tall — must stay a small fraction of the band.
		expect(layout.imageSize).toBeLessThan(427 * 0.13);
		// Linear 320/1386 scale still reads as stacked on a square Agentation band.
		expect(layout.imageSize).toBeLessThan(
			Math.round((427 / 1386) * LANDING_HERO_SPIRAL_IMAGE_SIZE_MAX),
		);
	});

	test("scales 320px desktop tiles down on the Agentation phone band", () => {
		expect(landingHeroSpiralLayout(1386).imageSize).toBe(
			LANDING_HERO_SPIRAL_IMAGE_SIZE_MAX,
		);
		expect(landingHeroSpiralLayout(Math.min(432, 427)).imageSize).toBe(48);
	});

	test("opens the coil a little on short phones", () => {
		const compact = landingHeroSpiralLayout(427);
		const desktop = landingHeroSpiralLayout(1386);
		expect(compact.spacing).toBeGreaterThan(desktop.spacing);
		expect(compact.spacing).toBeGreaterThanOrEqual(10);
		expect(compact.turns).toBeLessThan(desktop.turns);
	});
});
