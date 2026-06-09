"use client";

import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

/**
 * Runs once in `AppShell` so `html[data-software-gpu]` is set before any modal opens.
 */
export function SoftwareGpuDocumentProbe() {
	useSoftwareGpuRendering();
	return null;
}
