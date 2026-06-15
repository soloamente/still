import { describe, expect, it } from "bun:test";
import type { ServerSession } from "@/lib/auth-server";
import type { MeProfile } from "@/lib/fetch-me-profile";
import {
	buildPatronNavUser,
	buildPatronNavUserOrNull,
} from "@/lib/patron-nav-user";

const session = {
	session: { id: "s1", userId: "u1" },
	user: {
		id: "u1",
		name: "Sign up name",
		email: "patron@example.com",
		image: null,
	},
} satisfies ServerSession;

const profile = {
	handle: "cinephile",
	displayName: "Onboarding Name",
	isPro: false,
	preferences: null,
	image: "https://blob.example/avatar.jpg",
} satisfies MeProfile;

describe("buildPatronNavUser", () => {
	it("prefers profile displayName and image over session", () => {
		const user = buildPatronNavUser(session, profile);
		expect(user.name).toBe("Onboarding Name");
		expect(user.image).toBe("https://blob.example/avatar.jpg");
		expect(user.handle).toBe("cinephile");
	});

	it("falls back to session portrait when profile image is missing", () => {
		const user = buildPatronNavUser(session, {
			...profile,
			image: null,
		});
		const withSessionImage = buildPatronNavUser(
			{
				...session,
				user: {
					...session.user,
					image: "https://blob.example/session.jpg",
				},
			},
			{ ...profile, image: null },
		);
		expect(user.image).toBeNull();
		expect(withSessionImage.image).toBe("https://blob.example/session.jpg");
	});

	it("returns null without a profile handle", () => {
		expect(buildPatronNavUserOrNull(session, null)).toBeNull();
		expect(
			buildPatronNavUserOrNull(session, { ...profile, handle: "" }),
		).toBeNull();
	});
});
