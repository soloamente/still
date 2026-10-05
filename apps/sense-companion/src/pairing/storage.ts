import { browser } from "wxt/browser";

import type { CompanionTokenStore } from "./client";
import {
	COMPANION_SOURCE_ID_KEY,
	type CompanionSourceIdStore,
} from "./source-id";

const TOKEN_KEY = "senseCompanionToken";

/** Device token lives in extension storage. The server only keeps its hash. */
export const chromeCompanionTokenStore: CompanionTokenStore = {
	async get() {
		const stored = await browser.storage.local.get(TOKEN_KEY);
		const value = stored[TOKEN_KEY];
		return typeof value === "string" && value.length > 0 ? value : null;
	},
	async set(token) {
		await browser.storage.local.set({ [TOKEN_KEY]: token });
	},
	async clear() {
		await browser.storage.local.remove(TOKEN_KEY);
	},
};

/** Stable id for this browser profile. Separate from the pairing token. */
export const chromeCompanionSourceIdStore: CompanionSourceIdStore = {
	async get() {
		const stored = await browser.storage.local.get(COMPANION_SOURCE_ID_KEY);
		const value = stored[COMPANION_SOURCE_ID_KEY];
		return typeof value === "string" && value.length > 0 ? value : null;
	},
	async set(id) {
		await browser.storage.local.set({ [COMPANION_SOURCE_ID_KEY]: id });
	},
};
