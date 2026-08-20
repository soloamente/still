"use client";

import { cn } from "@still/ui/lib/utils";
import { Stepper } from "pasito";
import { useLayoutEffect, useRef } from "react";

/** Pasito pill stepper — minimal artwork dots on hero posters and background stills. */
export function DetailArtworkPasitoStepper({
	count,
	active,
	onStepClick,
	maxVisible,
	className,
	transitionDuration = 200,
	/** Override Pasito’s hardcoded “Step N” tab names when the rail has semantic slides. */
	getStepLabel,
}: {
	count: number;
	active: number;
	onStepClick: (index: number) => void;
	maxVisible?: number;
	className?: string;
	transitionDuration?: number;
	getStepLabel?: (index: number) => string;
}) {
	const rootRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		if (!getStepLabel || !rootRef.current) return;
		// Pasito hardcodes `aria-label="Step ${n}"` with the absolute index — parse that
		// (windowed steppers only mount a subset, so DOM order ≠ slide index).
		const buttons =
			rootRef.current.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
		buttons.forEach((button) => {
			const stored = button.getAttribute("data-pasito-step-index");
			const current = button.getAttribute("aria-label") ?? "";
			const stepMatch = /^Step (\d+)$/.exec(current);
			const index =
				stored != null
					? Number(stored)
					: stepMatch
						? Number(stepMatch[1]) - 1
						: Number.NaN;
			if (!Number.isFinite(index) || index < 0) return;
			button.setAttribute("data-pasito-step-index", String(index));
			button.setAttribute("aria-label", getStepLabel(index));
		});
	}, [active, count, getStepLabel, maxVisible]);

	if (count <= 1) return null;

	return (
		<div ref={rootRef}>
			<Stepper
				count={count}
				active={active}
				onStepClick={onStepClick}
				maxVisible={maxVisible}
				transitionDuration={transitionDuration}
				className={cn("detail-artwork-pasito-hero", className)}
			/>
		</div>
	);
}
