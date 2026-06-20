import { redirect } from "next/navigation";

import { StaffPlansShell } from "@/components/staff/staff-plans-shell";
import { authServer } from "@/lib/auth-server";

const STAFF_ROLES = ["owner", "admin", "moderator", "support"];

export default async function StaffPlansPage() {
	const session = await authServer();
	const role = session?.user?.role ?? "user";
	if (!session || !STAFF_ROLES.includes(role)) redirect("/home");

	return <StaffPlansShell />;
}
