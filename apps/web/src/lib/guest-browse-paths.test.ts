import { describe, expect, test } from "bun:test";

import {
	guestAccountRedirect,
	isAccountRequiredPath,
} from "./guest-browse-paths";

describe("guest account paths", () => {
	test("personal pages need an account", () => {
		for (const path of [
			"/diary",
			"/diary/1",
			"/watchlist",
			"/quotes",
			"/me",
			"/me/settings",
			"/achievements",
			"/notifications",
			"/chat",
		]) {
			expect(isAccountRequiredPath(path)).toBe(true);
		}
	});

	test("browse pages do not", () => {
		for (const path of [
			"/home",
			"/lists",
			"/lists/abc",
			"/movies/550",
			"/profile/ada",
		]) {
			expect(isAccountRequiredPath(path)).toBe(false);
		}
	});

	test("a signed-out personal URL opens the dialog on home", () => {
		expect(guestAccountRedirect("/diary", false)).toBe("/home?account=1");
		expect(guestAccountRedirect("/home", false)).toBeNull();
		expect(guestAccountRedirect("/diary", true)).toBeNull();
	});
});
