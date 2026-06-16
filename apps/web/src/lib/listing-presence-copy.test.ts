import { describe, expect, test } from "bun:test";

import {
	buildListingPresenceDrawerCopy,
	formatListingPresenceViewingLine,
	formatPatronPresenceDotLabel,
	resolveListingPresenceRowDisplay,
} from "@/lib/listing-presence-copy";

describe("formatPatronPresenceDotLabel", () => {
	test("active label mentions online now", () => {
		expect(formatPatronPresenceDotLabel("alice", "active")).toBe(
			"@alice online now",
		);
	});

	test("away label mentions away", () => {
		expect(formatPatronPresenceDotLabel("alice", "away")).toBe("@alice away");
	});
});

describe("formatListingPresenceViewingLine", () => {
	test("returns empty when alone", () => {
		expect(formatListingPresenceViewingLine(0)).toBe("");
	});

	test("singular copy for one other patron", () => {
		expect(formatListingPresenceViewingLine(1)).toBe("1 other patron viewing");
	});

	test("plural copy for multiple patrons", () => {
		expect(formatListingPresenceViewingLine(3)).toBe("3 other patrons viewing");
	});
});

describe("resolveListingPresenceRowDisplay", () => {
	test("returns null when viewer is alone on the title", () => {
		expect(
			resolveListingPresenceRowDisplay({ viewerCount: 0, viewingPatrons: [] }),
		).toBeNull();
	});

	test("anonymous count when no public viewers are present", () => {
		expect(
			resolveListingPresenceRowDisplay({
				viewerCount: 2,

				viewingPatrons: [],
			}),
		).toEqual({
			visibleViewingPatrons: [],

			viewingMoreCount: 0,

			unidentifiedCount: 2,

			countLine: "2 other patrons viewing",
		});
	});

	test("shows viewing chips and trailing unidentified count", () => {
		const viewingPatron = {
			userId: "usr_a",

			handle: "alice",

			displayName: "Alice",

			image: null,

			avatarIsAnimated: false,

			diaryMetalTier: null,

			presenceState: "active" as const,
		};

		expect(
			resolveListingPresenceRowDisplay({
				viewerCount: 4,

				viewingPatrons: [viewingPatron],
			}),
		).toEqual({
			visibleViewingPatrons: [viewingPatron],

			viewingMoreCount: 0,

			unidentifiedCount: 3,

			countLine: "3 other patrons viewing",
		});
	});
});

describe("buildListingPresenceDrawerCopy", () => {
	test("uses singular title for one visible patron", () => {
		expect(
			buildListingPresenceDrawerCopy({
				viewerCount: 1,
				visibleCount: 1,
			}),
		).toEqual({
			title: "1 patron viewing now",
			description: "Patrons currently visible in this title presence room.",
			hiddenCount: 0,
		});
	});

	test("includes private visibility gap copy when hidden viewers exist", () => {
		expect(
			buildListingPresenceDrawerCopy({
				viewerCount: 4,
				visibleCount: 2,
			}),
		).toEqual({
			title: "2 patrons viewing now",
			description:
				"2 more patrons are viewing with private visibility settings.",
			hiddenCount: 2,
		});
	});
});
