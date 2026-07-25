"use client";

import { useLayoutEffect } from "react";

import {
	releaseMarkedDrawerStackDepth,
	syncDrawerStackParentDepth,
} from "@/lib/detail-vaul-drawer-stack-depth";

/**
 * When a second sheet opens above an existing Vaul drawer, scale the lower sheet(s)
 * so the stack matches page-level `shouldScaleBackground` depth.
 */
export function useDrawerStackParentDepth(active: boolean): void {
	useLayoutEffect(() => {
		let cancelled = false;
		let frame = 0;

		if (!active) {
			frame = requestAnimationFrame(() => {
				if (cancelled) return;
				// Do not count closing sheets in the DOM — release scaled parents directly.
				releaseMarkedDrawerStackDepth();
			});
			return () => {
				cancelled = true;
				cancelAnimationFrame(frame);
			};
		}

		frame = requestAnimationFrame(() => {
			if (cancelled) return;
			syncDrawerStackParentDepth();
		});

		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
		};
	}, [active]);
}
