"use client";

import { useEffect } from "react";
import { writeReferralCookie } from "@/lib/referral-cookie";

type ReferralRefCaptureProps = {
	referralCode?: string | null;
};

/** Persists `?ref=` from the URL into a 30-day cookie before account creation. */
export function ReferralRefCapture({ referralCode }: ReferralRefCaptureProps) {
	useEffect(() => {
		if (!referralCode?.trim()) return;
		writeReferralCookie(referralCode);
	}, [referralCode]);

	return null;
}
