"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { LANDING_CHAPTERS, LANDING_CTA } from "./landing-copy";
import { LandingMarkPill } from "./landing-mark-pill";
import { LANDING_HERO_CTA_PRIMARY_CLASS } from "./landing-mobbin-hero";

/** Quiet in-page section links — larger type, tighter pad, same 44px hit. */
const LANDING_NAV_SECTION_LINK_CLASS =
	"inline-flex h-11 select-none items-center justify-center rounded-full px-2 font-sans text-base text-muted-foreground transition-colors duration-200 [@media(hover:hover)]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/**
 * Floating island nav — mark · section anchors · primary Sign in.
 */
export function LandingNav({ className }: { className?: string }) {
	return (
		<header
			className={cn(
				"pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:px-6 sm:pt-5",
				className,
			)}
		>
			<nav
				aria-label="Sense"
				className="pointer-events-auto grid w-full max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-full bg-card/80 p-1.5 pl-2 backdrop-blur-lg"
			>
				{/* Mark uses canvas fill so it reads on the raised card shell. */}
				<div className="justify-self-start">
					{/* Content-sized pad — no extra horizontal chrome beyond the wordmark. */}
					<LandingMarkPill className="w-fit min-w-0 bg-background px-4 text-base" />
				</div>

				{/* Center section links — Taste · Diary · Community (Mobbin rhythm). */}
				<ul className="flex items-center justify-center gap-0.5 sm:gap-1">
					{LANDING_CHAPTERS.map((chapter) => (
						<li key={chapter.id}>
							<a
								href={`#${chapter.id}`}
								className={LANDING_NAV_SECTION_LINK_CLASS}
							>
								{chapter.label}
							</a>
						</li>
					))}
				</ul>

				<div className="justify-self-end">
					<Link
						href={LANDING_CTA.secondary.href}
						className={cn(
							LANDING_HERO_CTA_PRIMARY_CLASS,
							"w-fit min-w-0 px-4 text-base",
						)}
					>
						{LANDING_CTA.secondary.label}
					</Link>
				</div>
			</nav>
		</header>
	);
}
