"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Gift, Loader2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

/** Confirm before Devoted checkout — supporter tier with perks still rolling out. */
export function PricingDevotedConfirmDialog({
	open,
	confirming = false,
	confirmLabel = "I wanna be Devoted",
	onCancel,
	onConfirm,
}: {
	open: boolean;
	confirming?: boolean;
	confirmLabel?: string;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const descriptionId = useId();
	const [mounted, setMounted] = useState(false);

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

	const handleKey = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Escape" && !confirming) onCancel();
		},
		[confirming, onCancel],
	);

	useEffect(() => {
		if (!open) return;
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [open, handleKey]);

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: PANEL_EASE };

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence>
			{open ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					aria-hidden
					className={cn(
						APP_MODAL_OVERLAY_CLASS,
						"place-items-center px-4 py-8",
					)}
					onClick={confirming ? undefined : onCancel}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={descriptionId}
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.98 }}
						transition={panelTransition}
						onClick={(event) => event.stopPropagation()}
						className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:rounded-[2.25rem]"
					>
						<div className="absolute top-3 right-3 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={onCancel}
								disabled={confirming}
								aria-label="Cancel Devoted checkout"
								className="text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="flex flex-col items-center px-7 pt-10 pb-10 text-center sm:px-9 sm:pt-12 sm:pb-12">
							<div
								className="mb-6 flex size-14 items-center justify-center rounded-full bg-background text-foreground sm:mb-8 sm:size-16"
								aria-hidden
							>
								<Gift
									className="size-7 opacity-90 sm:size-8"
									strokeWidth={1.75}
								/>
							</div>

							<h2
								id={titleId}
								className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl"
							>
								Wanna be Devoted?
							</h2>
							<p
								id={descriptionId}
								className="mx-auto mt-3 w-full max-w-prose text-balance text-muted-foreground text-sm leading-relaxed sm:text-base"
							>
								Devoted is Sense at its deepest — every Immersed perk, plus
								early access, patron recognition, and a stake in what we ship
								next. Some benefits on the card are still on the way.
							</p>

							<div className="mt-8 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="ghost"
										size="pill"
										disabled={confirming}
										className={cn(
											"h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 font-medium sm:w-auto sm:min-w-34",
											DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										)}
										onClick={onCancel}
									>
										Maybe later
									</Button>
								</DetailMotionButtonWrap>
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="default"
										size="pill"
										disabled={confirming}
										className="h-auto min-h-11 w-full bg-foreground px-5 py-2.5 text-background sm:w-auto sm:min-w-34 [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
										onClick={onConfirm}
									>
										{confirming ? (
											<Loader2 className="size-3.5 animate-spin" aria-hidden />
										) : null}
										{confirmLabel}
									</Button>
								</DetailMotionButtonWrap>
							</div>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}
