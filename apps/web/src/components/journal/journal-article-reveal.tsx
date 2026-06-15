"use client";

import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useLayoutEffect, useRef } from "react";

/**
 * transitions.dev panel reveal — slides the journal article hero into view on mount.
 */
export function JournalArticleReveal({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const panelRef = useRef<HTMLDivElement>(null);
	const reduceMotion = useReducedMotion();

	useLayoutEffect(() => {
		const panel = panelRef.current;
		if (!panel) return;
		if (reduceMotion) {
			panel.setAttribute("data-open", "true");
			return;
		}
		panel.setAttribute("data-open", "false");
		void panel.offsetWidth;
		panel.setAttribute("data-open", "true");
	}, [reduceMotion]);

	return (
		<div
			ref={panelRef}
			className={cn("t-panel-slide", className)}
			data-open="false"
		>
			{children}
		</div>
	);
}
