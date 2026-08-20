"use client";

import { useEffect, useState } from "react";

import { canCreateWebGlContext } from "@/lib/can-create-web-gl-context";
import { detectSoftwareGpuRendering } from "@/lib/detect-software-gpu-rendering";

/**
 * Client probe for decorative WebGL (img-fx, MetalFx).
 * Starts false so we never mount shaders before the probe — avoids console errors
 * in sandboxed Electron / software-GPU hosts.
 */
export function useWebGlEffectsAvailable(): boolean {
	const [available, setAvailable] = useState(false);

	useEffect(() => {
		setAvailable(canCreateWebGlContext() && !detectSoftwareGpuRendering());
	}, []);

	return available;
}
