"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

const OVERLAY_CLASS =
	"fixed inset-0 z-[250] grid min-h-[100dvh] place-items-center overflow-y-auto overscroll-contain bg-absolute-black/78 px-4 py-8 backdrop-blur-sm";

export function ImageCropDialog({
	open,
	src,
	aspect,
	title,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	/** Object URL of the picked file. */
	src: string | null;
	/** Locked crop aspect (width / height): banner 3, avatar 2/3. */
	aspect: number;
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
	const [areaPixels, setAreaPixels] = useState<Area | null>(null);

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (open) {
			setCrop({ x: 0, y: 0 });
			setZoom(1);
			setAreaPixels(null);
		}
	}, [open, src]);

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
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.98 }}
						transition={
							reduceMotion
								? { duration: 0 }
								: { duration: 0.22, ease: PANEL_EASE }
						}
						onClick={(e) => e.stopPropagation()}
						className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-card text-foreground shadow-mobbin-xl sm:rounded-[2.25rem]"
					>
						<div className="flex items-center justify-between px-6 pt-5 pb-3 sm:px-7">
							<h2
								id={titleId}
								className="font-semibold text-foreground text-lg tracking-tight"
							>
								{title}
							</h2>
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={onCancel}
								aria-label="Cancel"
								className="text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="relative mx-6 h-72 overflow-hidden rounded-2xl bg-background sm:mx-7 sm:h-80">
							<Cropper
								image={src}
								crop={crop}
								zoom={zoom}
								aspect={aspect}
								minZoom={1}
								maxZoom={4}
								restrictPosition
								onCropChange={setCrop}
								onZoomChange={setZoom}
								onCropComplete={(_area, areaPx) => setAreaPixels(areaPx)}
							/>
						</div>

						<div className="px-6 pt-5 sm:px-7">
							<label className="flex items-center gap-3 text-muted-foreground text-xs">
								Zoom
								<input
									type="range"
									min={1}
									max={4}
									step={0.01}
									value={zoom}
									onChange={(e) => setZoom(Number(e.target.value))}
									className="h-1 flex-1 cursor-pointer accent-foreground"
									aria-label="Zoom"
								/>
							</label>
						</div>

						<div className="flex flex-col-reverse gap-2 px-6 pt-6 pb-6 sm:flex-row sm:justify-end sm:gap-3 sm:px-7">
							<Button
								type="button"
								variant="ghost"
								size="pill"
								onClick={onCancel}
								className={cn(
									"h-auto min-h-11 w-full border-transparent bg-background px-5 py-2.5 sm:w-auto sm:min-w-32",
								)}
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
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return createPortal(portal, document.body);
}
