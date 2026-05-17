"use client";

import { cn } from "@still/ui/lib/utils";
import { Palette, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** `/me/*` destinations — left rail on `md+`, horizontal scroll on narrow viewports (Track B.5.9). */
const ACCOUNT_LINKS = [
	{
		href: "/me/settings",
		label: "Settings",
		description: "Profile, privacy, audio",
		icon: Settings,
	},
	{
		href: "/me/customization",
		label: "Customize",
		description: "Banner, accent, sections",
		icon: Palette,
	},
] as const;

export function MeAccountNav() {
	const pathname = usePathname();

	return (
		<>
			{/* Mobile: same affordance as profile section tabs — swipeable row above content. */}
			<nav
				className="-mx-1 border-border border-b md:hidden"
				aria-label="Account sections"
			>
				<div className="overflow-x-auto px-1">
					<ul className="flex min-h-11 gap-0">
						{ACCOUNT_LINKS.map(({ href, label, icon: Icon }) => {
							const active =
								pathname === href || pathname.startsWith(`${href}/`);
							return (
								<li key={href} className="shrink-0">
									<Link
										href={href}
										aria-current={active ? "page" : undefined}
										className={cn(
											"inline-flex min-h-11 items-center gap-2 border-b-2 px-4 font-medium text-sm transition-colors duration-[var(--aker-duration-fast)]",
											active
												? "border-desert-orange text-foreground"
												: "border-transparent text-muted-foreground hover:text-foreground",
										)}
									>
										<Icon className="size-4 opacity-80" aria-hidden />
										{label}
									</Link>
								</li>
							);
						})}
					</ul>
				</div>
			</nav>

			{/* Desktop: Mobbin-style vertical sub-nav in the account shell. */}
			<nav
				className="hidden w-52 shrink-0 md:block"
				aria-label="Account sections"
			>
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Account
				</p>
				<ul className="mt-3 space-y-1 border-border border-r pr-6">
					{ACCOUNT_LINKS.map(({ href, label, description, icon: Icon }) => {
						const active = pathname === href || pathname.startsWith(`${href}/`);
						return (
							<li key={href}>
								<Link
									href={href}
									aria-current={active ? "page" : undefined}
									className={cn(
										"flex gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-[var(--aker-duration-fast)]",
										active
											? "bg-muted/80 text-foreground"
											: "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
									)}
								>
									<Icon
										className="mt-0.5 size-4 shrink-0 opacity-80"
										aria-hidden
									/>
									<span className="min-w-0">
										<span className="block font-medium">{label}</span>
										<span className="mt-0.5 block text-muted-foreground text-xs leading-snug">
											{description}
										</span>
									</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>
		</>
	);
}
