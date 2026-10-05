import { describe, expect, test } from "bun:test";
import { companionPlaybackReadyToLog } from "./companion-auto-log";
import {
	CompanionNowWatching,
	companionProfileHardStopMs,
	MemoryCompanionWatchingStore,
	pickCompanionMatch,
} from "./companion-now-watching";

const USER_ID = "usr_companion";

const STRANGER = {
	provider: "netflix" as const,
	kind: "episode" as const,
	title: "Stranger Things",
	season: 1,
	episode: 2,
	positionSec: 30,
	durationSec: 3600,
};

function harness() {
	let now = Date.parse("2026-09-30T00:00:00.000Z");
	const store = new MemoryCompanionWatchingStore();
	let searches = 0;
	const watching = new CompanionNowWatching(
		store,
		async () => {
			searches += 1;
			return [
				{ id: 1, title: "Strange Brew" },
				{ id: 66732, title: "Stranger Things" },
			];
		},
		{ now: () => now },
	);
	return {
		watching,
		advance(ms: number) {
			now += ms;
		},
		searches: () => searches,
	};
}

describe("pickCompanionMatch", () => {
	test("prefers an exact title over the first search row", () => {
		expect(
			pickCompanionMatch("stranger things", [
				{ id: 1, title: "Strange Brew" },
				{ id: 66732, title: "Stranger Things" },
			]),
		).toEqual({ id: 66732, title: "Stranger Things" });
	});

	test("returns null when TMDb has nothing", () => {
		expect(pickCompanionMatch("Nope", [])).toBeNull();
	});
});

