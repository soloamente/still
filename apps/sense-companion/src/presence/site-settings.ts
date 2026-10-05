import { browser } from "wxt/browser";

import {
	type CompanionSiteId,
	parseStoredSettings,
	type SettingValues,
} from "./settings.ts";

export const COMPANION_SETTINGS_KEY = "senseCompanionSettings";
export const COMPANION_ONBOARDED_KEY = "senseCompanionOnboarded";

export async function readStoredSettings(): Promise<
	Partial<Record<CompanionSiteId, SettingValues>>
> {
	const stored = await browser.storage.local.get(COMPANION_SETTINGS_KEY);
	return parseStoredSettings(stored[COMPANION_SETTINGS_KEY]);
}

/** Write one toggle or dropdown. Other services in the same object stay put. */
export async function writeSiteSetting(
	site: CompanionSiteId,
	id: string,
	value: string | number | boolean,
): Promise<void> {
	const stored = await readStoredSettings();
	const current = stored[site] ?? {};
	await browser.storage.local.set({
		[COMPANION_SETTINGS_KEY]: {
			...stored,
			[site]: { ...current, [id]: value },
		},
	});
}

export async function readOnboarded(): Promise<boolean> {
	const stored = await browser.storage.local.get(COMPANION_ONBOARDED_KEY);
	return stored[COMPANION_ONBOARDED_KEY] === true;
}

export async function markOnboarded(): Promise<void> {
	await browser.storage.local.set({ [COMPANION_ONBOARDED_KEY]: true });
}
