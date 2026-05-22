"use client";

import { cn } from "@still/ui/lib/utils";
import { Check, ImageIcon, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { resolveListCoverImageSrc } from "@/lib/list-cover-image";
import { profilePosterUrlFromPath } from "@/lib/profile-filmography-map";
import { uploadListCover } from "@/lib/upload-list-cover";

/**
 * Owner control — pick a list poster or upload a custom image for hero + lobby tile.
 */
export function ListDetailCoverPicker({
	listId,
	films,
	coverMovieId,
	coverImageUrl,
	updatedAt,
}: {
	listId: string;
	films: ListDetailFilmRow[];
	coverMovieId: number | null;
	coverImageUrl: string | null;
	/** List `updatedAt` — cache-busts the cover proxy URL after upload. */
	updatedAt: string;
}) {
	const router = useRouter();
	const fileInputId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [portalReady, setPortalReady] = useState(false);
	const [savingId, setSavingId] = useState<number | "clear" | "upload" | null>(
		null,
	);

	/** Refresh after the dialog unmounts so Next/Image is not torn down mid-commit. */
	const refreshAfterClose = useCallback(() => {
		setOpen(false);
		window.setTimeout(() => router.refresh(), 0);
	}, [router]);

	useEffect(() => {
		setPortalReady(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	const handlePick = useCallback(
		async (nextId: number | null) => {
			setSavingId(nextId ?? "clear");
			try {
				const res = await api.api.lists({ id: listId }).patch({
					coverMovieId: nextId,
					coverImageUrl: null,
				});
				if (res.error) {
					toast.error("Couldn't update cover");
					return;
				}
				toast.success(nextId ? "Cover updated" : "Cover reset to default");
				refreshAfterClose();
			} catch {
				toast.error("Couldn't update cover");
			} finally {
				setSavingId(null);
			}
		},
		[listId, refreshAfterClose],
	);

	const handleReset = useCallback(async () => {
		setSavingId("clear");
		try {
			const res = await api.api.lists({ id: listId }).patch({
				coverMovieId: null,
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
			setSavingId(null);
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
			setSavingId("upload");
			try {
				await uploadListCover(listId, file);
				toast.success("Custom cover uploaded");
				refreshAfterClose();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Couldn't upload cover",
				);
			} finally {
				setSavingId(null);
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
	const hasPinnedPoster = coverMovieId != null && !hasCustomCover;
	const canReset = hasCustomCover || hasPinnedPoster;

	return (
		<>
			<DetailMotionButtonWrap className="mt-4">
				<button
					type="button"
					onClick={() => setOpen(true)}
					className={cn(
						"inline-flex min-h-10 items-center gap-2 rounded-full bg-background px-4 py-2 font-medium text-foreground text-sm shadow-sm",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
				>
					<ImageIcon className="size-4 opacity-80" aria-hidden />
					Choose cover
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

			{open && portalReady
				? createPortal(
						// biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss only; dialog holds focusable controls.
						<div
							className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-3 backdrop-blur-sm sm:items-center sm:p-6"
							role="presentation"
							onClick={() => setOpen(false)}
						>
							<div
								role="dialog"
								aria-labelledby="list-cover-picker-title"
								className="max-h-[min(85svh,40rem)] w-full max-w-lg overflow-hidden rounded-[2rem] bg-card shadow-xl"
								onClick={(e) => e.stopPropagation()}
								onKeyDown={(e) => e.stopPropagation()}
							>
								<div className="border-border/40 border-b px-5 py-4">
									<h2
										id="list-cover-picker-title"
										className="font-sans font-semibold text-foreground text-lg tracking-tight"
									>
										Choose cover
									</h2>
									<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
										Upload your own image or pick a poster from this list.
									</p>
								</div>
								<div className="max-h-[min(60svh,28rem)] space-y-5 overflow-y-auto px-4 py-4">
									<div>
										<p className="mb-2 font-medium text-foreground text-sm">
											From your device
										</p>
										<button
											type="button"
											disabled={savingId !== null}
											onClick={() => fileInputRef.current?.click()}
											className={cn(
												"flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 border-dashed bg-muted/20 px-4 py-6 font-medium text-foreground text-sm",
												DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
												hasCustomCover &&
													"ring-2 ring-foreground ring-offset-2 ring-offset-card",
											)}
											aria-pressed={hasCustomCover}
										>
											{savingId === "upload" ? (
												<Loader2 className="size-5 animate-spin" aria-hidden />
											) : (
												<Upload className="size-5 opacity-80" aria-hidden />
											)}
											{hasCustomCover ? "Replace custom image" : "Upload image"}
										</button>
										{hasCustomCover && customCoverPreview ? (
											<div className="relative mx-auto mt-3 aspect-2/3 w-24 overflow-hidden rounded-xl bg-muted/30 shadow-sm">
												{/* biome-ignore lint/performance/noImgElement: blob preview URL before upload */}
												<img
													src={customCoverPreview}
													alt=""
													className="size-full object-cover"
												/>
											</div>
										) : null}
									</div>

									{films.length > 0 ? (
										<div>
											<p className="mb-2 font-medium text-foreground text-sm">
												From this list
											</p>
											<div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
												{films
													.filter(
														(
															row,
														): row is typeof row & {
															movie: NonNullable<(typeof row)["movie"]>;
														} => row.movie != null,
													)
													.map((row) => {
														const movie = row.movie;
														const movieId = movie.tmdbId;
														const src = profilePosterUrlFromPath(
															movie.posterPath,
														);
														const selected =
															hasPinnedPoster && coverMovieId === movieId;
														const busy = savingId === movieId;

														return (
															<button
																key={movie.tmdbId}
																type="button"
																disabled={savingId !== null}
																onClick={() => void handlePick(movieId)}
																className={cn(
																	"relative aspect-2/3 min-h-0 min-w-0 overflow-hidden rounded-2xl bg-muted/30 text-left shadow-sm transition-shadow duration-200",
																	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
																	selected &&
																		"ring-2 ring-foreground ring-offset-2 ring-offset-card",
																	"[@media(hover:hover)]:hover:shadow-md",
																)}
																aria-label={`Use ${movie.title} as cover${selected ? " (current)" : ""}`}
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
																	<span className="grid size-full place-items-center text-muted-foreground text-xs">
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
								<div className="flex flex-wrap items-center justify-between gap-2 border-border/40 border-t px-5 py-4">
									<button
										type="button"
										disabled={savingId !== null || !canReset}
										onClick={() => void handleReset()}
										className={cn(
											"rounded-full px-4 py-2 font-medium text-muted-foreground text-sm",
											DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
											"disabled:pointer-events-none disabled:opacity-40",
										)}
									>
										{savingId === "clear" ? (
											<Loader2
												className="inline size-4 animate-spin"
												aria-hidden
											/>
										) : null}
										Reset to default
									</button>
									<button
										type="button"
										onClick={() => setOpen(false)}
										className="rounded-full bg-foreground px-5 py-2 font-medium text-background text-sm"
									>
										Done
									</button>
								</div>
							</div>
						</div>,
						document.body,
					)
				: null}
		</>
	);
}
