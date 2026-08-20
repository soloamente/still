import { describe, expect, test } from "bun:test";

import {
	resolveSenseLiquidFill,
	SENSE_LIQUID_BLUR,
	SENSE_LIQUID_CONTRAST,
	SENSE_LIQUID_MOVE,
} from "@/components/ui/sense-liquid";

describe("SenseLiquid presets", () => {
	test("Move pills match SliderThumb blur/contrast", () => {
		expect(SENSE_LIQUID_BLUR).toBe(9);
		expect(SENSE_LIQUID_CONTRAST).toBe(40);
	});

	test("Move trail matches SliderThumb knobs", () => {
		expect(SENSE_LIQUID_MOVE.springiness).toBe(0.5);
		expect(SENSE_LIQUID_MOVE.trail).toBe(0.35);
	});

	test("resolveSenseLiquidFill falls back without document", () => {
		// Bun test has no layout engine — ensure we never return a CSS var string.
		const fill = resolveSenseLiquidFill("card");
		expect(fill.includes("var(")).toBe(false);
	});
});
