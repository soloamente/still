import { describe, expect, test } from "bun:test";
import { applyAvatarGroupShifts } from "./use-avatar-group-hover";

function fakeItem() {
	const vars = new Map<string, string>();
	return {
		style: {
			transitionTimingFunction: "",
			setProperty(name: string, value: string) {
				vars.set(name, value);
			},
			getPropertyValue(name: string) {
				return vars.get(name) ?? "";
			},
		},
	} as unknown as HTMLElement;
}

const tokens = {
	lift: -4,
	falloff: 0.45,
	scale: 1.05,
	easeIn: "cubic-bezier(0.22, 1, 0.36, 1)",
	easeOut: "cubic-bezier(0.34, 3.85, 0.64, 1)",
};

describe("applyAvatarGroupShifts", () => {
	test("lifts the active item and falloff-neighbors on hover in", () => {
		const items = [fakeItem(), fakeItem(), fakeItem()];
		applyAvatarGroupShifts(items, 1, "in", tokens);

		expect(items[1]?.style.getPropertyValue("--scale-active")).toBe("1.05");
		expect(items[1]?.style.getPropertyValue("--shift")).toBe("-4.000px");
		// Immediate neighbors: lift * falloff^1
		expect(items[0]?.style.getPropertyValue("--shift")).toBe("-1.800px");
		expect(items[0]?.style.getPropertyValue("--scale-active")).toBe("1");
		expect(items[1]?.style.transitionTimingFunction).toBe(tokens.easeIn);
	});

	test("resets every item with the spring ease on leave", () => {
		const items = [fakeItem(), fakeItem()];
		applyAvatarGroupShifts(items, 0, "in", tokens);
		applyAvatarGroupShifts(items, null, "out", tokens);

		expect(items[0]?.style.getPropertyValue("--shift")).toBe("0px");
		expect(items[0]?.style.getPropertyValue("--scale-active")).toBe("1");
		expect(items[0]?.style.transitionTimingFunction).toBe(tokens.easeOut);
	});
});
