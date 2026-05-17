import type { ReactNode } from "react";

import { MeAccountNav } from "@/components/profile/me-account-nav";

/**
 * Track B.5.9 — shared **account** chrome for `/me/settings` and `/me/customization`:
 * sub-navigation (vertical on `md+`, horizontal strip on small screens) so users
 * can jump between identity vs presentation without relying on profile CTAs alone.
 */
export default function MeLayout({ children }: { children: ReactNode }) {
	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:flex-row md:items-start md:gap-10 lg:max-w-6xl">
			<MeAccountNav />
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}
