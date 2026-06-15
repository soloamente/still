import { describe, expect, test } from "bun:test";

import { listShareCopiedToastMessage } from "@/lib/list-share-toast";

describe("listShareCopiedToastMessage", () => {
	test("includes list title", () => {
		expect(listShareCopiedToastMessage("Horror canon")).toBe(
			"Copied link · Horror canon",
		);
	});

	test("falls back when title is empty", () => {
		expect(listShareCopiedToastMessage("   ")).toBe("Copied link");
	});
});
