import { describe, expect, test } from "bun:test";

import { settingDetail } from "./setting-details.ts";
import { customizableSettings } from "./settings.ts";
import { companionSites } from "./sites.ts";

describe("setting details", () => {
	test("every playback option has an explanation", () => {
		for (const site of companionSites()) {
			for (const setting of customizableSettings(site.settings)) {
				const detail = settingDetail(site.id, setting.id);
				expect(detail, `${site.id}.${setting.id}`).toBeTruthy();
			}
		}
	});
});
