"use client";

import { Button } from "@still/ui/components/button";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import { MissingArtworkPlaceholder } from "@/components/media/missing-artwork-placeholder";
import { ImageCropZoomSlider } from "@/components/profile/image-crop-zoom-slider";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;
const CROP_MAX_ZOOM = 4;

const OVERLAY_CLASS =
	"fixed inset-0 z-[250] grid min-h-[100dvh] place-items-center overflow-y-auto overscroll-contain bg-absolute-black/78 px-4 py-8 backdrop-blur-sm";

/** Minimum zoom so the source image always covers the locked crop frame. */
function minZoomForMedia(media: MediaSize, aspect: number): number {
	const cropWidth =
		media.width / media.height > aspect ? media.height * aspect : media.width;
	const cropHeight = cropWidth / aspect;
	return Math.max(cropWidth / media.width, cropHeight / media.height);
}

export function ImageCropDialog({
	open,
	src,
	aspect,
	cropShape = "rect",
	title,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	/** Object URL of the picked file. */
	src: string | null;
	/** Locked crop aspect (width / height): banner 3:1, avatar 1:1. */
	aspect: number;
	/** Round mask for circular patron portraits; banner stays rectangular. */
	cropShape?: "rect" | "round";
	title: string;
	onCancel: () => void;
	/** Crop rectangle in source pixels. */
	onConfirm: (areaPixels: Area) => void;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const [mounted, setMounted] = useState(false);
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [minZoom, setMinZoom] = useState(1);
	const [areaPixels, setAreaPixels] = useState<Area | null>(null);

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (open) {
			setCrop({ x: 0, y: 0 });
			setZoom(1);
			setMinZoom(1);
			setAreaPixels(null);
		}
	}, [open, src]);

	const handleMediaLoaded = useCallback(
		(media: MediaSize) => {
			const nextMinZoom = minZoomForMedia(media, aspect);
			setMinZoom(nextMinZoom);
			setZoom(nextMinZoom);
		},
		[aspect],
	);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	const handleKey = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
		},
		[onCancel],
	);
	useEffect(() => {
		if (!open) return;
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [open, handleKey]);

	if (!mounted) return null;

	const portal = (
		<AnimatePresence>
			{open && src ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
					aria-hidden
					className={OVERLAY_CLASS}
					onClick={onCancel}
				>
					{/* Keep the crop surface off transform animations — scale breaks pan/zoom math. */}
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
						className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:rounded-[2.25rem]"
					>
						<motion.div
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 6 }}
							transition={
								reduceMotion
									? { duration: 0 }
									: { duration: 0.22, ease: PANEL_EASE }
							}
							className="flex flex-col"
						>
							<div className="px-6 pt-5 pb-3 sm:px-7">
								<h2
									id={titleId}
									className="font-semibold text-foreground text-lg tracking-tight"
								>
									{title}
								</h2>
							</div>

							<div
								className="relative mx-6 h-72 overflow-hidden rounded-2xl sm:mx-7 sm:h-80"
								data-lenis-prevent-wheel
							>
								{/* Same morphing dots as empty posters — visible in letterbox / crop dim. */}
								<div
									className="pointer-events-none absolute inset-0"
									aria-hidden
								>
									<MissingArtworkPlaceholder className="absolute inset-0" />
								</div>
								<Cropper
									key={`${src}:${aspect}:${cropShape}`}
									image={src}
									crop={crop}
									zoom={zoom}
									aspect={aspect}
									cropShape={cropShape}
									minZoom={minZoom}
									maxZoom={CROP_MAX_ZOOM}
									restrictPosition
									onCropChange={setCrop}
									onZoomChange={setZoom}
									onMediaLoaded={handleMediaLoaded}
									onCropAreaChange={(_area, areaPx) => setAreaPixels(areaPx)}
									onCropComplete={(_area, areaPx) => setAreaPixels(areaPx)}
									classes={{
										containerClassName: "z-[1]",
									}}
								/>
							</div>

							{/* Custom zoom rail — Sense track + ± pills (transitions.dev card-resize on fill). */}
							<div className="px-6 pt-5 sm:px-7">
								<ImageCropZoomSlider
									zoom={zoom}
									minZoom={minZoom}
									maxZoom={CROP_MAX_ZOOM}
									onZoomChange={setZoom}
								/>
							</div>

							{/* Cancel left · Apply right — header X removed as duplicate dismiss. */}
							<div className="flex flex-col-reverse gap-2 px-6 pt-6 pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-7">
								<Button
									type="button"
									variant="ghost"
									size="pill"
									onClick={onCancel}
									className="h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 sm:w-auto sm:min-w-32"
								>
									Cancel
								</Button>
								<Button
									type="button"
									variant="default"
									size="pill"
									disabled={!areaPixels}
									onClick={() => areaPixels && onConfirm(areaPixels)}
									className="h-auto min-h-11 w-full bg-foreground px-5 py-2.5 text-background sm:w-auto sm:min-w-32"
								>
									Apply
								</Button>
							</div>
						</motion.div>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return createPortal(portal, document.body);
}
