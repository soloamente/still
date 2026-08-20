import { describe, expect, test } from "bun:test";

import { applyFoil, FOILS, Follow, foilByKey } from "./engine";

describe("Follow", () => {
	test("settles toward target", () => {
		const f = new Follow(1);
		f.target = { x: 0.5, y: -0.25 };
		f.step();
		// Stiffness 1 covers the remaining distance in one frame.
		expect(f.value.x).toBeCloseTo(0.5, 5);
		expect(f.value.y).toBeCloseTo(-0.25, 5);
		// Speed decays after arrival — pump until the rAF gate would stop.
		for (let i = 0; i < 200 && !f.settled; i++) {
			f.step();
		}
		expect(f.settled).toBe(true);
	});
});

describe("FOILS", () => {
	test("exports ten materials including locked tier foils", () => {
		expect(FOILS).toHaveLength(10);
		for (const key of ["brushed", "holo", "velvet", "cosmos"] as const) {
			expect(foilByKey(key).key).toBe(key);
		}
	});
});

describe("applyFoil", () => {
	test("blanks unused layer slots", () => {
		// Bun has no document — mock a CSSStyleDeclaration-backed host.
		const props = new Map<string, string>();
		const el = {
			style: {
				setProperty(name: string, value: string) {
					props.set(name, value);
				},
				getPropertyValue(name: string) {
					return props.get(name) ?? "";
				},
			},
		} as unknown as HTMLElement;

		const foil = foilByKey("brushed"); // 2 layers → slot 3 blanked
		applyFoil(el, foil, {
			tileSrc: "https://example.com/p.jpg",
			bodyGrad: "linear-gradient(115deg, #eee, #ddd)",
			tileDark: "#333",
			tileLight: "#eee",
		});
		expect(el.style.getPropertyValue("--l3-img")).toBe("none");
		expect(el.style.getPropertyValue("--l3-o")).toBe("0");
		expect(el.style.getPropertyValue("--tile-src")).toContain("example.com");
		expect(el.style.getPropertyValue("--body-grad")).toContain(
			"linear-gradient",
		);
		expect(el.style.getPropertyValue("--tile-dark")).toBe("#333");
		expect(el.style.getPropertyValue("--tile-light")).toBe("#eee");
	});
});
