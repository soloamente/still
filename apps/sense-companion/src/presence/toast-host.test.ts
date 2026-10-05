import { describe, expect, test } from "bun:test";

import { toastMountParent } from "./toast-host";

describe("toast host", () => {
	test("fullscreen keeps the toast inside the player", () => {
		const page = { name: "page" };
		const player = { name: "player" };
		expect(
			toastMountParent(
				player as unknown as Element,
				page as unknown as Element,
			),
		).toBe(player);
		expect(toastMountParent(null, page as unknown as Element)).toBe(page);
	});
});
