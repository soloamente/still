export const PROFILE_PREF_PROFILE_ACCENT = "profileAccent" as const;
export const PROFILE_PREF_BANNER_FRAME = "bannerFrame" as const;

export const PROFILE_ACCENT_PRESETS = {
	desert: { label: "Desert", hex: "#c45c26" },
	copper: { label: "Copper", hex: "#b75928" },
	rose: { label: "Rose", hex: "#c45c2a" },
	slate: { label: "Slate", hex: "#8b9aab" },
} as const;

export type ProfileAccentId = keyof typeof PROFILE_ACCENT_PRESETS;

export const PROFILE_BANNER_FRAMES = {
	none: { label: "None", description: "Standard banner crop" },
	cinema: { label: "Cinema", description: "Inset frame on your banner" },
	editorial: {
		label: "Editorial",
		description: "Soft depth on the hero strip",
	},
} as const;

export type ProfileBannerFrameId = keyof typeof PROFILE_BANNER_FRAMES;

export function isProfileAccentId(value: unknown): value is ProfileAccentId {
	return typeof value === "string" && value in PROFILE_ACCENT_PRESETS;
}

export function isProfileBannerFrameId(
	value: unknown,
): value is ProfileBannerFrameId {
	return typeof value === "string" && value in PROFILE_BANNER_FRAMES;
}

export function readProfileAccentPref(
	preferences: Record<string, unknown> | null | undefined,
): ProfileAccentId | null {
	if (preferences == null) return null;
	const raw = preferences[PROFILE_PREF_PROFILE_ACCENT];
	return isProfileAccentId(raw) ? raw : null;
}

export function readProfileBannerFramePref(
	preferences: Record<string, unknown> | null | undefined,
): ProfileBannerFrameId {
	if (preferences == null) return "none";
	const raw = preferences[PROFILE_PREF_BANNER_FRAME];
	return isProfileBannerFrameId(raw) ? raw : "none";
}

export function profileAccentHex(id: ProfileAccentId): string {
	return PROFILE_ACCENT_PRESETS[id].hex;
}

/** When legacy profiles only stored `accentColor`, map hex back to a preset for Settings. */
export function inferProfileAccentFromHex(
	hex: string | null | undefined,
): ProfileAccentId | null {
	const normalized = hex?.trim().toLowerCase();
	if (!normalized) return null;
	for (const [id, def] of Object.entries(PROFILE_ACCENT_PRESETS) as [
		ProfileAccentId,
		(typeof PROFILE_ACCENT_PRESETS)[ProfileAccentId],
	][]) {
		if (def.hex.toLowerCase() === normalized) return id;
	}
	return null;
}

/** Public profile hero — banner frame styling without extra borders on the page shell. */
export function profileBannerFrameClass(
	frame: ProfileBannerFrameId,
): string | undefined {
	switch (frame) {
		case "cinema":
			return "shadow-[inset_0_0_0_3px_rgba(255,255,255,0.22)]";
		case "editorial":
			return "shadow-[inset_0_0_0_2px_rgba(255,255,255,0.16),0_32px_64px_-28px_rgba(0,0,0,0.65)]";
		default:
			return undefined;
	}
}
