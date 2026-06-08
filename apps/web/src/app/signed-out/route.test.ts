import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";

import { GET } from "./route";

describe("GET /signed-out", () => {
	it("redirects to /sign-in", () => {
		const res = GET(new NextRequest("http://localhost/signed-out"));
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toBe("http://localhost/sign-in");
	});

	it("clears both session cookie names", () => {
		const res = GET(new NextRequest("http://localhost/signed-out"));
		const setCookies = res.headers.getSetCookie().join("\n");
		expect(setCookies).toContain("better-auth.session_token=");
		expect(setCookies).toContain("__Secure-better-auth.session_token=");
		// A cleared cookie carries Max-Age=0 (or an expiry in the past).
		expect(/max-age=0|expires=/i.test(setCookies)).toBe(true);
	});
});
