import { describe, expect, test } from "bun:test";

import { authorizeInternal } from "./auth";

const SECRET = "test-internal-secret";

function requestWithAuth(authorization: string | null): Request {
	const headers = new Headers();
	if (authorization !== null) {
		headers.set("Authorization", authorization);
	}
	return new Request("https://discord-presence.test/v1/users/1", { headers });
}

describe("authorizeInternal", () => {
	test("missing Authorization header is unauthorized", () => {
		expect(authorizeInternal(requestWithAuth(null), SECRET)).toBe(false);
	});

	test("wrong Bearer token is unauthorized", () => {
		expect(
			authorizeInternal(requestWithAuth("Bearer wrong-secret"), SECRET),
		).toBe(false);
	});

	test("correct Bearer token is authorized", () => {
		expect(authorizeInternal(requestWithAuth(`Bearer ${SECRET}`), SECRET)).toBe(
			true,
		);
	});
});
