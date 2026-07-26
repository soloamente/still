import { describe, expect, it } from "bun:test";

import {
	avatarAuraRimStyle,
	hasAvatarAura,
	resolveAvatarAuraTier,
} from "./avatar-aura-tier";

describe("resolveAvatarAuraTier", () => {
	it("passes known tiers through", () => {
		expect(resolveAvatarAuraTier("devoted")).toBe("devoted");
	});
	it("coerces null/undefined/unknown to still", () => {
		expect(resolveAvatarAuraTier(null)).toBe("still");
		expect(resolveAvatarAuraTier(undefined)).toBe("still");
		expect(resolveAvatarAuraTier("chromatic")).toBe("still");
	});
});

describe("hasAvatarAura", () => {
	it("is false for still, true for paid tiers", () => {
		expect(hasAvatarAura("still")).toBe(false);
		expect(hasAvatarAura("attuned")).toBe(true);
		expect(hasAvatarAura("immersed")).toBe(true);
		expect(hasAvatarAura("devoted")).toBe(true);
	});
});

describe("avatarAuraRimStyle", () => {
	it("returns a conic gradient for every paid tier", () => {
		for (const tier of ["attuned", "immersed", "devoted"] as const) {
			expect(avatarAuraRimStyle(tier).background).toContain("conic-gradient");
		}
	});
});
