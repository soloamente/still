import appleMetadata from "../../vendor/premid-activities/websites/A/Apple TV+/metadata.json";
import disneyMetadata from "../../vendor/premid-activities/websites/D/Disney+/metadata.json";
import maxMetadata from "../../vendor/premid-activities/websites/H/HBO Max/metadata.json";
import netflixMetadata from "../../vendor/premid-activities/websites/N/Netflix/metadata.json";
import primeMetadata from "../../vendor/premid-activities/websites/P/Prime Video/metadata.json";
import type { ActivitySetting, CompanionSiteId } from "./settings.ts";

export type CompanionSite = {
	id: CompanionSiteId;
	/** Name the player reports to Discord. */
	service: string;
	/** Short name on the setup page. */
	label: string;
	settings: readonly ActivitySetting[];
};

/** Metadata `settings` arrays are JSON. Keep only fields the setup page uses. */
export function readActivitySettings(
	value: unknown,
): readonly ActivitySetting[] {
	if (!Array.isArray(value)) return [];
	const settings: ActivitySetting[] = [];
	for (const item of value) {
		if (typeof item !== "object" || item === null) continue;
		const row = item as Record<string, unknown>;
		if (typeof row.id !== "string") continue;
		const setting: ActivitySetting = { id: row.id };
		if (row.multiLanguage === true) setting.multiLanguage = true;
		if (typeof row.title === "string") setting.title = row.title;
		if (typeof row.description === "string")
			setting.description = row.description;
		if (
			typeof row.value === "boolean" ||
			typeof row.value === "number" ||
			typeof row.value === "string"
		) {
			setting.value = row.value;
		}
		if (
			Array.isArray(row.values) &&
			row.values.every((entry) => typeof entry === "string")
		) {
			setting.values = row.values;
		}
		if (
			typeof row.if === "object" &&
			row.if !== null &&
			!Array.isArray(row.if)
		) {
			const condition: Record<string, string | number | boolean> = {};
			for (const [key, expected] of Object.entries(row.if)) {
				if (
					typeof expected === "boolean" ||
					typeof expected === "number" ||
					typeof expected === "string"
				) {
					condition[key] = expected;
				}
			}
			setting.if = condition;
		}
		settings.push(setting);
	}
	return settings;
}

function site(
	id: CompanionSiteId,
	label: string,
	metadata: { service?: unknown; settings?: unknown },
): CompanionSite {
	const service =
		typeof metadata.service === "string" ? metadata.service : label;
	return {
		id,
		service,
		label,
		settings: readActivitySettings(metadata.settings),
	};
}

/** Netflix, Disney+, Prime Video, Apple TV+, and HBO Max, in setup-page order. */
export function companionSites(): readonly CompanionSite[] {
	return [
		site("netflix", "Netflix", netflixMetadata),
		site("disney", "Disney+", disneyMetadata),
		site("prime", "Prime Video", primeMetadata),
		site("apple", "Apple TV+", appleMetadata),
		site("max", "HBO Max", maxMetadata),
	];
}

export function companionSite(id: CompanionSiteId): CompanionSite {
	const match = companionSites().find((entry) => entry.id === id);
	if (!match) throw new Error(`Unknown Sense Companion site: ${id}`);
	return match;
}
