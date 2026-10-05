export type ActivitySetting = {
	id: string;
	title?: string;
	description?: string;
	value?: string | number | boolean;
	values?: readonly string[];
	/** Show this row only when every listed setting already has that value. */
	if?: Readonly<Record<string, string | number | boolean>>;
	multiLanguage?: boolean;
};

export type SettingValues = Record<string, string | number | boolean>;

/** Defaults the vendored scripts read through presence.getSetting. */
export function settingDefaults(
	settings: readonly ActivitySetting[],
): SettingValues {
	const defaults: SettingValues = {};
	for (const setting of settings) {
		if (typeof setting.value !== "undefined") {
			defaults[setting.id] = setting.value;
			continue;
		}
		if (setting.multiLanguage) defaults[setting.id] = "en";
	}
	return defaults;
}

/** Rows the setup page can edit. Language stays English; there is no picker. */
export function customizableSettings(
	settings: readonly ActivitySetting[],
): ActivitySetting[] {
	return settings.filter((setting) => {
		if (setting.multiLanguage || !setting.title) return false;
		if (typeof setting.value === "boolean") return true;
		return Array.isArray(setting.values) && setting.values.length > 0;
	});
}

export function settingIsVisible(
	setting: ActivitySetting,
	values: SettingValues,
): boolean {
	if (!setting.if) return true;
	return Object.entries(setting.if).every(
		([key, expected]) => values[key] === expected,
	);
}

/**
 * Keep a saved choice only when it matches the metadata type for that id.
 * Unknown ids and wrong types stay on the default.
 */
export function mergeSettingOverrides(
	defaults: SettingValues,
	overrides: Record<string, unknown> | null | undefined,
): SettingValues {
	const next: SettingValues = { ...defaults };
	if (!overrides) return next;
	for (const [key, value] of Object.entries(overrides)) {
		const current = next[key];
		if (typeof current !== typeof value) continue;
		if (typeof value === "number" && !Number.isFinite(value)) continue;
		if (
			typeof value === "boolean" ||
			typeof value === "number" ||
			typeof value === "string"
		) {
			next[key] = value;
		}
	}
	return next;
}

const COMPANION_SITE_IDS = [
	"netflix",
	"disney",
	"prime",
	"apple",
	"max",
] as const;

export type CompanionSiteId = (typeof COMPANION_SITE_IDS)[number];

export function isCompanionSiteId(value: string): value is CompanionSiteId {
	return (COMPANION_SITE_IDS as readonly string[]).includes(value);
}

/** chrome.storage.local shape: one override map per streaming service. */
export function parseStoredSettings(
	value: unknown,
): Partial<Record<CompanionSiteId, SettingValues>> {
	if (typeof value !== "object" || value === null) return {};
	const record = value as Record<string, unknown>;
	const stored: Partial<Record<CompanionSiteId, SettingValues>> = {};
	for (const id of COMPANION_SITE_IDS) {
		const site = record[id];
		if (typeof site !== "object" || site === null) continue;
		const entries: SettingValues = {};
		for (const [key, entry] of Object.entries(site)) {
			if (typeof entry === "boolean" || typeof entry === "string") {
				entries[key] = entry;
				continue;
			}
			if (typeof entry === "number" && Number.isFinite(entry)) {
				entries[key] = entry;
			}
		}
		stored[id] = entries;
	}
	return stored;
}
