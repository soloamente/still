"use client";

import type { PlanTierId } from "@still/plans";
import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

const footerButtonClass = cn(
	"h-auto min-h-10 shrink-0 rounded-full px-4 py-2 font-medium text-sm",
	DETAIL_MOTION_PRESSABLE_CLASS,
);

const TIER_LABELS: Record<Exclude<PlanTierId, "still">, string> = {
	attuned: "Attuned",
	immersed: "Immersed",
	devoted: "Devoted",
};

function purchaseSuccessBody(
	tierLabel: string | null,
	pendingSync: boolean,
): string {
	if (pendingSync) {
		return "Payment received — your plan may take a moment to update. Your support keeps Sense running and helps fund the mobile app.";
	}
	if (tierLabel) {
		return `You're on ${tierLabel} now. Your support keeps Sense running and helps fund the mobile app.`;
	}
	return "Your support keeps Sense running and helps fund the mobile app.";
}

/** Post-checkout thank-you — opens on /home after Polar success redirect. */
export function PlanPurchaseSuccessDialog({
	open,
	tier,
	pendingSync,
	onDismiss,
}: {
	open: boolean;
	tier: Exclude<PlanTierId, "still"> | null;
	pendingSync: boolean;
	onDismiss: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const descriptionId = useId();
	const [mounted, setMounted] = useState(false);

	const tierLabel = tier ? TIER_LABELS[tier] : null;

	const handleDismiss = useCallback(() => {
		onDismiss();
	}, [onDismiss]);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleDismiss();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, handleDismiss]);

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.25, ease: PANEL_EASE };

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence initial={false}>
			{open ? (
				<motion.div
					key="plan-purchase-success-backdrop"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					aria-hidden
					className={cn(
						APP_MODAL_OVERLAY_CLASS,
						"place-items-center px-4 py-8",
					)}
					onClick={handleDismiss}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={descriptionId}
						initial={{ opacity: 0, scale: 0.96, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 8 }}
						transition={panelTransition}
						onClick={(e) => e.stopPropagation()}
						className={cn(
							"relative w-full max-w-md overflow-hidden rounded-[2rem] bg-card px-6 py-10 text-center text-foreground sm:px-8",
							"is-open",
						)}
					>
						<div className="absolute top-3 right-3 z-10">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={handleDismiss}
								aria-label="Close"
								className="min-h-10 min-w-10 text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<h2
							id={titleId}
							className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl"
						>
							You're in — thank you
						</h2>
						<p
							id={descriptionId}
							className="mt-3 text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base"
						>
							{purchaseSuccessBody(tierLabel, pendingSync)}
						</p>

						<div className="mt-6 flex flex-col gap-2.5">
							<DetailMotionButtonWrap>
								<Button
									render={<Link href="/me/settings/subscription" />}
									nativeButton={false}
									variant="default"
									size="pill"
									className={cn(
										footerButtonClass,
										"w-full bg-foreground font-semibold text-background",
									)}
									onClick={handleDismiss}
								>
									Explore your plan
								</Button>
							</DetailMotionButtonWrap>
							<DetailMotionButtonWrap>
								<Button
									type="button"
									variant="ghost"
									size="pill"
									className={cn(
										footerButtonClass,
										"w-full text-muted-foreground",
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
									)}
									onClick={handleDismiss}
								>
									Back to home
								</Button>
							</DetailMotionButtonWrap>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}
