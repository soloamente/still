"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
	{ href: "/me/settings", label: "Settings" },
	{ href: "/me/customization", label: "Customize" },
] as const;

/** Settings / Customize — horizontal on mobile, vertical rail on `lg`. */
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
					"inline-flex gap-1 rounded-full bg-background p-1",
					"max-lg:justify-start",
					"lg:flex lg:w-full lg:flex-col lg:rounded-4xl lg:p-1.5",
				)}
			>
				{tabs.map((tab) => {
					const active =
						pathname === tab.href || pathname.startsWith(`${tab.href}/`);
					return (
						<Link
							key={tab.href}
							href={tab.href}
							scroll={false}
							className={cn(
								"relative inline-flex min-h-10 items-center justify-center rounded-full font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
								"px-4 py-2 lg:w-full lg:justify-start lg:px-4",
								active
									? "text-foreground"
									: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground",
							)}
						>
							{active ? (
								<motion.span
									layoutId="me-account-tab-pill"
									className="absolute inset-0 rounded-full bg-card shadow-sm"
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
