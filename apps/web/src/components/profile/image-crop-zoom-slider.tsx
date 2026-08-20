"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { SenseTrackSlider } from "@/components/ui/sense-track-slider";

type ImageCropZoomSliderProps = {
	zoom: number;
	minZoom: number;
	maxZoom: number;
	onZoomChange: (zoom: number) => void;
	className?: string;
};

/** Crop zoom — Sense track with magnifier ± pills. */
export function ImageCropZoomSlider({
	zoom,
	minZoom,
	maxZoom,
	onZoomChange,
	className,
}: ImageCropZoomSliderProps) {
	const unit =
		maxZoom <= minZoom
			? 0
			: Math.min(1, Math.max(0, (zoom - minZoom) / (maxZoom - minZoom)));

	return (
		<SenseTrackSlider
			className={className}
			value={zoom}
			min={minZoom}
			max={maxZoom}
			step={0.05}
			onChange={onZoomChange}
			label="Zoom"
			decreaseLabel="Zoom out"
			increaseLabel="Zoom in"
			valueText={`${Math.round(unit * 100)} percent zoom`}
			decreaseIcon={
				<ZoomOut className="size-4" strokeWidth={1.75} aria-hidden />
			}
			increaseIcon={
				<ZoomIn className="size-4" strokeWidth={1.75} aria-hidden />
			}
		/>
	);
}
