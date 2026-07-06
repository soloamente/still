"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Check, Gift, Lock, Users, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";
import {
	fetchReferralsMeClient,
	type ReferralsMeMilestone,
	type ReferralsMeResponse,
} from "@/lib/fetch-referrals-me-client";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

/** Grouped rows/tiles on the raised dialog shell — not canvas `background`. */
const INVITE_EARN_INSET_SURFACE_CLASS = "bg-foreground/[0.06]";

const HOW_IT_WORKS_STEPS = [
	"Copy and share your link",
	"Friend signs up, verifies email, and finishes onboarding",
	"You unlock rewards at each milestone",
] as const;

function MilestoneRailTile({ milestone }: { milestone: ReferralsMeMilestone }) {
	const isEarned = milestone.state === "earned";
	const isNext = milestone.state === "next";

	return (
		<div
			className={cn(
				"flex min-w-41 shrink-0 flex-col gap-2.5 rounded-2xl p-4 text-left sm:min-w-44",
				INVITE_EARN_INSET_SURFACE_CLASS,
				// Highlight the next tier with surface depth — no rings or borders.
				isNext && "bg-foreground/10",
				milestone.state === "locked" && "opacity-70",
			)}
		>
			<div
				className={cn(
					"flex size-9 shrink-0 items-center justify-center rounded-full",
					isEarned
						? "bg-card text-foreground"
						: "bg-card/80 text-muted-foreground",
					isNext && "text-foreground",
				)}
				aria-hidden
			>
				{isEarned ? (
					<Check className="size-4" strokeWidth={2.25} />
				) : milestone.state === "locked" ? (
					<Lock className="size-3.5" strokeWidth={2.25} />
				) : (
					<Gift className="size-4" strokeWidth={2.25} />
				)}
			</div>
			<div className="min-w-0">
				<p className="text-pretty font-medium text-foreground text-xs leading-snug">
					{milestone.label}
				</p>
				<p className="mt-1.5 text-pretty text-[11px] text-muted-foreground tabular-nums leading-snug">
					{isEarned
						? "Earned"
						: `${milestone.requiredCount} qualified invite${milestone.requiredCount === 1 ? "" : "s"}`}
				</p>
			</div>
		</div>
	);
}

function InviteEarnDialogBody({
	data,
	onCopy,
	copyCopied,
}: {
	data: ReferralsMeResponse;
	onCopy: () => void;
	copyCopied: boolean;
}) {
	const railRef = useRef<HTMLDivElement>(null);
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		railRef,
		true,
		data.milestones.map((row) => `${row.key}:${row.state}`).join("|"),
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6">
			<div className="space-y-2 text-center">
				<p className="text-pretty text-muted-foreground text-sm leading-relaxed">
					Share your link — friends explore Sense first, then join when they are
					ready. They get 10% off their first Attuned or Immersed plan.
				</p>
				<p className="text-muted-foreground text-xs tabular-nums">
					{data.qualifiedCount} qualified · {data.pendingCount} pending
				</p>
			</div>

			<div className="space-y-2">
				<label htmlFor="invite-earn-referral-url" className="sr-only">
					Your referral link
				</label>
				<div
					className={cn(
						"flex items-stretch gap-2 rounded-2xl p-1.5",
						INVITE_EARN_INSET_SURFACE_CLASS,
					)}
				>
					<input
						id="invite-earn-referral-url"
						readOnly
						value={data.referralUrl}
						className="min-w-0 flex-1 truncate bg-transparent px-3 py-2 text-foreground text-sm outline-none"
						onFocus={(event) => event.currentTarget.select()}
					/>
					<DetailMotionButtonWrap>
						<Button
							type="button"
							variant="secondary"
							className={cn(
								"h-auto shrink-0 rounded-xl px-4 py-2 font-medium text-sm",
								DETAIL_MOTION_PRESSABLE_CLASS,
							)}
							onClick={onCopy}
						>
							{copyCopied ? (
								<span className="inline-flex items-center gap-1.5">
									<Check className="size-4" aria-hidden />
									Copied
								</span>
							) : (
								"Copy link"
							)}
						</Button>
					</DetailMotionButtonWrap>
				</div>
			</div>

			<div className="space-y-3">
				<h3 className="font-medium text-foreground text-sm">
					Milestone rewards
				</h3>
				{/* Horizontal rail stays inside dialog padding so the vertical scrollport does not clip tiles. */}
				<div className="relative min-w-0 py-1.5">
					<div
						aria-hidden
						className={cn(
							"pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-0% from-card to-transparent transition-opacity duration-200 motion-reduce:transition-none",
							showStartFade ? "opacity-100" : "opacity-0",
						)}
					/>
					<div
						aria-hidden
						className={cn(
							"pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l from-0% from-card to-transparent transition-opacity duration-200 motion-reduce:transition-none",
							showEndFade ? "opacity-100" : "opacity-0",
						)}
					/>
					<div
						ref={railRef}
						className={cn(HORIZONTAL_OVERFLOW_RAIL_CLASSNAME, "gap-3 pb-2")}
						data-lenis-prevent-wheel
					>
						{data.milestones.map((milestone) => (
							<MilestoneRailTile key={milestone.key} milestone={milestone} />
						))}
					</div>
				</div>
			</div>

			<div className="space-y-3">
				<h3 className="font-medium text-foreground text-sm">How it works</h3>
				<ol className="space-y-2">
					{HOW_IT_WORKS_STEPS.map((step, index) => (
						<li
							key={step}
							className={cn(
								"flex items-start gap-3 rounded-2xl px-4 py-3 text-left",
								INVITE_EARN_INSET_SURFACE_CLASS,
							)}
						>
							<span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-card font-medium text-foreground text-xs tabular-nums">
								{index + 1}
							</span>
							<span className="text-pretty text-muted-foreground text-sm leading-relaxed">
								{step}
							</span>
						</li>
					))}
				</ol>
			</div>
		</div>
	);
}

