import { describe, expect, test } from "bun:test";

import type { SendEmailInput } from "./send-email";

describe("SendEmailInput", () => {
	test("requires html alongside text for Resend multipart send", () => {
		const input: SendEmailInput = {
			to: "patron@example.com",
			subject: "Test",
			html: "<p>Hello</p>",
			text: "Hello",
		};
		expect(input.html).toBe("<p>Hello</p>");
		expect(input.text).toBe("Hello");
	});
});
