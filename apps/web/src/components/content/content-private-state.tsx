"use client";

import { buttonVariants } from "@still/ui/components/button";
import IconLockFill from "@still/ui/icons/lock-fill";
import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import {
	type ContentPrivateKind,
	contentPrivateCopy,
} from "@/lib/content-private";
import {
	DETAIL_BUTTON_SPRING,
	DETAIL_CHROME_TAP_SCALE,
} from "@/lib/detail-action-motion";

/**
 * Full-height private gate — same raised empty tray as Community / lobby empties,
 * lock mark as the only chrome, one primary escape to Home.
 */
export function ContentPrivateState({
	kind,
	primaryHref = "/home",
	primaryLabel = "Back to Home",
}: {
	kind: ContentPrivateKind;
	primaryHref?: string;
	primaryLabel?: string;
}) {
	const reduceMotion = useReducedMotion();
	const copy = contentPrivateCopy(kind);

	return (
		<motion.div
			className="flex w-full flex-1 flex-col items-center justify-center px-4 py-16"
			role="status"
			aria-live="polite"
			initial={reduceMotion ? false : { opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={
				reduceMotion
					? { duration: 0 }
					: { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
			}
		>
			<div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-background px-6 py-12 text-center sm:px-10 sm:py-14">
				<motion.span
					className="inline-flex size-12 items-center justify-center rounded-full bg-card text-foreground"
					aria-hidden
					initial={reduceMotion ? false : { scale: 0.92, opacity: 0.6 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={
						reduceMotion
							? { duration: 0 }
							: {
									type: "spring" as const,
									...DETAIL_BUTTON_SPRING,
									delay: 0.04,
								}
					}
				>
					<IconLockFill size="20px" className="opacity-90" />
				</motion.span>
				<div className="space-y-2">
					<p className="text-balance font-sans font-semibold text-foreground text-lg tracking-tight">
						{copy.title}
					</p>
					<p className="text-balance text-muted-foreground text-sm leading-relaxed">
						{copy.body}
					</p>
				</div>
				<motion.div
					whileTap={
						reduceMotion ? undefined : { scale: DETAIL_CHROME_TAP_SCALE }
					}
					transition={{ type: "spring", ...DETAIL_BUTTON_SPRING }}
				>
					<Link
						href={primaryHref}
						className={cn(buttonVariants({ variant: "default", size: "pill" }))}
					>
						{primaryLabel}
					</Link>
				</motion.div>
			</div>
		</motion.div>
	);
}
