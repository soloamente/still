"use client";

import { Button } from "@still/ui/components/button";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { Loader2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { submitPatronFeedback } from "@/lib/fetch-patron-feedback-client";
import {
	PATRON_FEEDBACK_CATEGORY_OPTIONS,
	type PatronFeedbackCategory,
	patronFeedbackPlaceholder,
} from "@/lib/patron-feedback-client";
import {
	SHEET_FIELD_CLASS,
	SHEET_FIELD_LABEL_CLASS,
	SHEET_PRIMARY_PILL_CLASS,
} from "@/lib/sheet-chrome";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;
const FEEDBACK_BODY_MIN = 10;
const FEEDBACK_BODY_MAX = 2000;
const FORM_ID = "patron-feedback-compose-form";

/** Account-menu dialog for submitting Bug · Idea · Other feedback. */
export function FeedbackComposeDialog({
	open,
	onOpenChange,
	onSubmitted,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmitted?: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const descriptionId = useId();
	const bodyFieldId = useId();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [mounted, setMounted] = useState(false);
	const [category, setCategory] = useState<PatronFeedbackCategory>("bug");
	const [body, setBody] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [thanksVisible, setThanksVisible] = useState(false);

	const trimmedBody = body.trim();
	const canSubmit =
		trimmedBody.length >= FEEDBACK_BODY_MIN &&
		trimmedBody.length <= FEEDBACK_BODY_MAX;

	const pageUrl = (() => {
		const search = searchParams.toString();
		return `${pathname}${search ? `?${search}` : ""}`;
	})();

	const handleClose = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) {
			setThanksVisible(false);
			return;
		}
		setCategory("bug");
		setBody("");
		setThanksVisible(false);
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
			if (event.key === "Escape" && !submitting) handleClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, submitting, handleClose]);

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: PANEL_EASE };

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!canSubmit || submitting) return;
		setSubmitting(true);
		try {
			await submitPatronFeedback({
				category,
				body: trimmedBody,
				pageUrl,
			});
			setThanksVisible(true);
			onSubmitted?.();
			window.setTimeout(() => {
				handleClose();
			}, 900);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Could not send feedback",
			);
		} finally {
			setSubmitting(false);
		}
	}

	if (!mounted) return null;

	const portal = (
		<AnimatePresence>
			{open ? (
				<motion.div
					key="feedback-compose-overlay"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					aria-hidden
					className={APP_MODAL_OVERLAY_CLASS}
					onClick={() => {
						if (!submitting) handleClose();
					}}
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
						className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:rounded-[2.25rem]"
					>
						<div className="absolute top-3 right-3 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className={cn(
									"size-10 rounded-full bg-background text-foreground",
									DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
								)}
								aria-label="Close"
								disabled={submitting}
								onClick={handleClose}
							>
								<X className="size-5" aria-hidden />
							</Button>
						</div>

						<div className="px-6 pt-10 pb-6 sm:px-8">
							<h2
								id={titleId}
								className="text-balance text-center font-semibold text-foreground text-xl"
							>
								Send feedback
							</h2>
							<p
								id={descriptionId}
								className="mt-2 text-pretty text-center text-muted-foreground text-sm leading-relaxed"
							>
								Report a bug, share an idea, or tell us what could be better.
							</p>

							{thanksVisible ? (
								<p className="mt-6 text-center font-medium text-foreground text-sm">
									Thanks — we&apos;ll read this soon.
								</p>
							) : (
								<form
									id={FORM_ID}
									className="mt-6 space-y-5"
									onSubmit={(e) => void handleSubmit(e)}
								>
									<div className="space-y-2">
										<p className={SHEET_FIELD_LABEL_CLASS}>Category</p>
										<SegmentedPillToolbar
											layoutId="feedback-compose-category"
											aria-label="Feedback category"
											value={category}
											onChange={setCategory}
											options={PATRON_FEEDBACK_CATEGORY_OPTIONS}
											disabled={submitting}
											className="mx-auto w-fit max-w-full flex-nowrap"
										/>
									</div>

									<div className="space-y-2">
										<Label
											htmlFor={bodyFieldId}
											className={SHEET_FIELD_LABEL_CLASS}
										>
											Message
										</Label>
										<Textarea
											id={bodyFieldId}
											value={body}
											onChange={(e) => setBody(e.target.value)}
											placeholder={patronFeedbackPlaceholder(category)}
											minLength={FEEDBACK_BODY_MIN}
											maxLength={FEEDBACK_BODY_MAX}
											rows={5}
											spellCheck
											className={cn(
												SHEET_FIELD_CLASS,
												"min-h-[9rem] resize-y py-3 leading-relaxed",
											)}
											disabled={submitting}
											required
										/>
										<p className="text-muted-foreground text-xs">
											From:{" "}
											<span className="font-mono text-[11px]">{pageUrl}</span>
										</p>
										<p className="text-right text-muted-foreground text-xs tabular-nums">
											{trimmedBody.length.toLocaleString()} /{" "}
											{FEEDBACK_BODY_MAX.toLocaleString()}
										</p>
									</div>

									<footer className="flex items-center justify-between gap-3 px-1 pt-1">
										<DetailMotionButtonWrap>
											<Button
												type="button"
												variant="ghost"
												size="pill"
												className={cn(
													"!px-4 h-auto min-h-10 min-w-[5.5rem] border-transparent bg-background py-2.5 text-base text-muted-foreground",
													DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
												)}
												disabled={submitting}
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
												className={cn(
													SHEET_PRIMARY_PILL_CLASS,
													"!px-4 min-w-[5.5rem]",
												)}
												disabled={!canSubmit || submitting}
											>
												{submitting ? (
													<Loader2
														className="size-3.5 animate-spin"
														aria-hidden
													/>
												) : null}
												{submitting ? "Sending…" : "Send"}
											</Button>
										</DetailMotionButtonWrap>
									</footer>
								</form>
							)}
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return createPortal(portal, document.body);
}
