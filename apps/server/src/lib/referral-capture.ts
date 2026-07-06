import { db, patronReferral, profile, user } from "@still/db";
import { eq } from "drizzle-orm";

import { makeId } from "./cuid";
import {
	normalizeReferralCode,
	randomReferralCodeSuffix,
	referralCodeFromHandle,
} from "./referral-code";

export type ReferralCaptureRejectReason =
	| "invalid_code"
	| "referrer_not_found"
	| "self_user"
	| "self_email"
	| "already_captured";

export type ReferralCaptureResult =
	| { captured: true; referralId: string; referrerUserId: string }
	| { captured: false; reason: ReferralCaptureRejectReason };

/** Pure policy — used in tests and before DB writes. */
export function shouldRejectReferralCapture(input: {
	refereeUserId: string;
	referrerUserId: string;
	refereeEmail: string;
	referrerEmail: string;
}): ReferralCaptureRejectReason | null {
	if (input.refereeUserId === input.referrerUserId) return "self_user";
	if (
		input.refereeEmail.trim().toLowerCase() ===
		input.referrerEmail.trim().toLowerCase()
	) {
		return "self_email";
	}
	return null;
}

/** Ensure a patron has a unique public referral code (handle-based with collision suffix). */
export async function ensureReferralCodeForUser(
	userId: string,
): Promise<string> {
	const [row] = await db
		.select({
			referralCode: profile.referralCode,
			handle: profile.handle,
		})
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	if (!row) {
		throw new Error("PROFILE_NOT_FOUND");
	}

	if (row.referralCode?.trim()) {
		return row.referralCode;
	}

	let candidate = referralCodeFromHandle(row.handle);
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const [collision] = await db
			.select({ userId: profile.userId })
			.from(profile)
			.where(eq(profile.referralCode, candidate))
			.limit(1);
		if (!collision || collision.userId === userId) {
			await db
				.update(profile)
				.set({ referralCode: candidate, updatedAt: new Date() })
				.where(eq(profile.userId, userId));
			return candidate;
		}
		candidate = `${referralCodeFromHandle(row.handle)}-${randomReferralCodeSuffix()}`;
	}

	const fallback = `${referralCodeFromHandle(row.handle)}-${makeId("ref").slice(-8)}`;
	await db
		.update(profile)
		.set({ referralCode: fallback, updatedAt: new Date() })
		.where(eq(profile.userId, userId));
	return fallback;
}

/** Mirror pending referral onto profile when the row exists (profile may be created later). */
export async function syncProfileReferrerFromCapture(
	refereeUserId: string,
): Promise<void> {
	const [referralRow] = await db
		.select({
			referrerUserId: patronReferral.referrerUserId,
			status: patronReferral.status,
		})
		.from(patronReferral)
		.where(eq(patronReferral.refereeUserId, refereeUserId))
		.limit(1);

	if (!referralRow || referralRow.status === "void") return;

	const [profileRow] = await db
		.select({ referredByUserId: profile.referredByUserId })
		.from(profile)
		.where(eq(profile.userId, refereeUserId))
		.limit(1);

	if (!profileRow || profileRow.referredByUserId) return;

	await db
		.update(profile)
		.set({
			referredByUserId: referralRow.referrerUserId,
			updatedAt: new Date(),
		})
		.where(eq(profile.userId, refereeUserId));
}

/**
 * Record a pending referral after sign-up — rejects self-referral and duplicate capture.
 * Profile row may not exist yet; {@link syncProfileReferrerFromCapture} runs on profile create.
 */
export async function captureReferralForUser(input: {
	refereeUserId: string;
	referralCode: string;
}): Promise<ReferralCaptureResult> {
	const normalizedCode = normalizeReferralCode(input.referralCode);
	if (!normalizedCode) {
		return { captured: false, reason: "invalid_code" };
	}

	const [referrerProfile] = await db
		.select({
			userId: profile.userId,
			referralCode: profile.referralCode,
		})
		.from(profile)
		.where(eq(profile.referralCode, normalizedCode))
		.limit(1);

	if (!referrerProfile?.referralCode) {
		return { captured: false, reason: "referrer_not_found" };
	}

	const [existingReferral] = await db
		.select({ id: patronReferral.id, status: patronReferral.status })
		.from(patronReferral)
		.where(eq(patronReferral.refereeUserId, input.refereeUserId))
		.limit(1);

	if (existingReferral) {
		if (existingReferral.status !== "void") {
			await syncProfileReferrerFromCapture(input.refereeUserId);
			return {
				captured: true,
				referralId: existingReferral.id,
				referrerUserId: referrerProfile.userId,
			};
		}
		return { captured: false, reason: "already_captured" };
	}

	const refereeRows = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.id, input.refereeUserId))
		.limit(1);
	const referrerRows = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.id, referrerProfile.userId))
		.limit(1);

	const refereeEmail = refereeRows[0]?.email;
	const referrerEmail = referrerRows[0]?.email;
	if (!refereeEmail || !referrerEmail) {
		return { captured: false, reason: "referrer_not_found" };
	}

	const rejectReason = shouldRejectReferralCapture({
		refereeUserId: input.refereeUserId,
		referrerUserId: referrerProfile.userId,
		refereeEmail,
		referrerEmail,
	});
	if (rejectReason) {
		return { captured: false, reason: rejectReason };
	}

	const referralId = makeId("prf");
	await db.insert(patronReferral).values({
		id: referralId,
		referrerUserId: referrerProfile.userId,
		refereeUserId: input.refereeUserId,
		status: "pending",
	});

	await syncProfileReferrerFromCapture(input.refereeUserId);

	return {
		captured: true,
		referralId,
		referrerUserId: referrerProfile.userId,
	};
}
