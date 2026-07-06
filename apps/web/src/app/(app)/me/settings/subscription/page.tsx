import type { Metadata } from "next";
import { Suspense } from "react";

import { MeSubscriptionSettings } from "@/components/profile/me-subscription-settings";

export const metadata: Metadata = {
	title: "Subscription",
	description: "Manage your Sense subscription and billing.",
};

export default function SettingsSubscriptionPage() {
	return (
		<Suspense fallback={null}>
			<MeSubscriptionSettings />
		</Suspense>
	);
}
