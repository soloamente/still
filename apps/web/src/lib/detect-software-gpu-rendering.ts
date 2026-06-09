/**
 * Detect software WebGL renderers (SwiftShader, llvmpipe, etc.) — common when the
 * browser disables hardware acceleration or the machine has no usable GPU.
 */
export function detectSoftwareGpuRendering(): boolean {
	if (typeof document === "undefined") return false;

	try {
		const canvas = document.createElement("canvas");
		const gl =
			canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
		if (!gl || typeof gl !== "object") return true;

		const debugInfo = (gl as WebGLRenderingContext).getExtension(
			"WEBGL_debug_renderer_info",
		);
		if (!debugInfo) return false;

		const renderer = (gl as WebGLRenderingContext).getParameter(
			debugInfo.UNMASKED_RENDERER_WEBGL,
		);
		if (typeof renderer !== "string") return false;

		return /swiftshader|llvmpipe|software|microsoft basic render|mesa offscreen/i.test(
			renderer,
		);
	} catch {
		return false;
	}
}
