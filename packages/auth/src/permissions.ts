import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Atomic permission statements (resource -> actions). We extend better-auth's
 * `defaultStatements` (which already defines the `user`/`session` admin verbs
 * the plugin needs internally) with our own `content` and `audit` resources,
 * and add our extra `user` verbs (set-role / impersonate / list / unban).
 *
 * Note: in better-auth 1.6.9, `defaultStatements` is exported from
 * `better-auth/plugins/admin/access` (not `better-auth/plugins/access`, which
 * only exports `createAccessControl` / `role`). The import path below is
 * adapted accordingly; the resulting `statement` shape matches the spec.
 */
export const statement = {
	...defaultStatements,
	user: ["list", "ban", "unban", "set-role", "impersonate"],
	content: ["hide", "delete", "restore"],
	audit: ["read"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
	user: ["list", "ban", "unban", "set-role", "impersonate"],
	content: ["hide", "delete", "restore"],
	audit: ["read"],
});

export const admin = ac.newRole({
	user: ["list", "ban", "unban"],
	content: ["hide", "delete", "restore"],
	audit: ["read"],
});

export const moderator = ac.newRole({
	user: ["list"],
	content: ["hide", "delete", "restore"],
});

export const support = ac.newRole({
	user: ["list"],
	content: ["hide"],
});

/**
 * The default, non-staff role. It holds no staff permissions, but it MUST be
 * present in the `roles` map so the admin plugin's setRole accepts demoting a
 * staff member back to a normal user.
 *
 * Every resource is granted an empty action list (rather than `newRole({})`):
 * this grants nothing at runtime but keeps the resulting `Role` structurally
 * compatible with the plugin's `roles` map type. An empty `newRole({})` infers
 * its resource key as `never`, which the admin plugin's `roles` option rejects.
 */
export const user = ac.newRole({ user: [], content: [], audit: [] });

/** Map consumed by the better-auth `admin` plugin `roles` option. */
export const roles = { owner, admin, moderator, support, user };

/** Rank order, highest first. Mirrors the spec hierarchy. */
export const STAFF_ROLES = ["owner", "admin", "moderator", "support"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type AppRole = StaffRole | "user";
