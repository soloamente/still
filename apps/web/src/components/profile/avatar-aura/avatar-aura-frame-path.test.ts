import { describe, expect, test } from "bun:test";

import {
	AVATAR_AURA_FRAME_VIEWBOX,
	AVATAR_AURA_WELL_INSET_PERCENT,
	avatarAuraFrameMaskStyle,
	avatarAuraFrameMaskSvg,
	avatarAuraFramePaths,
} from "./avatar-aura-frame-path";

function commandCount(path: string, command: "M" | "L"): number {
	return path.split(" ").filter((token) => token === command).length;
}

describe("avatarAuraFramePaths", () => {
	test("every kind closes a path that starts with M", () => {
		for (const kind of ["attuned", "immersed", "devoted", "staff"] as const) {
			const { inner, outer } = avatarAuraFramePaths(kind);
			expect(inner.startsWith("M ")).toBe(true);
			expect(inner.endsWith(" Z")).toBe(true);
			expect(commandCount(inner, "L")).toBeGreaterThan(16);
			if (kind === "devoted") {
				expect(outer).toBeTruthy();
				expect(outer?.startsWith("M ")).toBe(true);
			} else {
				expect(outer).toBeNull();
			}
		}
	});

	test("immersed samples denser than attuned", () => {
		const attuned = avatarAuraFramePaths("attuned").inner;
		const immersed = avatarAuraFramePaths("immersed").inner;
		expect(commandCount(immersed, "L")).toBeGreaterThan(
			commandCount(attuned, "L"),
		);
	});
});

describe("avatarAuraFrameMaskSvg", () => {
	test("embeds viewBox and a white filled path", () => {
		const svg = avatarAuraFrameMaskSvg("attuned");
		expect(svg).toContain(
			`viewBox="0 0 ${AVATAR_AURA_FRAME_VIEWBOX} ${AVATAR_AURA_FRAME_VIEWBOX}"`,
		);
		expect(svg).toContain('fill="white"');
		expect(svg).toContain("<path");
	});

	test("devoted includes two paths", () => {
		const svg = avatarAuraFrameMaskSvg("devoted");
		expect(svg.split("<path").length - 1).toBe(2);
	});
});

describe("avatarAuraFrameMaskStyle", () => {
	test("exposes a data-URI mask custom property", () => {
		const style = avatarAuraFrameMaskStyle("staff");
		expect(style["--avatar-aura-frame-mask"].startsWith("url(")).toBe(true);
		expect(style["--avatar-aura-frame-mask"]).toContain("data:image/svg+xml");
	});
});

describe("AVATAR_AURA_WELL_INSET_PERCENT", () => {
	test("is 14 so the photo sits inside scallops", () => {
		expect(AVATAR_AURA_WELL_INSET_PERCENT).toBe(14);
	});
});
