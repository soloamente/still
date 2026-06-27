/** Pixel rectangle in the *source* image (what react-easy-crop returns as `croppedAreaPixels`). */
export type CropAreaPixels = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type Size = { width: number; height: number };

/**
 * Output canvas size: the crop rectangle downscaled to fit within `max`,
 * preserving aspect ratio. Never upscales (scale capped at 1).
 */
export function computeOutputSize(crop: Size, max: Size): Size {
	const scale = Math.min(1, max.width / crop.width, max.height / crop.height);
	return {
		width: Math.round(crop.width * scale),
		height: Math.round(crop.height * scale),
	};
}

/** Load an <img> from an object URL (or any src). Rejects on decode error. */
function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Image decode failed"));
		img.src = src;
	});
}

/**
 * Render `area` of the source image to an offscreen canvas (downscaled to
 * `maxWidth`×`maxHeight`) and return it as a WebP `File`. Throws if the canvas
 * can't be created or encoded.
 */
export async function cropImageToFile(
	src: string,
	area: CropAreaPixels,
	opts: {
		maxWidth: number;
		maxHeight: number;
		fileName: string;
		quality?: number;
	},
): Promise<File> {
	const img = await loadImage(src);
	const out = computeOutputSize(
		{ width: area.width, height: area.height },
		{ width: opts.maxWidth, height: opts.maxHeight },
	);

	const canvas = document.createElement("canvas");
	canvas.width = out.width;
	canvas.height = out.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas not supported");
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(
		img,
		area.x,
		area.y,
		area.width,
		area.height,
		0,
		0,
		out.width,
		out.height,
	);

	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob(resolve, "image/webp", opts.quality ?? 0.9);
	});
	if (!blob) throw new Error("Couldn't process image");

	return new File([blob], opts.fileName, { type: "image/webp" });
}
