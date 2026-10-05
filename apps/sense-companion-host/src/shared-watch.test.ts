import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CompanionActivityMessage } from "./companion-message";
import {
	pickSharedWatch,
	readSharedWatch,
	SHARED_WATCH_TTL_MS,
	snapshotWithoutToken,
	writeSourceSnapshot,
} from "./shared-watch";

const PLAYING: CompanionActivityMessage = {
	type: "sense-companion:activity",
	service: "Netflix",
	activity: {
		details: "Stranger Things",
		state: null,
		largeImageText: null,
		smallImageKey: null,
		smallImageText: null,
		startTimestamp: null,
		endTimestamp: null,
		name: "Stranger Things",
		type: 3,
	},
	senseMedia: {
		provider: "netflix",
		kind: "episode",
		title: "Stranger Things",
		season: 4,
		episode: 1,
		positionSec: 12,
		durationSec: 3000,
	},
};

const CLEAR: CompanionActivityMessage = {
	type: "sense-companion:clear",
	service: "Netflix",
};

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function tempDir(): string {
	const dir = mkdtempSync(path.join(os.tmpdir(), "sense-watch-"));
	dirs.push(dir);
	return dir;
}

describe("shared watch", () => {
	test("a playing browser wins over another browser that cleared", () => {
		const picked = pickSharedWatch(
			[
				{ updatedAt: 2_000, message: CLEAR },
				{ updatedAt: 1_000, message: PLAYING },
			],
			2_000,
		);
		expect(picked).toEqual(PLAYING);
	});

	test("two helpers keep their own files", () => {
		const dir = tempDir();
		writeSourceSnapshot(dir, "browser-playing", PLAYING, 1_000);
		writeSourceSnapshot(dir, "browser-idle", CLEAR, 2_000);
		expect(readSharedWatch(dir, 2_000)).toHaveLength(2);
		expect(pickSharedWatch(readSharedWatch(dir, 2_000), 2_000)).toEqual(
			PLAYING,
		);
	});

	test("the shared file keeps the title and drops the pairing token", () => {
		const withLayout = {
			...PLAYING,
			discordFields: {
				name: "Stranger Things",
				details: "S4 E1",
				state: "Sense",
				largeText: "Stranger Things",
			},
			profileButtonUrl: "https://sense.example/profile/ada",
			profileToken: "secret",
		} as CompanionActivityMessage & { profileToken: string };
		const stored = snapshotWithoutToken(withLayout);
		expect(JSON.stringify(stored)).not.toContain("secret");
		expect(stored).toEqual({
			...PLAYING,
			discordFields: withLayout.discordFields,
			profileButtonUrl: withLayout.profileButtonUrl,
		});
	});

	test("a stopped title expires", () => {
		const dir = tempDir();
		writeSourceSnapshot(dir, "browser-playing", PLAYING, 1_000);
		expect(readSharedWatch(dir, 1_000 + SHARED_WATCH_TTL_MS + 1)).toHaveLength(
			0,
		);
	});
});
