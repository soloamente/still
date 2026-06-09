"use client";

import { useEffect, useState } from "react";

import { detectSoftwareGpuRendering } from "@/lib/detect-software-gpu-rendering";

/**
 * One-shot probe for software GPU rendering — used to drop backdrop-blur on overlays
 * where blur forces full-viewport repaints on every scroll frame.
 */
export function useSoftwareGpuRendering(): boolean {
	const [softwareGpu, setSoftwareGpu] = useState(false);

	useEffect(() => {
		const detected = detectSoftwareGpuRendering();
		setSoftwareGpu(detected);
		if (detected) {
			document.documentElement.dataset.softwareGpu = "";
		} else {
			delete document.documentElement.dataset.softwareGpu;
		}
	}, []);

	return softwareGpu;
}
