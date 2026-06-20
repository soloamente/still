"use client";

import IconShareIn from "@still/ui/icons/share-in";
import { cn } from "@still/ui/lib/utils";
import { useEffect, useState } from "react";

import { DetailMotionLink } from "@/components/movie/detail-motion-pressable";

/** Sticky staff plans chrome — back to `/staff` with the same scroll scrim as detail pages. */
export function StaffPlansPageHeader() {
	const [isScrolled, setIsScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => {
			setIsScrolled(window.scrollY > 2);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const pill = cn(
		"inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ease-out",
		"bg-card text-foreground [@media(hover:hover)]:hover:bg-muted/35",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	);

	return (
		<>
			<header className="sticky top-0 z-40 w-full overflow-visible bg-background">
				<div className="flex w-full items-center justify-between gap-3 px-2.5 py-2 sm:px-3">
					<DetailMotionLink
						href="/staff"
						className={cn(pill, "max-w-full pl-3")}
					>
						<IconShareIn size="20px" className="shrink-0 opacity-90" />
						<span className="truncate">Staff</span>
					</DetailMotionLink>
				</div>
			</header>
			{/* Fixed scrim below the bar; z-20 keeps it under sticky grid headers (z-30). */}
			<div
				aria-hidden
				className={cn(
					"pointer-events-none fixed inset-x-0 top-14 z-20 h-[clamp(7rem,42svh,18rem)]",
					"bg-[linear-gradient(180deg,var(--background)_0%,color-mix(in_oklab,var(--background)_92%,transparent)_14%,color-mix(in_oklab,var(--background)_68%,transparent)_38%,color-mix(in_oklab,var(--background)_32%,transparent)_68%,transparent_100%)]",
					"opacity-0 transition-opacity duration-300 ease-out motion-reduce:transition-none",
					isScrolled && "opacity-100",
				)}
			/>
		</>
	);
}
