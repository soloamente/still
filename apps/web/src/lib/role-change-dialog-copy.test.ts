import { describe, expect, it } from "bun:test";
import { APP_NAME } from "@/lib/app-brand";
import { roleChangeDialogCopy } from "./role-change-dialog-copy";

describe("roleChangeDialogCopy", () => {
	it("celebrates a promotion and offers the staff panel", () => {
		const c = roleChangeDialogCopy("promoted", "moderator");
		expect(c.title).toBe("It's official!");
		expect(c.headline).toBe("You're now a Moderator");
		expect(c.subtext).toBe(`You've got new staff permissions on ${APP_NAME}.`);
		expect(c.pillLabel).toBe("Moderator");
		expect(c.showStaffPanelCta).toBe(true);
	});

	it("uses the right article for admin and owner", () => {
		expect(roleChangeDialogCopy("promoted", "admin").headline).toBe(
			"You're now an Admin",
		);
		expect(roleChangeDialogCopy("promoted", "owner").headline).toBe(
			"You're now the Owner",
		);
	});

	it("informs on a demotion to a lower staff role (no staff CTA)", () => {
		const c = roleChangeDialogCopy("demoted", "support");
		expect(c.title).toBe("Your role has changed");
		expect(c.headline).toBe("You're now a Support");
		expect(c.subtext).toBe("Some staff tools are no longer available to you.");
		expect(c.pillLabel).toBe("Support");
		expect(c.showStaffPanelCta).toBe(false);
	});

	it("informs on a demotion to a regular member", () => {
		const c = roleChangeDialogCopy("demoted", "user");
		expect(c.title).toBe("Your role has changed");
		expect(c.headline).toBe("You no longer have staff access.");
		expect(c.subtext).toBe("");
		expect(c.pillLabel).toBe("Member");
		expect(c.showStaffPanelCta).toBe(false);
	});
});