describe("companion now watching", () => {
	test("GET returns the matched title immediately after a heartbeat", async () => {
		const { watching, searches } = harness();
		const started = Date.now();

		await watching.heartbeat(USER_ID, { media: STRANGER, paused: false });
		const view = await watching.read(USER_ID);

		expect(Date.now() - started).toBeLessThan(2000);
		expect(view).toMatchObject({
			title: "Stranger Things",
			tmdbId: 66732,
			href: "/tv/66732",
			kind: "tv",
			season: 1,
			episode: 2,
			positionSec: 30,
			paused: false,
		});
		expect(searches()).toBe(1);

		await watching.heartbeat(USER_ID, {
			media: { ...STRANGER, positionSec: 45 },
			paused: false,
		});
		expect(searches()).toBe(1);
	});

	test("movies link to the movie page", async () => {
		const store = new MemoryCompanionWatchingStore();
		const watching = new CompanionNowWatching(store, async () => [
			{ id: 603, title: "The Matrix" },
		]);
		await watching.heartbeat(USER_ID, {
			media: {
				provider: "netflix",
				kind: "movie",
				title: "The Matrix",
				season: null,
				episode: null,
				positionSec: 10,
				durationSec: 8000,
			},
			paused: false,
		});
		expect(await watching.read(USER_ID)).toMatchObject({
			kind: "movie",
			tmdbId: 603,
			href: "/movies/603",
		});
	});

	test("drops the title 90 seconds after the last heartbeat", async () => {
		const { watching, advance } = harness();
		await watching.heartbeat(USER_ID, { media: STRANGER, paused: false });
		advance(90_000);
		expect(await watching.read(USER_ID)).toBeNull();
	});

	test("hard-stops after 20 minutes when runtime is unknown", async () => {
		const { watching, advance } = harness();
		const noRuntime = { ...STRANGER, durationSec: null };
		await watching.heartbeat(USER_ID, { media: noRuntime, paused: false });
		for (let minute = 0; minute < 19; minute++) {
			advance(60_000);
			await watching.heartbeat(USER_ID, {
				media: { ...noRuntime, positionSec: (minute + 1) * 60 },
				paused: false,
			});
		}
		advance(60_000);

		const atHardStop = await watching.heartbeat(USER_ID, {
			media: { ...noRuntime, positionSec: 7200 },
			paused: false,
		});
		expect(atHardStop).toMatchObject({ title: "Stranger Things" });
		expect(await watching.read(USER_ID)).toBeNull();
	});

	test("keeps the profile row through a long reported runtime", async () => {
		const { watching, advance } = harness();
		const twoHours = { ...STRANGER, durationSec: 7200 };
		await watching.heartbeat(USER_ID, { media: twoHours, paused: false });
		// Heartbeat each minute so the 90s TTL does not reset startedAt mid-film.
		for (let minute = 0; minute < 90; minute++) {
			advance(60_000);
			await watching.heartbeat(USER_ID, {
				media: { ...twoHours, positionSec: (minute + 1) * 60 },
				paused: false,
			});
		}
		expect(await watching.read(USER_ID)).toMatchObject({
			title: "Stranger Things",
			positionSec: 90 * 60,
		});
		const hardStopMs = companionProfileHardStopMs(7200);
		const minutesToHardStop = Math.ceil(hardStopMs / 60_000);
		for (let minute = 90; minute < minutesToHardStop; minute++) {
			advance(60_000);
			await watching.heartbeat(USER_ID, {
				media: { ...twoHours, positionSec: (minute + 1) * 60 },
				paused: false,
			});
		}
		advance(60_000);
		const atEnd = await watching.heartbeat(USER_ID, {
			media: { ...twoHours, positionSec: 7100 },
			paused: false,
		});
		expect(companionPlaybackReadyToLog(atEnd!)).toBe(true);
		expect(await watching.read(USER_ID)).toBeNull();
	});

	test("the next episode shows after the previous one was hard-stopped", async () => {
		const { watching, advance } = harness();
		const noRuntime = { ...STRANGER, durationSec: null };
		await watching.heartbeat(USER_ID, { media: noRuntime, paused: false });
		for (let minute = 0; minute < 20; minute++) {
			advance(60_000);
			await watching.heartbeat(USER_ID, {
				media: { ...noRuntime, positionSec: (minute + 1) * 60 },
				paused: false,
			});
		}
		expect(await watching.read(USER_ID)).toBeNull();

		await watching.heartbeat(USER_ID, {
			media: { ...noRuntime, episode: 3, positionSec: 12 },
			paused: false,
		});
		expect(await watching.read(USER_ID)).toMatchObject({
			title: "Stranger Things",
			season: 1,
			episode: 3,
		});
	});

	test("starting the same episode over clears the hard-stop hide", async () => {
		const { watching, advance } = harness();
		const noRuntime = { ...STRANGER, durationSec: null };
		await watching.heartbeat(USER_ID, { media: noRuntime, paused: false });
		for (let minute = 0; minute < 20; minute++) {
			advance(60_000);
			await watching.heartbeat(USER_ID, {
				media: { ...noRuntime, positionSec: (minute + 1) * 60 },
				paused: false,
			});
		}
		expect(await watching.read(USER_ID)).toBeNull();

		await watching.heartbeat(USER_ID, {
			media: { ...noRuntime, positionSec: 4 },
			paused: false,
		});
		expect(await watching.read(USER_ID)).toMatchObject({
			title: "Stranger Things",
			episode: 2,
			positionSec: 4,
		});
	});

	test("clear removes the title", async () => {
		const { watching } = harness();
		await watching.heartbeat(USER_ID, { media: STRANGER, paused: false });
		expect(await watching.heartbeat(USER_ID, { clear: true })).toBeNull();
		expect(await watching.read(USER_ID)).toBeNull();
	});

	test("an idle browser does not clear the browser that is playing", async () => {
		const { watching } = harness();
		await watching.heartbeat(
			USER_ID,
			{ media: STRANGER, paused: false },
			"chrome",
		);
		expect(
			await watching.heartbeat(USER_ID, { clear: true }, "edge"),
		).toMatchObject({ title: "Stranger Things" });
		expect(await watching.read(USER_ID)).toMatchObject({
			title: "Stranger Things",
		});
		expect(
			await watching.heartbeat(USER_ID, { clear: true }, "chrome"),
		).toBeNull();
		expect(await watching.read(USER_ID)).toBeNull();
	});
});
