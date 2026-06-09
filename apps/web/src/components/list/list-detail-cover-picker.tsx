"use client";

import { Button } from "@still/ui/components/button";
import IconCloneImageDashedFill from "@still/ui/icons/clone-image-dashed-fill";
import { cn } from "@still/ui/lib/utils";
import { Check, Loader2, Upload, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { ModalSheetScrollScrims } from "@/components/ui/modal-sheet-scroll-scrims";
import { api } from "@/lib/api";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { resolveListCoverImageSrc } from "@/lib/list-cover-image";
import { profilePosterUrlFromPath } from "@/lib/profile-filmography-map";
import { uploadListCover } from "@/lib/upload-list-cover";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/**
 * Owner control — pick a list poster or upload a custom image for hero + lobby tile.
 */
type CoverSaving =
	| { kind: "movie"; id: number }
	| { kind: "tv"; id: number }
	| "upload"
	| "clear"
	| null;

export function ListDetailCoverPicker({
	listId,
	films,
	coverMovieId,
	coverTvId,
	coverImageUrl,
	updatedAt,
}: {
	listId: string;
	films: ListDetailFilmRow[];
	coverMovieId: number | null;
	coverTvId: number | null;
	coverImageUrl: string | null;
	/** List `updatedAt` — cache-busts the cover proxy URL after upload. */
	updatedAt: string;
}) {
	const router = useRouter();
	const reduceMotion = useReducedMotion();
	const fileInputId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [saving, setSaving] = useState<CoverSaving>(null);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		`${films.length}-${coverMovieId ?? ""}-${coverTvId ?? ""}`,
	);

	/** Refresh after the dialog unmounts so Next/Image is not torn down mid-commit. */
	const refreshAfterClose = useCallback(() => {
		setOpen(false);
		window.setTimeout(() => router.refresh(), 0);
	}, [router]);

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	const handlePickMovie = useCallback(
		async (nextId: number) => {
			setSaving({ kind: "movie", id: nextId });
			try {
				const res = await api.api.lists({ id: listId }).patch({
					coverMovieId: nextId,
					coverTvId: null,
					coverImageUrl: null,
				});
				if (res.error) {
					toast.error("Couldn't update cover");
					return;
				}
				toast.success("Cover updated");
				refreshAfterClose();
			} catch {
				toast.error("Couldn't update cover");
			} finally {
				setSaving(null);
			}
		},
		[listId, refreshAfterClose],
	);

	const handlePickTv = useCallback(
		async (nextId: number) => {
			setSaving({ kind: "tv", id: nextId });
			try {
				const res = await api.api.lists({ id: listId }).patch({
					coverTvId: nextId,
					coverMovieId: null,
					coverImageUrl: null,
				});
				if (res.error) {
					toast.error("Couldn't update cover");
					return;
				}
				toast.success("Cover updated");
				refreshAfterClose();
			} catch {
				toast.error("Couldn't update cover");
			} finally {
				setSaving(null);
			}
		},
		[listId, refreshAfterClose],
	);

	const handleReset = useCallback(async () => {
		setSaving("clear");
		try {
			const res = await api.api.lists({ id: listId }).patch({
				coverMovieId: null,
				coverTvId: null,
				coverImageUrl: null,
			});
			if (res.error) {
				toast.error("Couldn't reset cover");
				return;
			}
			toast.success("Cover reset to default");
			refreshAfterClose();
		} catch {
			toast.error("Couldn't reset cover");
		} finally {
			setSaving(null);
		}
	}, [listId, refreshAfterClose]);

	const handleFile = useCallback(
		async (file: File | undefined) => {
			if (!file) return;
			if (!file.type.startsWith("image/")) {
				toast.error("Choose an image file");
				return;
			}
			if (file.size > 5_000_000) {
				toast.error("Image must be 5MB or smaller");
				return;
			}
			setSaving("upload");
			try {
				await uploadListCover(listId, file);
				toast.success("Custom cover uploaded");
				refreshAfterClose();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Couldn't upload cover",
				);
			} finally {
				setSaving(null);
				if (fileInputRef.current) fileInputRef.current.value = "";
			}
		},
		[listId, refreshAfterClose],
	);

	const customCoverPreview = resolveListCoverImageSrc(
		listId,
		coverImageUrl,
		updatedAt,
	);
	const hasCustomCover = Boolean(customCoverPreview);
	const hasPinnedMovie = coverMovieId != null && !hasCustomCover;
	const hasPinnedTv = coverTvId != null && !hasCustomCover;
	const canReset = hasCustomCover || hasPinnedMovie || hasPinnedTv;
	const pinnedPosterSrc = hasPinnedMovie
		? profilePosterUrlFromPath(
				films.find((row) => row.movie?.tmdbId === coverMovieId)?.movie
					?.posterPath ?? null,
			)
		: hasPinnedTv
			? profilePosterUrlFromPath(
					films.find((row) => row.tv?.tmdbId === coverTvId)?.tv?.posterPath ??
						null,
				)
			: null;
	const deviceCoverSrc = customCoverPreview ?? pinnedPosterSrc ?? null;
	const isSaving = saving !== null;
	const dialogMotion = reduceMotion
		? { duration: 0 }
		: { duration: 0.2, ease: [0.165, 0.84, 0.44, 1] as const };

	if (!mounted) return null;

	return (
		<>
			<DetailMotionButtonWrap>
				<button
					type="button"
					onClick={() => setOpen(true)}
					className={cn(
						"inline-flex min-h-10 items-center gap-2 rounded-full bg-background px-4 py-2 font-medium text-foreground text-sm",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
				>
					<IconCloneImageDashedFill className="opacity-80" aria-hidden />
					Change cover
				</button>
			</DetailMotionButtonWrap>

			<input
				ref={fileInputRef}
				id={fileInputId}
				type="file"
				accept="image/*"
				className="sr-only"
				onChange={(e) => void handleFile(e.target.files?.[0])}
			/>

			{createPortal(
				<AnimatePresence>
					{open ? (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.18 }}
							className={APP_MODAL_OVERLAY_CLASS}
							onClick={() => setOpen(false)}
						>
							<motion.div
								role="dialog"
								aria-modal="true"
								aria-labelledby="list-cover-picker-title"
								initial={{ y: 28, opacity: 0, scale: 0.98 }}
								animate={{ y: 0, opacity: 1, scale: 1 }}
								exit={{ y: 16, opacity: 0, scale: 0.98 }}
								transition={dialogMotion}
								onClick={(event) => event.stopPropagation()}
								className="relative flex max-h-[min(92svh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-card px-6 pt-6 pb-0 shadow-2xl md:rounded-[2rem] md:px-8 md:pt-10"
							>
								<div className="mb-4 flex justify-end">
									<Button
										type="button"
										variant="ghost"
										size="icon-pill"
										onClick={() => setOpen(false)}
										aria-label="Close"
										className="text-muted-foreground"
									>
										<X className="size-4" aria-hidden />
									</Button>
								</div>

								<div className="relative min-h-0 flex-1">
									<div
										ref={scrollRef}
										className="scrollbar-none max-h-[min(calc(92svh-11rem),640px)] space-y-5 overflow-y-auto overscroll-contain pb-24 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
									>
										<div>
											<h2
												id="list-cover-picker-title"
												className="text-balance text-center font-semibold text-foreground text-xl sm:text-2xl"
											>
												Change cover
											</h2>
											<p className="mt-2 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
												Upload your own image or pick a poster from this list.
											</p>
										</div>
										<div>
											<p className="mb-2 text-center font-medium text-foreground text-sm">
												From your device
											</p>
											<button
												type="button"
												disabled={isSaving}
												onClick={() => fileInputRef.current?.click()}
												className={cn(
													"relative mx-auto flex aspect-2/3 w-28 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border/60 border-dashed bg-muted/20 px-3 py-4 text-center font-medium text-foreground text-sm",
													DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
													deviceCoverSrc && "border-solid",
													hasCustomCover &&
														"ring-2 ring-foreground ring-offset-2 ring-offset-card",
												)}
												aria-pressed={hasCustomCover}
											>
												{deviceCoverSrc ? (
													<>
														{/* biome-ignore lint/performance/noImgElement: current list cover preview */}
														<img
															src={deviceCoverSrc}
															alt=""
															className="absolute inset-0 size-full object-cover"
														/>
														<span className="absolute inset-0 bg-background/45" />
													</>
												) : null}
												<span className="relative z-10 flex flex-col items-center gap-2">
													{saving === "upload" ? (
														<Loader2
															className="size-5 animate-spin"
															aria-hidden
														/>
													) : (
														<Upload className="size-5 opacity-80" aria-hidden />
													)}
													<span>
														{deviceCoverSrc ? "Replace image" : "Upload image"}
													</span>
												</span>
											</button>
										</div>

										{films.length > 0 ? (
											<div>
												<p className="mb-2 text-center font-medium text-foreground text-sm">
													From this list
												</p>
												<div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
													{films.map((row) => {
														const media = row.movie ?? row.tv;
														const movieId = row.movie?.tmdbId ?? null;
														const tvId = row.tv?.tmdbId ?? null;
														const src = profilePosterUrlFromPath(
															media?.posterPath ?? null,
														);
														const selectedMovie =
															movieId != null &&
															hasPinnedMovie &&
															coverMovieId === movieId;
														const selectedTv =
															tvId != null && hasPinnedTv && coverTvId === tvId;
														const selected = selectedMovie || selectedTv;
														const busyMovie =
															movieId != null &&
															saving !== null &&
															saving !== "upload" &&
															saving !== "clear" &&
															saving.kind === "movie" &&
															saving.id === movieId;
														const busyTv =
															tvId != null &&
															saving !== null &&
															saving !== "upload" &&
															saving !== "clear" &&
															saving.kind === "tv" &&
															saving.id === tvId;
														const busy = busyMovie || busyTv;
														const title =
															media?.title ??
															(row.movie ? "Movie" : row.tv ? "Show" : "Title");

														return (
															<button
																key={row.item.id}
																type="button"
																disabled={isSaving}
																onClick={() => {
																	if (movieId != null) {
																		void handlePickMovie(movieId);
																		return;
																	}
																	if (tvId != null) {
																		void handlePickTv(tvId);
																	}
																}}
																className={cn(
																	"relative aspect-2/3 min-h-0 min-w-0 overflow-hidden rounded-2xl bg-muted/30 text-left shadow-sm transition-shadow duration-200",
																	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
																	selected &&
																		"ring-2 ring-foreground ring-offset-2 ring-offset-card",
																	"[@media(hover:hover)]:hover:shadow-md",
																)}
																aria-label={`Use ${title} as cover${selected ? " (current)" : ""}`}
																aria-pressed={selected}
															>
																{src ? (
																	// biome-ignore lint/performance/noImgElement: TMDB poster picker thumb in modal
																	<img
																		src={src}
																		alt=""
																		className="absolute inset-0 size-full object-cover"
																	/>
																) : (
																	<span className="grid size-full place-items-center text-center text-muted-foreground text-xs">
																		No art
																	</span>
																)}
																{busy ? (
																	<span className="absolute inset-0 grid place-items-center bg-background/60">
																		<Loader2
																			className="size-6 animate-spin"
																			aria-hidden
																		/>
																	</span>
																) : selected ? (
																	<span className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full bg-foreground text-background shadow-sm">
																		<Check className="size-4" aria-hidden />
																	</span>
																) : null}
															</button>
														);
													})}
												</div>
											</div>
										) : null}
									</div>
									<ModalSheetScrollScrims
										showHeaderFade={showHeaderFade}
										showFooterFade={showFooterFade}
									/>
								</div>

								<footer className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 md:inset-x-4 md:bottom-4">
									<DetailMotionButtonWrap>
										<Button
											type="button"
											variant="ghost"
											size="pill"
											className={cn(
												"h-auto min-h-10 min-w-26 border-transparent bg-background py-2.5 text-muted-foreground",
												DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
											)}
											disabled={isSaving || !canReset}
											onClick={() => void handleReset()}
										>
											{saving === "clear" ? (
												<Loader2 className="size-4 animate-spin" aria-hidden />
											) : null}
											Reset
										</Button>
									</DetailMotionButtonWrap>
									<DetailMotionButtonWrap>
										<Button
											type="button"
											variant="default"
											size="pill"
											className="h-auto min-h-10 min-w-26 bg-foreground px-5 py-2.5 text-background text-base"
											onClick={() => setOpen(false)}
										>
											Done
										</Button>
									</DetailMotionButtonWrap>
								</footer>
							</motion.div>
						</motion.div>
					) : null}
				</AnimatePresence>,
				document.body,
			)}
		</>
	);
}
