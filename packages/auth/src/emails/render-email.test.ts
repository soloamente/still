import { describe, expect, test } from "bun:test";

import { renderAuthEmail } from "./render-email";
import { VerifyEmail } from "./verify-email";

describe("renderAuthEmail", () => {
	test("verify template includes url and subject", async () => {
		const url = "https://sense.fans/api/auth/verify-email?token=abc";
		const rendered = await renderAuthEmail(
			VerifyEmail({ url }),
			"Confirm your email for Sense",
		);
		expect(rendered.subject).toBe("Confirm your email for Sense");
		expect(rendered.html).toContain(url);
		expect(rendered.text).toContain(url);
		expect(rendered.text).toContain("24 hours");
	});
});
