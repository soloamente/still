import { describe, expect, test } from "bun:test";

import { formatActivityLogLine } from "./activity-log.ts";
import {
	configurePresenceRuntime,
	Presence,
	replacePresenceSettings,
	reportSenseMedia,
	tickPresenceUpdates,
} from "./shim.ts";

describe("Presence shim", () => {
	test("reads settings, resolves strings, and emits activity then clear", async () => {
		const sent: unknown[] = [];
		configurePresenceRuntime({
			service: "Netflix",
			settings: { privacy: false, timestamp: true },
			emit: (message) => {
				sent.push(message);
			},
		});

		const presence = new Presence({ clientId: "test-client" });
		expect(await presence.getSetting<boolean>("privacy")).toBe(false);
		expect(await presence.getStrings({ pause: "general.paused" })).toEqual({
			pause: "Paused",
		});

		await presence.setActivity({
			details: "Stranger Things",
			state: "S1 E2 - Chapter Two",
			largeImageText: "Season 1, Episode 2",
			startTimestamp: 1_700_000_000,
			endTimestamp: 1_700_003_600,
		});
		presence.clearActivity();

		expect(sent).toEqual([
			{
				type: "sense-companion:activity",
				service: "Netflix",
				activity: {
					details: "Stranger Things",
					state: "S1 E2 - Chapter Two",
					largeImageKey: null,
					largeImageText: "Season 1, Episode 2",
					smallImageKey: null,
					smallImageText: null,
					startTimestamp: 1_700_000_000,
					endTimestamp: 1_700_003_600,
					name: null,
					type: null,
				},
				senseMedia: null,
			},
			{ type: "sense-companion:clear", service: "Netflix" },
		]);
		expect(formatActivityLogLine(sent[0] as never)).toContain(
			"Stranger Things",
		);
		expect(formatActivityLogLine(sent[0] as never)).toContain("S1 E2");
		expect(formatActivityLogLine(sent[0] as never)).toContain("paused=false");
	});

	test("reportSenseMedia plus setActivity adds episodeTitle to the heartbeat media", async () => {
		const sent: unknown[] = [];
		configurePresenceRuntime({
			service: "Netflix",
			settings: {},
			emit: (message) => {
				sent.push(message);
			},
		});

		const presence = new Presence({ clientId: "test-client" });
		reportSenseMedia({
			provider: "netflix",
			kind: "episode",
			title: "Stranger Things",
			season: 4,
			episode: 1,
			positionSec: 10,
			durationSec: 3600,
		});
		await presence.setActivity({
			details: "Stranger Things",
			state: "S4 E1 - Chapter One",
		});

		expect(sent).toHaveLength(1);
		const message = sent[0] as {
			senseMedia: { episodeTitle?: string } | null;
		};
		expect(message.senseMedia?.episodeTitle).toBe("Chapter One");
	});

	test("fires UpdateData listeners on each tick", async () => {
		configurePresenceRuntime({
			service: "Netflix",
			settings: {},
			emit: () => {},
		});
		const presence = new Presence({ clientId: "test-client" });
		let ticks = 0;
		presence.on("UpdateData", async () => {
			ticks += 1;
		});

		await tickPresenceUpdates();
		expect(ticks).toBe(1);
	});

	test("a saved setting is what the already-loaded script reads", async () => {
		configurePresenceRuntime({
			service: "Netflix",
			settings: { privacy: false },
			emit: () => {},
		});
		const presence = new Presence({ clientId: "test-client" });
		replacePresenceSettings({ privacy: true });
		expect(await presence.getSetting<boolean>("privacy")).toBe(true);
	});
});
