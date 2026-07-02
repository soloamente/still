import Link from "next/link";
import { redirect } from "next/navigation";

import { StaffAuditTab } from "@/components/staff/staff-audit-tab";
import { StaffFeedbackPanel } from "@/components/staff/staff-feedback-panel";
import { StaffJournalPanel } from "@/components/staff/staff-journal-panel";
import { StaffQuotesPanel } from "@/components/staff/staff-quotes-panel";
import { StaffUsersTab } from "@/components/staff/staff-users-tab";
import { authServer } from "@/lib/auth-server";

const STAFF_ROLES = ["owner", "admin", "moderator", "support"];

/**
 * Staff panel shell. Server-gated on the session `role` string (the admin
 * plugin includes `role` in the get-session payload). Non-staff users are
 * bounced to `/home`. Audit reading is owner/admin-only, so the audit tab is
 * only mounted for those roles (the server also enforces the `audit:read`
 * permission independently).
 */
export default async function StaffPage() {
	const session = await authServer();
	const role = session?.user?.role ?? "user";
	if (!session || !STAFF_ROLES.includes(role)) redirect("/home");

	const canReadAudit = role === "owner" || role === "admin";

	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-8">
			<h1 className="font-semibold text-2xl">Staff</h1>
			<p className="mb-6 text-muted-foreground text-sm">
				Signed in as {session.user.email} · role: {role}
			</p>
			<div className="mb-6 flex gap-3">
				<Link
					href="/staff/plans"
					className="inline-flex min-h-10 items-center rounded-full bg-background px-4 py-2 font-medium text-foreground text-sm transition-colors duration-200 [@media(hover:hover)]:hover:bg-foreground/10"
				>
					Plans
				</Link>
			</div>
			<StaffUsersTab currentRole={role} />
			<StaffJournalPanel />
			<StaffQuotesPanel />
			<StaffFeedbackPanel currentRole={role} />
			{canReadAudit ? <StaffAuditTab /> : null}
		</div>
	);
}