/** Mobbin-style Invite & earn modal — referral URL, milestone rail, how-it-works steps. */
export function InviteEarnDialog({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const descriptionId = useId();
	const [mounted, setMounted] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<ReferralsMeResponse | null>(null);
	const [copyCopied, setCopyCopied] = useState(false);

	const loadReferrals = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const next = await fetchReferralsMeClient();
			setData(next);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Could not load referral details";
			setError(message);
			setData(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) {
			setCopyCopied(false);
			return;
		}
		void loadReferrals();
	}, [open, loadReferrals]);

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
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	const handleCopy = useCallback(async () => {
		if (!data?.referralUrl) return;
		try {
			await navigator.clipboard.writeText(data.referralUrl);
			setCopyCopied(true);
			window.setTimeout(() => setCopyCopied(false), 1600);
		} catch {
			setError("Couldn't copy link");
		}
	}, [data?.referralUrl]);

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
					key="invite-earn-backdrop"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					className={cn(
						APP_MODAL_OVERLAY_CLASS,
						"place-items-center px-4 py-8",
					)}
					onClick={onClose}
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
						onClick={(event) => event.stopPropagation()}
						className="relative flex max-h-[min(92svh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-card text-foreground sm:max-w-xl"
					>
						<div className="absolute top-3 right-3 z-20 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={onClose}
								aria-label="Close Invite and earn"
								className={cn(
									"size-10 rounded-full bg-background text-foreground",
									DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
								)}
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pt-12 pb-8 [-ms-overflow-style:none] sm:px-8 sm:pt-14 sm:pb-10 [&::-webkit-scrollbar]:hidden">
							<div className="mb-6 flex flex-col items-center text-center">
								<div
									className={cn(
										"mb-4 flex size-12 items-center justify-center rounded-full text-foreground",
										INVITE_EARN_INSET_SURFACE_CLASS,
									)}
									aria-hidden
								>
									<Users className="size-5" strokeWidth={2.25} />
								</div>
								<h2
									id={titleId}
									className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl"
								>
									Invite friends and earn rewards
								</h2>
							</div>

							<div id={descriptionId}>
								{loading ? (
									<div className="space-y-4" aria-busy="true">
										<div
											className={cn(
												"mx-auto h-4 w-4/5 rounded-full",
												INVITE_EARN_INSET_SURFACE_CLASS,
											)}
										/>
										<div
											className={cn(
												"h-12 rounded-2xl",
												INVITE_EARN_INSET_SURFACE_CLASS,
											)}
										/>
										<div className="flex gap-3 overflow-x-auto pb-2">
											{["a", "b", "c"].map((skeletonId) => (
												<div
													key={skeletonId}
													className={cn(
														"h-32 min-w-41 shrink-0 rounded-2xl sm:min-w-44",
														INVITE_EARN_INSET_SURFACE_CLASS,
													)}
												/>
											))}
										</div>
									</div>
								) : null}

								{error && !loading ? (
									<div
										className={cn(
											"rounded-2xl px-4 py-5 text-center",
											INVITE_EARN_INSET_SURFACE_CLASS,
										)}
									>
										<p className="text-muted-foreground text-sm">{error}</p>
										<Button
											type="button"
											variant="secondary"
											className={cn(
												"mt-4 h-10 rounded-full px-5",
												DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
											)}
											onClick={() => void loadReferrals()}
										>
											Try again
										</Button>
									</div>
								) : null}

								{data && !loading ? (
									<InviteEarnDialogBody
										data={data}
										onCopy={() => void handleCopy()}
										copyCopied={copyCopied}
									/>
								) : null}
							</div>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}
