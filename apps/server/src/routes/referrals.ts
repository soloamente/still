import { db, patronReferral } from "@still/db";
import { env } from "@still/env/server";
import { and, count, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { hit } from "../lib/rate-limit";
import {
	captureReferralForUser,
	ensureReferralCodeForUser,
} from "../lib/referral-capture";
import {
	buildReferralMilestoneProgress,
	countQualifiedReferralsForUser,
} from "../lib/referral-milestones";
import { qualifyReferralForUser } from "../lib/referral-qualify";
import { fetchReferralRefereeStatusForUser } from "../lib/referral-referee-status";
import {
	buildReferralLandingUrl,
	buildReferralSignUpUrl,
} from "../lib/referral-share-url";

function referralShareOrigin(): string {
	try {
		return new URL(env.CORS_ORIGIN).origin;
	} catch {
		return env.CORS_ORIGIN.replace(/\/$/, "");
	}
}

export const referralsRoute = new Elysia({
	prefix: "/api/referrals",
	tags: ["referrals"],
})
	.use(context)
	.get("/me", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");

		const referralCode = await ensureReferralCodeForUser(user.id);
		const qualifiedCount = await countQualifiedReferralsForUser(user.id);

		const [pendingRow] = await db
			.select({ total: count() })
			.from(patronReferral)
			.where(
				and(
					eq(patronReferral.referrerUserId, user.id),
					eq(patronReferral.status, "pending"),
				),
			);

		const milestones = await buildReferralMilestoneProgress(
			user.id,
			qualifiedCount,
		);

		const origin = referralShareOrigin();
		return {
			referralCode,
			referralUrl: buildReferralLandingUrl(origin, referralCode),
			referralSignUpUrl: buildReferralSignUpUrl(origin, referralCode),
			qualifiedCount,
			pendingCount: Number(pendingRow?.total ?? 0),
			milestones,
		};
	})
	.get("/referee-status", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");

		const refereeStatus = await fetchReferralRefereeStatusForUser(user.id);
		if (!refereeStatus) return status(404, "Profile not found");

		return refereeStatus;
	})
	.post(
		"/capture",
		async ({ user, body, status }) => {
			if (!user) return status(401, "Sign in");
			if (
				!hit(`referral-capture:${user.id}`, {
					limit: 10,
					windowMs: 60_000,
				}).ok
			) {
				return status(429, "Slow down");
			}

			const result = await captureReferralForUser({
				refereeUserId: user.id,
				referralCode: body.referralCode,
			});

			if (!result.captured) {
				return status(400, {
					error: result.reason,
				});
			}

			return {
				ok: true,
				referralId: result.referralId,
				referrerUserId: result.referrerUserId,
			};
		},
		{
			body: t.Object({
				referralCode: t.String({ minLength: 1, maxLength: 64 }),
			}),
		},
	)
	.post("/qualify", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");

		const result = await qualifyReferralForUser(user.id);
		return result;
	});
