"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useState } from "react";

import { LANDING_GLASS_PILL, LANDING_GLASS_PILL_LINK } from "./landing-glass";
import { LandingMarkPill } from "./landing-mark-pill";

/** La Nube nav labels — Work, Info, Contact. */
const CHAPTERS = [
	{ href: "#work", label: "Work" },
	{ href: "#diary", label: "Info" },
	{ href: "#start", label: "Contact" },
] as const;

export function LandingNav({ className }: { className?: string }) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<div
				className={cn(
					"pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-5 sm:pt-6",
					className,
				)}
			>
				<div className="pointer-events-auto flex items-center gap-2 sm:gap-3">
					<LandingMarkPill />
					<nav
						className={cn(
							LANDING_GLASS_PILL,
							"hidden h-11 items-center gap-0.5 px-2 sm:flex",
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
					<button
						type="button"
						className={cn(
							LANDING_GLASS_PILL,
							"flex h-11 items-center px-4 font-sans text-foreground/90 text-sm sm:hidden",
						)}
						aria-expanded={open}
						aria-controls="landing-mobile-menu"
						onClick={() => setOpen((v) => !v)}
					>
						{open ? "Close" : "Menu"}
					</button>
				</div>
			</div>

			{open ? (
				<div
					id="landing-mobile-menu"
					role="dialog"
					aria-modal="true"
					aria-label="Site menu"
					className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background/96 px-6 backdrop-blur-md sm:hidden"
				>
					{CHAPTERS.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="font-medium font-sans text-2xl tracking-[-0.03em]"
							onClick={() => setOpen(false)}
						>
							{link.label}
						</Link>
					))}
					<Link
						href="/sign-up"
						className="font-medium font-sans text-foreground"
						onClick={() => setOpen(false)}
					>
						Create account
					</Link>
				</div>
			) : null}
		</>
	);
}
