import { describe, expect, test } from "bun:test";

import { buildDeleteAccountEmail } from "./send-email";

describe("buildDeleteAccountEmail", () => {
	test("includes the verification url and an expiry warning", () => {
		const email = buildDeleteAccountEmail({
			url: "https://sense.example/api/auth/delete-user/callback?token=abc",
		});
		expect(email.subject).toBe("Confirm your Sense account deletion");
		expect(email.text).toContain(
			"https://sense.example/api/auth/delete-user/callback?token=abc",
		);
		expect(email.text).toContain("24 hours");
		expect(email.text.toLowerCase()).toContain("permanently");
	});
});
