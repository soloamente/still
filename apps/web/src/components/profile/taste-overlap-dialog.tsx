"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { formatLogRatingDisplay } from "@/lib/log-rating";
import {
	parseTasteOverlapResponse,
	type TasteOverlapResponse,
} from "@/lib/sense-taste-overlap";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

export type TasteOverlapDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Profile handle being compared against the signed-in viewer. */
	targetHandle: string;
};

/**
 * Taste challenge / overlap sheet — shared watches, compatibility %, divergent ratings.
 */
export function TasteOverlapDialog({
	open,
	onOpenChange,
	targetHandle,
}: TasteOverlapDialogProps) {
	const [mounted, setMounted] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<TasteOverlapResponse | null>(null);
	const [challengeBusy, setChallengeBusy] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

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
		const url = `${window.location.origin}/og/compare/${encodeURIComponent(viewer)}/${encodeURIComponent(target)}`;
		try {
			await navigator.clipboard.writeText(url);
			toast.success("Comparison card link copied");
		} catch {
			toast.error("Could not copy link");
		}
	}

	if (!mounted || !open) return null;

	const overlap = data?.overlap;

	return createPortal(
		// biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop dismiss on outside click
		<div
			className={cn(
				APP_MODAL_OVERLAY_CLASS,
				"flex items-end justify-center sm:items-center",
			)}
			role="presentation"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onOpenChange(false);
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="taste-overlap-title"
				className="relative flex max-h-[min(92svh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-card sm:rounded-3xl"
			>
				<div className="flex items-start justify-between gap-3 bg-background/40 px-5 py-4">
					<div>
						<h2
							id="taste-overlap-title"
							className="font-semibold text-foreground text-lg"
						>
							Taste overlap
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							@{targetHandle}
							{data ? ` · you vs ${data.target.displayName}` : null}
						</p>
					</div>
					<button
						type="button"
						className="rounded-full p-2 text-muted-foreground [@media(hover:hover)]:hover:bg-background"
						aria-label="Close"
						onClick={() => onOpenChange(false)}
					>
						<X className="size-5" aria-hidden />
					</button>
				</div>

				<div
					ref={scrollRef}
					className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{loading ? (
						<div className="flex justify-center py-16 text-muted-foreground">
							<Loader2 className="size-8 animate-spin" aria-hidden />
							<span className="sr-only">Loading comparison</span>
						</div>
					) : null}

					{error && !loading ? (
						<p className="text-center text-muted-foreground text-sm">{error}</p>
					) : null}

					{overlap && !loading ? (
						<div className="flex flex-col gap-6">
							<div className="text-center">
								<p className="font-semibold text-5xl tabular-nums tracking-tight">
									<span className="sr-only">
										{overlap.compatibilityPercent} percent taste overlap
									</span>
									<span aria-hidden>{overlap.compatibilityPercent}%</span>
								</p>
								<p className="mt-2 text-balance text-foreground text-sm">
									{overlap.framingHeadline}
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									{overlap.framingSubline}
								</p>
							</div>

							<dl className="grid grid-cols-3 gap-2 text-center text-sm">
								<div className="rounded-2xl bg-background px-2 py-3">
									<dt className="text-muted-foreground text-xs">Shared</dt>
									<dd className="mt-1 font-semibold tabular-nums">
										{overlap.sharedWatches}
									</dd>
								</div>
								<div className="rounded-2xl bg-background px-2 py-3">
									<dt className="text-muted-foreground text-xs">Only you</dt>
									<dd className="mt-1 font-semibold tabular-nums">
										{overlap.viewerOnlyWatches}
									</dd>
								</div>
								<div className="rounded-2xl bg-background px-2 py-3">
									<dt className="text-muted-foreground text-xs">Only them</dt>
									<dd className="mt-1 font-semibold tabular-nums">
										{overlap.targetOnlyWatches}
									</dd>
								</div>
							</dl>

							{overlap.divergences.length > 0 ? (
								<div>
									<h3 className="mb-3 font-semibold text-foreground text-sm">
										Biggest rating gaps
									</h3>
									<ul className="flex flex-col gap-3">
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
															className="aspect-2/3 w-10 shrink-0 rounded-md bg-background"
															aria-hidden
														/>
													)}
													<div className="min-w-0 flex-1">
														<p className="truncate font-medium text-foreground text-sm">
															{row.title}
														</p>
														<p className="mt-0.5 text-muted-foreground text-xs">
															You {formatLogRatingDisplay(row.viewerRating)} ·
															Them {formatLogRatingDisplay(row.targetRating)}
														</p>
													</div>
													<span className="shrink-0 font-medium text-muted-foreground text-xs tabular-nums">
														Δ {formatLogRatingDisplay(row.delta)}
													</span>
												</>
											);
											return (
												<li key={row.key}>
													{href ? (
														<Link
															href={href}
															className="flex items-center gap-3 rounded-2xl bg-background px-3 py-2.5 [@media(hover:hover)]:hover:bg-background/80"
														>
															{inner}
														</Link>
													) : (
														<div className="flex items-center gap-3 rounded-2xl bg-background px-3 py-2.5">
															{inner}
														</div>
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

				{data && !loading ? (
					<div className="flex flex-wrap gap-2 bg-background/40 px-5 py-4">
						<DetailMotionButton
							type="button"
							className="inline-flex flex-1 items-center justify-center rounded-full bg-background px-4 py-3 font-semibold text-foreground text-sm"
							onClick={() => void handleShareCompareCard()}
						>
							Share comparison
						</DetailMotionButton>
						<DetailMotionButton
							type="button"
							disabled={challengeBusy}
							className="inline-flex flex-1 items-center justify-center rounded-full bg-foreground px-4 py-3 font-semibold text-background text-sm disabled:opacity-50"
							onClick={() => void handleChallenge()}
						>
							{challengeBusy ? "Sending…" : "Send challenge"}
						</DetailMotionButton>
					</div>
				) : null}
			</div>
		</div>,
		document.body,
	);
}
