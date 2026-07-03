import GIFEncoder from "gif-encoder-2";
import { decompressFrames, type ParsedFrame, parseGIF } from "gifuct-js";

import { type CropAreaPixels, computeOutputSize } from "@/lib/crop-image";

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Apply the previous frame's GIF disposal rule before compositing the next frame. */
function applyFrameDisposal(
	ctx: CanvasRenderingContext2D,
	previousFrame: ParsedFrame | null,
	restoreSnapshot: ImageData | null,
): void {
	if (!previousFrame) return;

	if (previousFrame.disposalType === 2) {
		const { left, top, width, height } = previousFrame.dims;
		ctx.clearRect(left, top, width, height);
		return;
	}

	if (previousFrame.disposalType === 3 && restoreSnapshot) {
		ctx.putImageData(restoreSnapshot, 0, 0);
	}
}

/**
 * Crop an animated GIF client-side — decodes each frame, composites with disposal,
 * crops the same rectangle, and re-encodes as GIF (Pro animated media).
 */
export async function cropGifToFile(
	src: string,
	area: CropAreaPixels,
	opts: {
		maxWidth: number;
		maxHeight: number;
		fileName: string;
	},
): Promise<File> {
	const response = await fetch(src);
	const buffer = await response.arrayBuffer();
	const parsed = parseGIF(buffer);
	const frames = decompressFrames(parsed, true);

	if (frames.length === 0) {
		throw new Error("Couldn't process image");
	}

	const gifWidth = parsed.lsd.width;
	const gifHeight = parsed.lsd.height;

	const cropX = clamp(Math.floor(area.x), 0, Math.max(0, gifWidth - 1));
	const cropY = clamp(Math.floor(area.y), 0, Math.max(0, gifHeight - 1));
	const cropW = clamp(Math.floor(area.width), 1, Math.max(1, gifWidth - cropX));
	const cropH = clamp(
		Math.floor(area.height),
		1,
		Math.max(1, gifHeight - cropY),
	);

	const out = computeOutputSize(
		{ width: cropW, height: cropH },
		{ width: opts.maxWidth, height: opts.maxHeight },
	);

	const gifCanvas = document.createElement("canvas");
	gifCanvas.width = gifWidth;
	gifCanvas.height = gifHeight;
	const gifCtx = gifCanvas.getContext("2d");
	if (!gifCtx) throw new Error("Canvas not supported");

	const cropCanvas = document.createElement("canvas");
	cropCanvas.width = out.width;
	cropCanvas.height = out.height;
	const cropCtx = cropCanvas.getContext("2d");
	if (!cropCtx) throw new Error("Canvas not supported");

	const patchCanvas = document.createElement("canvas");
	const patchCtx = patchCanvas.getContext("2d");
	if (!patchCtx) throw new Error("Canvas not supported");

	const encoder = new GIFEncoder(out.width, out.height);
	encoder.start();

	let previousFrame: ParsedFrame | null = null;
	let restoreSnapshot: ImageData | null = null;

	for (const frame of frames) {
		applyFrameDisposal(gifCtx, previousFrame, restoreSnapshot);

		if (frame.disposalType === 3) {
			restoreSnapshot = gifCtx.getImageData(0, 0, gifWidth, gifHeight);
		}

		patchCanvas.width = frame.dims.width;
		patchCanvas.height = frame.dims.height;
		const patchImage = patchCtx.createImageData(
			frame.dims.width,
			frame.dims.height,
		);
		patchImage.data.set(frame.patch);
		patchCtx.putImageData(patchImage, 0, 0);
		gifCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

		cropCtx.clearRect(0, 0, out.width, out.height);
		cropCtx.imageSmoothingQuality = "high";
		cropCtx.drawImage(
			gifCanvas,
			cropX,
			cropY,
			cropW,
			cropH,
			0,
			0,
			out.width,
			out.height,
		);

		encoder.setDelay(frame.delay);
		encoder.addFrame(cropCtx);

		previousFrame = frame;
	}

	encoder.finish();
	// Encoder bytes are a Uint8Array; copy into a Blob-safe buffer for TS 6 BlobPart typing.
	const bytes = encoder.out.getData();
	const blob = new Blob([Uint8Array.from(bytes)], { type: "image/gif" });
	const fileName = opts.fileName.toLowerCase().endsWith(".gif")
		? opts.fileName
		: opts.fileName.replace(/\.webp$/i, ".gif");

	return new File([blob], fileName, { type: "image/gif" });
}
