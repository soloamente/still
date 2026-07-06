"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { writeReferralCookie } from "@/lib/referral-cookie";

/** Client fallback — mirrors proxy cookie when `?ref=` lands on any route. */
export function ReferralRefUrlListener() {
	const searchParams = useSearchParams();
	const referralCode = searchParams.get("ref");

	useEffect(() => {
		if (!referralCode?.trim()) return;
		writeReferralCookie(referralCode);
	}, [referralCode]);

	return null;
}
