"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

/**
 * Mobbin-pattern centered hero: emblem, display headline, stat line, dual CTAs.
 * Still tokens: `font-sans`, desert-orange accent, pill geometry, shadow elevation.
 */
export function LandingHero() {
	const reduceMotion = useReducedMotion();

	return (
		<section className="relative mx-auto flex max-w-mobbin-page flex-col items-center px-6 pt-6 pb-16 text-center sm:pt-8 md:pt-10">
			{/* App emblem — rounded square with soft float (Mobbin hero icon rhythm). */}
			<motion.div
				aria-hidden
				className={cn(
					"relative mb-8 flex size-[4.5rem] items-center justify-center rounded-mobbin-3xl bg-card shadow-mobbin-xl sm:size-20",
				)}
				initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={
					reduceMotion
						? { duration: 0 }
						: { type: "spring", stiffness: 260, damping: 22 }
				}
			>
				<motion.span
					className="size-3 rounded-full bg-desert-orange shadow-[0_0_24px_-4px_rgba(183,89,40,0.65)]"
					animate={
						reduceMotion ? undefined : { y: [0, -3, 0], scale: [1, 1.06, 1] }
					}
					transition={
						reduceMotion
							? undefined
							: {
									duration: 4,
									repeat: Number.POSITIVE_INFINITY,
									ease: "easeInOut",
								}
					}
				/>
				<span className="pointer-events-none absolute inset-0 rounded-mobbin-3xl ring-1 ring-pure-white/10 ring-inset" />
			</motion.div>

			<motion.h1
				className="max-w-[18ch] text-balance font-sans font-semibold text-[clamp(2.25rem,6vw,3.5rem)] text-foreground leading-[1.05] tracking-[-0.03em]"
				initial={reduceMotion ? false : { opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={
					reduceMotion
						? { duration: 0 }
						: { delay: 0.05, type: "spring", stiffness: 200, damping: 24 }
				}
			>
				Your cinematic memory, in one place.
			</motion.h1>

			<motion.p
				className="mt-5 max-w-[42ch] text-base text-muted-foreground leading-relaxed md:text-lg"
				initial={reduceMotion ? false : { opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={
					reduceMotion
						? { duration: 0 }
						: { delay: 0.1, type: "spring", stiffness: 200, damping: 24 }
				}
			>
				Log films and series, follow friends, and build lists — a diary made for
				people who care how they watch.
			</motion.p>

			<motion.div
				className="mt-8 flex flex-wrap items-center justify-center gap-3"
				initial={reduceMotion ? false : { opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={
					reduceMotion
						? { duration: 0 }
						: { delay: 0.14, type: "spring", stiffness: 200, damping: 24 }
				}
			>
				<Link href="/sign-up">
					<Button variant="accent" size="pill-lg" className="min-w-[10.5rem]">
						Create your account
					</Button>
				</Link>
				<Link href="#preview">
					<Button
						variant="outline"
						size="pill-lg"
						className="min-w-[10.5rem] rounded-full border-border/80 bg-background/40 shadow-none [@media(hover:hover)]:hover:bg-background/70"
					>
						See the catalogue
						<ArrowRight className="size-4 opacity-70" aria-hidden />
					</Button>
				</Link>
			</motion.div>

			<p className="mt-6 font-mono text-[11px] text-muted-foreground/90 uppercase tabular-nums tracking-wide">
				Diary · Reviews · Lists · Badges · Chat
			</p>
		</section>
	);
}
