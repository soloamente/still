"use client";

import { Button } from "@still/ui/components/button";
import { Label } from "@still/ui/components/label";
import { cn } from "@still/ui/lib/utils";
import { ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { BirthDatePicker } from "@/components/profile/birth-date-picker";
import { RoundAnimatedCheckmark } from "@/components/profile/round-animated-checkmark";
import { patronMeetsAdultAgeGate } from "@/lib/adult-content-age-gate";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;
const FORM_ID = "adult-content-enable-form";

/** Age-verification gate before enabling adult catalogue content in Settings. */
export function AdultContentEnableDialog({
	open,
	onOpenChange,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (birthDateIso: string) => void;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const descriptionId = useId();
	const birthDateFieldId = useId();
	const confirmFieldId = useId();
	const [mounted, setMounted] = useState(false);
	const [birthDate, setBirthDate] = useState("");
	const [confirmed, setConfirmed] = useState(false);

	const ageOk = patronMeetsAdultAgeGate(birthDate);
	const canEnable = ageOk && confirmed;

	const handleClose = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		setBirthDate("");
		setConfirmed(false);
	}, [open]);

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
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") handleClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, handleClose]);

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: PANEL_EASE };

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!canEnable) return;
		onConfirm(birthDate);
		handleClose();
	}

	if (!mounted) return null;

	const portal = (
		<AnimatePresence>
			{open ? (
				<motion.div
					key="adult-content-enable-overlay"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					aria-hidden
					className={APP_MODAL_OVERLAY_CLASS}
					onClick={handleClose}
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
						className={cn(
							"relative flex min-h-[24rem] w-full max-w-md flex-col overflow-visible rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:min-h-[26rem] sm:rounded-[2.25rem]",
						)}
					>
						<div className="absolute top-3 right-3 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={handleClose}
								aria-label="Close"
								className="text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="flex min-h-0 flex-1 flex-col items-center px-7 pt-10 pb-10 text-center sm:px-9 sm:pt-12 sm:pb-12">
							<div
								className="mb-6 flex size-14 items-center justify-center rounded-full bg-background text-foreground sm:mb-8 sm:size-16"
								aria-hidden
							>
								<ShieldCheck
									className="size-7 opacity-90 sm:size-8"
									strokeWidth={1.75}
									aria-hidden
								/>
							</div>

							<h2
								id={titleId}
								className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl"
							>
								Enable adult content
							</h2>
							<p
								id={descriptionId}
								className="mx-auto mt-3 w-full max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base"
							>
								Confirm your age to include 18+ films and anime in search,
								catalogues, and your diary. Your date of birth is saved to
								Profile settings.
							</p>

							<form
								id={FORM_ID}
								onSubmit={handleSubmit}
								className="mt-6 w-full max-w-xs space-y-4 text-left sm:mt-8"
							>
								<div className="space-y-2">
									<Label
										htmlFor={birthDateFieldId}
										className="w-full justify-center text-center text-muted-foreground text-xs"
									>
										Date of birth
									</Label>
									<BirthDatePicker
										id={birthDateFieldId}
										value={birthDate}
										onChange={setBirthDate}
									/>
									{birthDate && !ageOk ? (
										<p className="text-center text-destructive text-xs leading-relaxed">
											You must be at least 18 years old.
										</p>
									) : null}
								</div>

								<label
									htmlFor={confirmFieldId}
									className={cn(
										"flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-2xl bg-background px-4 py-3 text-left text-sm leading-relaxed transition-colors duration-200 ease-out motion-reduce:transition-none",
										"focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-card",
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
									)}
								>
									<input
										id={confirmFieldId}
										type="checkbox"
										checked={confirmed}
										onChange={(event) => setConfirmed(event.target.checked)}
										className="sr-only"
									/>
									<RoundAnimatedCheckmark checked={confirmed} />
									<span className="text-pretty text-foreground">
										I confirm I am at least 18 years old and want to see adult
										content.
									</span>
								</label>
							</form>

							<div className="mt-auto flex w-full flex-col-reverse gap-2 pt-8 sm:flex-row sm:justify-center sm:gap-3 sm:pt-10">
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="ghost"
										size="pill"
										className={cn(
											"h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 font-medium text-muted-foreground sm:w-auto sm:min-w-34",
											DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										)}
										onClick={handleClose}
									>
										Cancel
									</Button>
								</DetailMotionButtonWrap>
								<DetailMotionButtonWrap>
									<Button
										type="submit"
										form={FORM_ID}
										variant="default"
										size="pill"
										disabled={!canEnable}
										className="hover:!bg-foreground hover:!text-background h-auto min-h-11 w-full bg-foreground px-5 py-2.5 text-background text-base sm:w-auto sm:min-w-34 [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
									>
										Enable
									</Button>
								</DetailMotionButtonWrap>
							</div>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return createPortal(portal, document.body);
}
