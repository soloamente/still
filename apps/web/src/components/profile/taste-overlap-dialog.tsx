"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Loader2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { ModalSheetScrollScrims } from "@/components/ui/modal-sheet-scroll-scrims";
import { api } from "@/lib/api";
import {
	APP_MODAL_OVERLAY_CLASS,
	MODAL_SHEET_SCROLL_CLASS,
} from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatLogRatingDisplay } from "@/lib/log-rating";
import { compareSharePath } from "@/lib/og/og-image-metadata";
import {
	parseTasteOverlapResponse,
	type TasteOverlapResponse,
} from "@/lib/sense-taste-overlap";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const SHEET_EASE = [0.165, 0.84, 0.44, 1] as const;

export type TasteOverlapDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Profile handle being compared against the signed-in viewer. */
	targetHandle: string;
};

/**
 * Taste challenge / overlap sheet — mirrors create-list / edit-list modal chrome:
 * motion sheet, centered title, scroll scrims, and floating footer actions.
 */
export function TasteOverlapDialog({
	open,
	onOpenChange,
	targetHandle,
}: TasteOverlapDialogProps) {
	const reduceMotion = useReducedMotion();
	const [mounted, setMounted] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<TasteOverlapResponse | null>(null);
	const [challengeBusy, setChallengeBusy] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	const scrollFadeKey = data
		? `${data.overlap.sharedWatches}|${data.overlap.divergences.length}`
		: (error ?? (loading ? "loading" : ""));
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		scrollFadeKey,
	);

	const handleClose = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	useEffect(() => {
		setMounted(true);
	}, []);

	const loadOverlap = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await api.api.taste
				.overlap({ handle: targetHandle.toLowerCase() })
				.get();
			const parsed = parseTasteOverlapResponse(res.data);
			if (!parsed) {
				setError("Could not read comparison data");
				setData(null);
				return;
			}
			setData(parsed);
		} catch (err) {
			console.error(err);
			setError("Sign in and try again, or check that this diary is visible.");
			setData(null);
		} finally {
			setLoading(false);
		}
	}, [targetHandle]);

	useEffect(() => {
		if (!open) return;
		void loadOverlap();
	}, [open, loadOverlap]);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") handleClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, handleClose]);

	async function handleChallenge() {
		setChallengeBusy(true);
		try {
			await api.api.taste
				.challenge({ handle: targetHandle.toLowerCase() })
				.post();
			toast.success("Taste challenge sent");
		} catch (err) {
			console.error(err);
			toast.error("Could not send challenge");
		} finally {
			setChallengeBusy(false);
		}
	}

	async function handleShareCompareCard() {
		if (!data) return;
		const viewer = data.viewer.handle;
		const target = data.target.handle;
		const url = `${window.location.origin}${compareSharePath(viewer, target)}`;
		try {
			await navigator.clipboard.writeText(url);
			toast.success("Comparison card link copied");
		} catch {
			toast.error("Could not copy link");
		}
	}

	const dialogLayoutTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.32, ease: SHEET_EASE };

	if (!mounted) return null;

	const overlap = data?.overlap;
	const subtitle = data
		? `You and ${data.target.displayName} (@${data.target.handle})`
		: `@${targetHandle}`;

	const portal = (
		<AnimatePresence>
			{open ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.18 }}
					className={APP_MODAL_OVERLAY_CLASS}
					onClick={handleClose}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby="taste-overlap-title"
						layout
						layoutRoot
						initial={{ y: 32, opacity: 0, scale: 0.98 }}
						animate={{ y: 0, opacity: 1, scale: 1 }}
						exit={{ y: 16, opacity: 0, scale: 0.98 }}
						transition={{
							duration: 0.18,
							ease: SHEET_EASE,
							layout: dialogLayoutTransition,
						}}
						onClick={(event) => event.stopPropagation()}
						className="relative flex max-h-[min(92svh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-card px-6 pt-6 pb-0 shadow-2xl md:rounded-[2rem] md:px-8 md:pt-10"
					>
						<div className="mb-4 flex justify-end">
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

						<div className="relative min-h-0 flex-1">
							<div ref={scrollRef} className={MODAL_SHEET_SCROLL_CLASS}>
								<h2
									id="taste-overlap-title"
									className="mb-2 text-balance text-center font-semibold text-foreground text-xl sm:text-2xl"
								>
									Compare taste
								</h2>
								<p className="mb-6 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
									{subtitle}
								</p>

								{loading ? (
									<div className="flex justify-center py-16 text-muted-foreground">
										<Loader2 className="size-8 animate-spin" aria-hidden />
										<span className="sr-only">Loading comparison</span>
									</div>
								) : null}

								{error && !loading ? (
									<p className="py-8 text-center text-muted-foreground text-sm">
										{error}
									</p>
								) : null}

								{overlap && !loading ? (
									<div className="flex flex-col gap-6 pb-2">
										<div className="mx-auto w-full max-w-sm text-center">
											<p className="font-semibold text-5xl tabular-nums tracking-tight sm:text-6xl">
												<span className="sr-only">
													{overlap.compatibilityPercent} percent taste overlap
												</span>
												<span aria-hidden>{overlap.compatibilityPercent}%</span>
											</p>
											<p className="mt-3 text-balance font-editorial text-foreground text-sm leading-relaxed sm:text-base">
												{overlap.framingHeadline}
											</p>
											<p className="mt-1.5 text-muted-foreground text-xs">
												{overlap.framingSubline}
											</p>
										</div>

										<dl className="grid grid-cols-3 gap-2 text-center text-sm">
											<div className="rounded-2xl bg-background px-2 py-3">
												<dt className="text-muted-foreground text-xs">
													Shared
												</dt>
												<dd className="mt-1 font-semibold tabular-nums">
													{overlap.sharedWatches}
												</dd>
											</div>
											<div className="rounded-2xl bg-background px-2 py-3">
												<dt className="text-muted-foreground text-xs">
													Only you
												</dt>
												<dd className="mt-1 font-semibold tabular-nums">
													{overlap.viewerOnlyWatches}
												</dd>
											</div>
											<div className="rounded-2xl bg-background px-2 py-3">
												<dt className="text-muted-foreground text-xs">
													Only them
												</dt>
												<dd className="mt-1 font-semibold tabular-nums">
													{overlap.targetOnlyWatches}
												</dd>
											</div>
										</dl>

										{overlap.divergences.length > 0 ? (
											<div>
												<h3 className="mb-3 text-center font-semibold text-foreground text-sm">
													Biggest rating gaps
												</h3>
												<ul className="flex flex-col gap-2">
													{overlap.divergences.map((row) => {
														const href =
															row.mediaKind === "movie" && row.movieId != null
																? `/movies/${row.movieId}`
																: row.mediaKind === "tv" && row.tvId != null
																	? `/tv/${row.tvId}`
																	: null;
														const poster = tmdbPosterUrlFromPath(
															row.posterPath,
															"w185",
														);
														const inner = (
															<>
																{poster ? (
																	<Image
																		src={poster}
																		alt=""
																		width={40}
																		height={60}
																		className="aspect-2/3 w-10 shrink-0 rounded-md object-cover"
																	/>
																) : (
																	<div
																		className="aspect-2/3 w-10 shrink-0 rounded-md bg-card"
																		aria-hidden
																	/>
																)}
																<div className="min-w-0 flex-1 text-left">
																	<p className="truncate font-medium text-foreground text-sm">
																		{row.title}
																	</p>
																	<p className="mt-0.5 text-muted-foreground text-xs">
																		You{" "}
																		{formatLogRatingDisplay(row.viewerRating)} ·
																		Them{" "}
																		{formatLogRatingDisplay(row.targetRating)}
																	</p>
																</div>
																<span className="shrink-0 font-medium text-muted-foreground text-xs tabular-nums">
																	Δ {formatLogRatingDisplay(row.delta)}
																</span>
															</>
														);
														const rowClass = cn(
															"flex items-center gap-3 rounded-2xl bg-background px-3 py-2.5",
															href && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
														);
														return (
															<li key={row.key}>
																{href ? (
																	<Link href={href} className={rowClass}>
																		{inner}
																	</Link>
																) : (
																	<div className={rowClass}>{inner}</div>
																)}
															</li>
														);
													})}
												</ul>
											</div>
										) : null}
									</div>
								) : null}
							</div>
							<ModalSheetScrollScrims
								showHeaderFade={showHeaderFade}
								showFooterFade={showFooterFade}
							/>
						</div>

						{data && !loading ? (
							<footer className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 md:inset-x-4 md:bottom-4">
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="ghost"
										size="pill"
										className={cn(
											"h-auto min-h-10 min-w-[5.5rem] border-transparent bg-background py-2.5 text-muted-foreground",
											DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										)}
										onClick={() => void handleShareCompareCard()}
									>
										Share comparison
									</Button>
								</DetailMotionButtonWrap>
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="default"
										size="pill"
										className="hover:!bg-foreground hover:!text-background h-auto min-h-10 min-w-[8.5rem] bg-foreground px-5 py-2.5 text-background text-base [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
										disabled={challengeBusy}
										onClick={() => void handleChallenge()}
									>
										{challengeBusy ? (
											<Loader2 className="size-3.5 animate-spin" aria-hidden />
										) : null}
										Send challenge
									</Button>
								</DetailMotionButtonWrap>
							</footer>
						) : null}
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return createPortal(portal, document.body);
}
