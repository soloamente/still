import { describe, expect, it } from "bun:test";

import { resolveActivitySignatureTooltipPlacement } from "./activity-signature";

describe("resolveActivitySignatureTooltipPlacement", () => {
	const base = {
		anchorY: 200,
		tooltipWidth: 180,
		tooltipHeight: 32,
		offsetAbovePx: 40,
		cellHeightPx: 12,
		viewportWidth: 400,
		viewportHeight: 800,
	};

	it("centers on the anchor when there is room", () => {
		expect(
			resolveActivitySignatureTooltipPlacement({
				...base,
				anchorX: 200,
			}),
		).toEqual({
			left: 110,
			top: 160,
		});
	});

	it("shifts left near the right viewport edge", () => {
		expect(
			resolveActivitySignatureTooltipPlacement({
				...base,
				anchorX: 390,
			}),
		).toEqual({
			left: 208,
			top: 160,
		});
	});

	it("shifts right near the left viewport edge", () => {
		expect(
			resolveActivitySignatureTooltipPlacement({
				...base,
				anchorX: 10,
			}),
		).toEqual({
			left: 12,
			top: 160,
		});
	});
});
