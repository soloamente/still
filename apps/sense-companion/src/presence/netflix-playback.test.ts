import { describe, expect, test } from "bun:test";

import netflixMetadata from "../../vendor/premid-activities/websites/N/Netflix/metadata.json";
import { formatActivityLogLine, formatSenseMediaLog } from "./activity-log.ts";
import { settingDefaults } from "./settings.ts";
import {
	type CompanionActivityMessage,
	configurePresenceRuntime,
	Presence,
	tickPresenceUpdates,
} from "./shim.ts";

const watchUrl = "https://www.netflix.com/watch/80077368";

describe("Netflix playback", () => {
	test("reports title, season, episode, pause state, and timestamps", async () => {
		const sent: CompanionActivityMessage[] = [];
		configurePresenceRuntime({
			service: "Netflix",
			settings: settingDefaults(netflixMetadata.settings),
			emit: (message) => {
				sent.push(message);
			},
		});
		globalThis.Presence = Presence;

		const video = {
			paused: false,
			readyState: 4,
			currentTime: 30,
			duration: 3600,
		};
		globalThis.document = {
			location: { href: watchUrl },
			querySelector: (selector: string) =>
				selector === "video" ? video : null,
		} as unknown as Document;
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					video: {
						type: "show",
						title: "Stranger Things",
						synopsis: "A town with a gate.",
						id: 80057281,
						currentEpisode: 80077368,
						year: 2016,
						runtime: 3600,
						boxart: [{ url: "https://example.test/box.jpg", w: 1, h: 1 }],
						seasons: [
							{
								seq: 1,
								episodes: [
									{
										episodeId: 80077368,
										seq: 2,
										title: "Chapter Two",
									},
								],
							},
						],
					},
				}),
			)) as typeof fetch;

		await import(
			"../../vendor/premid-activities/websites/N/Netflix/presence.ts"
		);
		await tickPresenceUpdates();

		const activityMessage = sent.find(
			(message) => message.type === "sense-companion:activity",
		);
		expect(activityMessage).toBeDefined();
		if (activityMessage?.type !== "sense-companion:activity") return;

		expect(activityMessage.activity.name).toBe("Stranger Things");
		expect(activityMessage.activity.details).toBe("Chapter Two");
		expect(activityMessage.activity.largeImageText).toBe("Season 1, Episode 2");
		expect(activityMessage.activity.startTimestamp).toBeNumber();
		expect(activityMessage.activity.endTimestamp).toBeNumber();
		expect(
			(activityMessage.activity.endTimestamp ?? 0) -
				(activityMessage.activity.startTimestamp ?? 0),
		).toBe(3600);

		const line = formatActivityLogLine(activityMessage);
		expect(line).toContain("Stranger Things");
		expect(line).toContain("Season 1, Episode 2");
		expect(line).toContain("Chapter Two");
		expect(line).toContain("paused=false");
		expect(line).toContain(String(activityMessage.activity.startTimestamp));
		expect(activityMessage.senseMedia).not.toBeNull();
		if (!activityMessage.senseMedia) return;
		expect(formatSenseMediaLog(activityMessage.senseMedia)).toBe(
			'Sense Companion media: {"provider":"netflix","kind":"episode","title":"Stranger Things","season":1,"episode":2,"positionSec":30,"durationSec":3600}',
		);

		video.paused = true;
		sent.length = 0;
		await tickPresenceUpdates();
		const pausedMessage = sent.find(
			(message) => message.type === "sense-companion:activity",
		);
		expect(pausedMessage?.type).toBe("sense-companion:activity");
		if (pausedMessage?.type !== "sense-companion:activity") return;
		expect(formatActivityLogLine(pausedMessage)).toContain("paused=true");
		expect(pausedMessage.activity.startTimestamp).toBeNull();
		expect(pausedMessage.activity.endTimestamp).toBeNull();
	});
});
