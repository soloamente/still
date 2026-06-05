"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
	isMeAccountNavActive,
	ME_ACCOUNT_NAV_ITEMS,
	type MeAccountNavHref,
} from "@/lib/me-account-nav";

/** Account sidebar — settings sections + Customize on `/me/*`. */
export function MeAccountNav({ handle: _handle }: { handle: string }) {
	const pathname = usePathname() ?? "";
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 420, damping: 34 };

	return (
		<nav aria-label="Account" className="flex min-w-0 justify-start">
			<div
				className={cn(
					"flex w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-4xl bg-background p-1.5",
				)}
			>
				{ME_ACCOUNT_NAV_ITEMS.map((tab) => {
					const active = isMeAccountNavActive(pathname, tab.href);
					return (
						<Link
							key={tab.href}
							href={tab.href as MeAccountNavHref}
							scroll={false}
							className={cn(
								"relative inline-flex min-h-10 w-full items-center justify-start rounded-full px-4 py-2 font-medium text-sm",
								"transition-colors duration-200 ease-out motion-reduce:transition-none [@media(hover:hover)]:transition-colors",
								active
									? "text-foreground"
									: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground",
							)}
						>
							{active ? (
								<motion.span
									layoutId="me-account-tab-pill"
									className="absolute inset-0 rounded-full bg-card"
									transition={pillTransition}
								/>
							) : null}
							<span className="relative z-10">{tab.label}</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
