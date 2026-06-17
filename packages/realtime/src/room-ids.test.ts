import { describe, expect, test } from "bun:test";
import {
	chatRoomId,
	listingMovieRoomId,
	listingTvRoomId,
	listRoomId,
	parseListingMovieRoomId,
	parseListingTvRoomId,
	reviewRoomId,
	userInboxRoomId,
} from "./room-ids";

describe("room-ids", () => {
	test("listing movie round-trip", () => {
		expect(listingMovieRoomId(550)).toBe("listing:movie:550");
		expect(parseListingMovieRoomId("listing:movie:550")).toBe(550);
	});

	test("listing tv round-trip", () => {
		expect(listingTvRoomId(1396)).toBe("listing:tv:1396");
		expect(parseListingTvRoomId("listing:tv:1396")).toBe(1396);
	});

	test("inbox room", () => {
		expect(userInboxRoomId("usr_1")).toBe("user:usr_1:inbox");
	});

	test("list and review rooms", () => {
		expect(listRoomId("lst_1")).toBe("list:lst_1");
		expect(reviewRoomId("rev_1")).toBe("review:rev_1");
	});

	test("chat room (Wave 2)", () => {
		expect(chatRoomId("thr_1")).toBe("chat:thr_1");
	});

	test("parse returns null for invalid room ids", () => {
		expect(parseListingMovieRoomId("list:lst_1")).toBeNull();
		expect(parseListingTvRoomId("listing:movie:550")).toBeNull();
	});
});
