"use client";

import IconBell from "@still/ui/icons/bell";
import IconCinema from "@still/ui/icons/cinema";
import IconGear from "@still/ui/icons/gear";
import IconPeople from "@still/ui/icons/people";
import IconSlider from "@still/ui/icons/slider";
import IconTicket from "@still/ui/icons/ticket";
import { cn } from "@still/ui/lib/utils";
import { Download, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import {
	isMeAccountNavActive,
	ME_ACCOUNT_NAV_ITEMS,
	type MeAccountNavHref,
} from "@/lib/me-account-nav";

const ME_ACCOUNT_TAB_PILL_LAYOUT_ID = "me-account-tab-pill";

type NavIcon = ComponentType<
	SVGProps<SVGSVGElement> & { size?: string | number }
>;

/** Section icons — Nucleo where we have them; Lucide only for Data (export/import). */
const ME_ACCOUNT_NAV_ICONS: Record<MeAccountNavHref, NavIcon | LucideIcon> = {
	"/me/settings/profile": IconPeople,
	"/me/settings/notifications": IconBell,
	"/me/settings/catalogue": IconCinema,
	"/me/settings/appearance": IconSlider,
	"/me/settings/subscription": IconTicket,
	"/me/settings/data": Download,
	"/me/settings/experience": IconGear,
};

/** Account sidebar — settings sections on `/me/*` (vertical rail + icons). */
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
					const Icon = ME_ACCOUNT_NAV_ICONS[tab.href];
					return (
						<Link
							key={tab.href}
							href={tab.href as MeAccountNavHref}
							scroll={false}
							aria-current={active ? "page" : undefined}
							className={cn(
								"relative inline-flex min-h-10 w-full items-center justify-start gap-2.5 rounded-full px-4 py-2 font-medium text-sm",
								"transition-colors duration-200 ease-out motion-reduce:transition-none [@media(hover:hover)]:transition-colors",
								active
									? "text-foreground"
									: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground",
							)}
						>
							{active ? (
								<motion.span
									layoutId={ME_ACCOUNT_TAB_PILL_LAYOUT_ID}
									className="absolute inset-0 rounded-full bg-card"
									transition={pillTransition}
								/>
							) : null}
							<span className="relative z-10 flex min-w-0 items-center gap-2.5">
								{tab.href === "/me/settings/data" ? (
									<Download
										aria-hidden
										className="size-4 shrink-0 opacity-90"
										strokeWidth={2}
									/>
								) : (
									<Icon
										aria-hidden
										className="size-4 shrink-0 opacity-90"
										size="16px"
									/>
								)}
								<span className="truncate">{tab.label}</span>
							</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
