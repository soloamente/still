import { describe, expect, it } from "bun:test";

import {
	avatarAuraRimStyle,
	avatarAuraTierClassName,
	avatarAuraVisualClassName,
	hasAvatarAura,
	hasAvatarAuraVisual,
	resolveAvatarAuraTier,
	resolveAvatarAuraVisual,
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

describe("resolveAvatarAuraVisual", () => {
	it("staff role wins over paid plan tier", () => {
		expect(
			resolveAvatarAuraVisual({ planTier: "devoted", staffRole: "admin" }),
		).toEqual({ kind: "staff" });
	});

	it("falls back to plan tier when not staff", () => {
		expect(resolveAvatarAuraVisual({ planTier: "attuned" })).toEqual({
			kind: "plan",
			tier: "attuned",
		});
	});
});

describe("avatarAuraTierClassName", () => {
	it("returns a CSS modifier for every paid tier", () => {
		expect(avatarAuraTierClassName("attuned")).toBe("avatar-aura-rim--attuned");
		expect(avatarAuraTierClassName("immersed")).toBe(
			"avatar-aura-rim--immersed",
		);
		expect(avatarAuraTierClassName("devoted")).toBe("avatar-aura-rim--devoted");
	});
});

describe("avatarAuraVisualClassName", () => {
	it("returns staff seal class for staff visual", () => {
		expect(avatarAuraVisualClassName({ kind: "staff" })).toBe(
			"avatar-aura-rim--staff",
		);
	});
});

describe("hasAvatarAuraVisual", () => {
	it("is true for staff and paid tiers", () => {
		expect(hasAvatarAuraVisual({ kind: "staff" })).toBe(true);
		expect(hasAvatarAuraVisual({ kind: "plan", tier: "attuned" })).toBe(true);
		expect(hasAvatarAuraVisual({ kind: "none" })).toBe(false);
	});
});

describe("avatarAuraRimStyle", () => {
	it("returns an empty object — rim paint lives in CSS", () => {
		expect(avatarAuraRimStyle("attuned")).toEqual({});
	});
});
