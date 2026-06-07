/**
 * One-off bootstrap: promote a user to `owner` by email. There is no UI path to
 * mint the first owner (set-role is owner-only), so run this once manually:
 *
 *   bun run apps/server/src/jobs/set-owner.ts you@example.com
 */
import { db, user } from "@still/db";
import { eq } from "drizzle-orm";

async function main() {
	const email = process.argv[2];
	if (!email) {
		console.error("Usage: bun run set-owner.ts <email>");
		process.exit(1);
	}
	const updated = await db
		.update(user)
		.set({ role: "owner" })
		.where(eq(user.email, email))
		.returning({ id: user.id, email: user.email, role: user.role });
	if (updated.length === 0) {
		console.error(`No user found with email ${email}`);
		process.exit(1);
	}
	console.log("Promoted to owner:", updated[0]);
	process.exit(0);
}

void main();
