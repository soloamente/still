"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useState } from "react";

import { LANDING_GLASS_PILL, LANDING_GLASS_PILL_LINK } from "./landing-glass";
import { LandingMarkPill } from "./landing-mark-pill";
import {
	LANDING_HERO_CTA_PRIMARY_CLASS,
	LANDING_HERO_CTA_SECONDARY_CLASS,
	LANDING_NAV_CTA_PRIMARY_CLASS,
	LANDING_NAV_FLOAT_CLUSTER_CLASS,
	LANDING_NAV_FLOAT_ROOT_CLASS,
} from "./landing-mobbin-hero";

/** In-page anchors — Mobbin-style sparse center nav. */
const CHAPTERS = [
	{ href: "#intro", label: "Product" },
	{ href: "#diary", label: "Features" },
	{ href: "#start", label: "Contact" },
] as const;

export function LandingNav({ className }: { className?: string }) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<header className={cn(LANDING_NAV_FLOAT_ROOT_CLASS, className)}>
				<div className={LANDING_NAV_FLOAT_CLUSTER_CLASS}>
					<LandingMarkPill />

					<nav
						className={cn(
							LANDING_GLASS_PILL,
							"hidden h-11 min-w-0 items-center gap-0.5 px-2 md:flex",
						)}
						aria-label="Site sections"
					>
						{CHAPTERS.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className={cn(
									LANDING_GLASS_PILL_LINK,
									"rounded-full px-4 py-2",
								)}
							>
								{link.label}
							</Link>
						))}
					</nav>

					<div
						className={cn(
							LANDING_GLASS_PILL,
							"hidden h-11 items-center gap-0.5 p-1 pl-3 md:flex",
						)}
					>
						<Link
							href="/sign-in"
							className={cn(
								LANDING_GLASS_PILL_LINK,
								"rounded-full px-3 py-2 text-foreground/80 [@media(hover:hover)]:text-foreground",
							)}
						>
							Sign in
						</Link>
						<Link href="/sign-up" className={LANDING_NAV_CTA_PRIMARY_CLASS}>
							Create account
						</Link>
					</div>

					<button
						type="button"
						className={cn(
							LANDING_GLASS_PILL,
							"flex h-11 items-center px-4 font-sans text-foreground/90 text-sm md:hidden",
						)}
						aria-expanded={open}
						aria-controls="landing-mobile-menu"
						onClick={() => setOpen((value) => !value)}
					>
						{open ? "Close" : "Menu"}
					</button>
				</div>
			</header>

			{open ? (
				<div
					id="landing-mobile-menu"
					role="dialog"
					aria-modal="true"
					aria-label="Site menu"
					className="fixed inset-0 z-50 flex flex-col bg-background/96 px-6 pt-20 pb-10 backdrop-blur-md md:hidden"
				>
					<nav
						className="flex flex-1 flex-col gap-6"
						aria-label="Site sections"
					>
						{CHAPTERS.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="font-sans font-semibold text-2xl text-foreground tracking-[-0.03em]"
								onClick={() => setOpen(false)}
							>
								{link.label}
							</Link>
						))}
					</nav>

					<div className="flex flex-col gap-3 border-border/50 border-t pt-8">
						<Link
							href="/sign-in"
							className={LANDING_HERO_CTA_SECONDARY_CLASS}
							onClick={() => setOpen(false)}
						>
							Sign in
						</Link>
						<Link
							href="/sign-up"
							className={LANDING_HERO_CTA_PRIMARY_CLASS}
							onClick={() => setOpen(false)}
						>
							Create account
						</Link>
					</div>
				</div>
			) : null}
		</>
	);
}
