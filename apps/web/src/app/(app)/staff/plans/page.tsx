import { redirect } from "next/navigation";

import { StaffPlansShell } from "@/components/staff/staff-plans-shell";
import { authServer } from "@/lib/auth-server";

const STAFF_ROLES = ["owner", "admin", "moderator", "support"];

export default async function StaffPlansPage() {
	const session = await authServer();
	const role = session?.user?.role ?? "user";
	if (!session || !STAFF_ROLES.includes(role)) redirect("/home");

	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-8">
			<h1 className="font-semibold text-2xl">Plans</h1>
			<p className="mb-6 text-muted-foreground text-sm">
				Subscription tier feature catalogue. Changes are live immediately.
			</p>
			<StaffPlansShell />
		</div>
	);
}
