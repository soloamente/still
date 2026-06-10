import { describe, expect, test } from "bun:test";

import { DeleteAccountEmail } from "./delete-account";
import { renderAuthEmail } from "./render-email";
import { ResetPasswordEmail } from "./reset-password";

describe("auth email templates", () => {
	test("reset password includes url and 1 hour copy", async () => {
		const url = "https://sense.fans/reset-password?token=xyz";
		const { html, text } = await renderAuthEmail(
			ResetPasswordEmail({ url }),
			"Reset your Sense password",
		);
		expect(html).toContain(url);
		expect(text).toContain("1 hour");
	});

	test("delete account includes permanently copy", async () => {
		const url = "https://sense.fans/api/auth/delete-user/callback?token=abc";
		const { text } = await renderAuthEmail(
			DeleteAccountEmail({ url }),
			"Confirm your Sense account deletion",
		);
		expect(text).toContain(url);
		expect(text.toLowerCase()).toContain("permanently");
		expect(text).toContain("24 hours");
	});
});
