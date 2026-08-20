/**
 * Probe whether this browser can create a WebGL context at all.
 * Used before mounting decorative WebGL (img-fx, MetalFx) so sandboxed
 * / broken-GPU hosts never throw into the console.
 */
export function canCreateWebGlContext(): boolean {
	if (typeof document === "undefined") return false;

	try {
		const canvas = document.createElement("canvas");
		const gl =
			canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
		return Boolean(gl);
	} catch {
		return false;
	}
}
