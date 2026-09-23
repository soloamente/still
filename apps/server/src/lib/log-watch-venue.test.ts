import { describe, expect, test } from "bun:test";
import { log } from "@still/db/schema/activity";
import { PgDialect } from "drizzle-orm/pg-core";

import {
	diaryVenueSliceWhere,
	resolveCreateWatchVenue,
	resolvePatchWatchVenue,
} from "./log-watch-venue";

describe("resolveCreateWatchVenue", () => {
	test("omitted venue keeps the Quick Log default (streaming)", () => {
		expect(resolveCreateWatchVenue(undefined)).toBe("streaming");
	});

	test("explicit null stores an unset venue (Today instant log)", () => {
		expect(resolveCreateWatchVenue(null)).toBeNull();
	});

	test("explicit venue is kept", () => {
		expect(resolveCreateWatchVenue("theaters")).toBe("theaters");
		expect(resolveCreateWatchVenue("streaming")).toBe("streaming");
	});
});

describe("resolvePatchWatchVenue", () => {
	test("omitted venue keeps the existing value", () => {
		expect(resolvePatchWatchVenue(undefined, "theaters")).toBe("theaters");
		expect(resolvePatchWatchVenue(undefined, null)).toBeNull();
	});

	test("explicit null clears the venue", () => {
		expect(resolvePatchWatchVenue(null, "streaming")).toBeNull();
	});

	test("explicit venue replaces the existing value", () => {
		expect(resolvePatchWatchVenue("streaming", null)).toBe("streaming");
	});
});

describe("diaryVenueSliceWhere", () => {
	test("matches the venue or an unset/legacy venue, including NULL", () => {
		const query = new PgDialect().sqlToQuery(
			diaryVenueSliceWhere(log.watchVenue, "theaters"),
		);
		// `NULL NOT IN (...)` is never true, so unset rows must be coalesced first.
		expect(query.sql).toContain("coalesce(");
		expect(query.sql).toContain("not in ('theaters','streaming')");
		expect(query.params).toEqual(["theaters"]);
	});
});
