import { describe, expect, it } from "bun:test";

import {
	statusWhenCatalogComplete,
	statusWhenEpisodesRemain,
} from "./tv-watch-progress-status";

describe("statusWhenCatalogComplete", () => {
	it("promotes active statuses to finished when every episode is watched", () => {
		expect(statusWhenCatalogComplete("watching")).toBe("finished");
		expect(statusWhenCatalogComplete("rewatching")).toBe("finished");
		expect(statusWhenCatalogComplete("paused")).toBe("finished");
	});

	it("keeps abandoned unchanged", () => {
		expect(statusWhenCatalogComplete("abandoned")).toBe("abandoned");
	});
});

describe("statusWhenEpisodesRemain", () => {
	it("drops finished back to watching when an episode is unchecked", () => {
		expect(statusWhenEpisodesRemain("finished")).toBe("watching");
	});

	it("leaves other statuses alone", () => {
		expect(statusWhenEpisodesRemain("watching")).toBe("watching");
		expect(statusWhenEpisodesRemain("paused")).toBe("paused");
	});
});
