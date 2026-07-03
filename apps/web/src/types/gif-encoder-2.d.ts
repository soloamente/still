/** Minimal typings for gif-encoder-2 (no @types package published). */
declare module "gif-encoder-2" {
	export default class GIFEncoder {
		constructor(width: number, height: number);
		start(): void;
		setDelay(delay: number): void;
		addFrame(ctx: CanvasRenderingContext2D): void;
		finish(): void;
		out: {
			getData(): Uint8Array;
		};
	}
}
