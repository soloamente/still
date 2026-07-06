import { describe, expect, test } from "bun:test";

import {
	buildReferralLandingUrl,
	buildReferralSignUpUrl,
} from "./referral-share-url";

describe("referral share urls", () => {
	test("landing url uses root ref param", () => {
		expect(buildReferralLandingUrl("http://localhost:3001", "patron42")).toBe(
			"http://localhost:3001/?ref=patron42",
		);
	});

	test("sign-up url keeps direct join path", () => {
		expect(buildReferralSignUpUrl("http://localhost:3001/", "patron42")).toBe(
			"http://localhost:3001/sign-up?ref=patron42",
		);
	});
});
