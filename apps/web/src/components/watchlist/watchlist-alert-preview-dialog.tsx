"use client";

import { Button } from "@still/ui/components/button";
import IconBellFilled from "@still/ui/icons/bell-filled";
import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { MoviePoster } from "@/components/movie/movie-poster";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { trackSenseProductEvent } from "@/lib/sense-product-analytics";
import type { WatchlistAlertPreview } from "@/lib/still-api-fetch";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import { watchlistAlertPreviewBodyCopy } from "@/lib/watchlist-streaming-display";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

/**
 * Free-patron upsell after **Alert me when it streams** hits the plan gate —
 * nothing is saved; shows how many watchlist titles would be covered.
 * Open while `preview` is non-null.
 */
export function WatchlistAlertPreviewDialog({
	preview,
	onClose,
}: {
	preview: WatchlistAlertPreview | null;
	onClose: () => void;
}) {
	const open = preview !== null;
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const descriptionId = useId();
	const [mounted, setMounted] = useState(false);
	/** One `upgrade.prompt_viewed` per open — reset when the dialog closes. */
	const trackedOpenRef = useRef(false);
	/** Button's ref is typed for `<button>`; the primary action renders a `<Link>`, so focus via the panel. */
	const panelRef = useRef<HTMLDivElement>(null);
	const returnFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) {
			trackedOpenRef.current = false;
			return;
		}
		if (trackedOpenRef.current) return;
		trackedOpenRef.current = true;
		trackSenseProductEvent("upgrade.prompt_viewed", {
			trigger: "watchlist_alerts",
		});
	}, [open]);

	// Move focus into the dialog on open; hand it back to the prior element on close.
	useEffect(() => {
		if (!open) return;
		returnFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		const frame = requestAnimationFrame(() => {
			panelRef.current
				?.querySelector<HTMLElement>("[data-initial-focus]")
				?.focus();
		});
		return () => {
			cancelAnimationFrame(frame);
			const target = returnFocusRef.current;
			if (target?.isConnected) target.focus();
			returnFocusRef.current = null;
		};
	}, [open]);

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
			if (event.key === "Escape") onClose();
		},
		[onClose],
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
		: { duration: 0.2, ease: PANEL_EASE };

	if (!mounted) return null;

	// AnimatePresence keeps the last rendered panel painted through its exit animation.
	const portal = (
		<AnimatePresence>
			{preview ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					className={cn(APP_MODAL_OVERLAY_CLASS, "px-4 py-8")}
					onClick={onClose}
				>
					<motion.div
						ref={panelRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={descriptionId}
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.98 }}
						transition={panelTransition}
						onClick={(event) => event.stopPropagation()}
						className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-card text-foreground sm:rounded-[2.25rem]"
					>
						<div className="absolute top-3 right-3 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={onClose}
								aria-label="Close"
								className={cn(
									"rounded-full bg-background text-muted-foreground",
									DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
								)}
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="flex flex-col items-center px-7 pt-10 pb-10 text-center sm:px-9 sm:pt-12 sm:pb-12">
							<div
								className="mb-6 flex size-14 items-center justify-center rounded-full bg-background text-foreground sm:size-16"
								aria-hidden
							>
								<IconBellFilled className="size-7 opacity-90" aria-hidden />
							</div>

							<h2
								id={titleId}
								className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl"
							>
								Get told the day it streams
							</h2>
							<p
								id={descriptionId}
								className="mx-auto mt-3 w-full max-w-prose text-balance text-muted-foreground text-sm leading-snug sm:text-base"
							>
								{watchlistAlertPreviewBodyCopy(preview.notStreamingCount)}
							</p>

							{preview.sample.length > 0 ? (
								<ul className="mt-6 flex justify-center gap-3">
									{preview.sample.slice(0, 3).map((item) => (
										<li key={`${item.listingKind}-${item.tmdbId}`}>
											{/* Fixed 2∶3 frame — missing art falls back to the no-poster placeholder. */}
											<MoviePoster
												linkable={false}
												listingKind={item.listingKind}
												movieId={item.tmdbId}
												title={item.title}
												posterUrl={tmdbPosterUrlFromPath(
													item.posterPath,
													"w185",
												)}
												className="w-20"
												frameClassName="aspect-2/3 w-20 rounded-xl border-0"
											/>
										</li>
									))}
								</ul>
							) : null}

							<div className="mt-8 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="ghost"
										size="pill"
										className={cn(
											"h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 font-medium text-muted-foreground sm:w-auto sm:min-w-34",
											DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										)}
										onClick={onClose}
									>
										Not now
									</Button>
								</DetailMotionButtonWrap>
								<DetailMotionButtonWrap>
									<Button
										data-initial-focus=""
										render={<Link href="/pricing" />}
										nativeButton={false}
										variant="default"
										size="pill"
										className="hover:!bg-foreground hover:!text-background h-auto min-h-11 w-full bg-foreground px-5 py-2.5 font-semibold text-background text-base sm:w-auto sm:min-w-34"
										onClick={onClose}
									>
										See Attuned
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
