import { db, profile } from "@still/db";
import { and, count, isNotNull, ne, or, sql } from "drizzle-orm";

const PAYING = new Set(["active", "past_due"]);

/** True when Polar subscription status is actively paying (active or past_due). */
export function isPolarPayingSubscriptionStatus(
	status: string | null | undefined,
): boolean {
	if (status == null) return false;
	return PAYING.has(status.trim().toLowerCase());
}

/** Profiles with a real Polar subscription id and paying status — ignores plan_override-only Pro. */
export async function countPolarPayingSubscribers(): Promise<number> {
	const [row] = await db
		.select({ c: count() })
		.from(profile)
		.where(
			and(
				isNotNull(profile.polarSubscriptionId),
				ne(profile.polarSubscriptionId, ""),
				or(
					sql`lower(${profile.subscriptionStatus}) = 'active'`,
					sql`lower(${profile.subscriptionStatus}) = 'past_due'`,
				),
			),
		);
	return Number(row?.c ?? 0);
}
