import {
	type AppRole,
	STAFF_ROLES,
	type StaffRole,
} from "@still/auth/permissions";
import { db, user } from "@still/db";
import { inArray } from "drizzle-orm";

/** Batch staff roles for avatar badge hydration — one user query per page. */
export async function fetchStaffRolesForUserIds(
	userIds: readonly string[],
): Promise<Map<string, AppRole>> {
	const unique = [...new Set(userIds.filter(Boolean))];
	const map = new Map<string, AppRole>();
	if (unique.length === 0) return map;

	const rows = await db
		.select({ id: user.id, role: user.role })
		.from(user)
		.where(inArray(user.id, unique));

	for (const row of rows) {
		map.set(row.id, (row.role ?? "user") as AppRole);
	}
	return map;
}

/** Non-staff patrons return null — staff aura takes priority over plan tier in UI. */
export function staffRoleForUserId(
	userId: string,
	roles: ReadonlyMap<string, AppRole>,
): StaffRole | null {
	const role = roles.get(userId) ?? "user";
	if ((STAFF_ROLES as readonly string[]).includes(role)) {
		return role as StaffRole;
	}
	return null;
}

/** Resolve staff role from a raw role string (profile joins, session). */
export function parseStaffRoleFromUserRole(
	role: string | null | undefined,
): StaffRole | null {
	if (!role) return null;
	if ((STAFF_ROLES as readonly string[]).includes(role)) {
		return role as StaffRole;
	}
	return null;
}
