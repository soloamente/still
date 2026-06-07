"use client";

import { cn } from "@still/ui/lib/utils";
import { Stepper } from "pasito";

/** Pasito pill stepper — minimal artwork dots on hero posters and background stills. */
export function DetailArtworkPasitoStepper({
	count,
	active,
	onStepClick,
	maxVisible,
	className,
	transitionDuration = 200,
}: {
	count: number;
	active: number;
	onStepClick: (index: number) => void;
	maxVisible?: number;
	className?: string;
	transitionDuration?: number;
}) {
	if (count <= 1) return null;

	return (
		<Stepper
			count={count}
			active={active}
			onStepClick={onStepClick}
			maxVisible={maxVisible}
			transitionDuration={transitionDuration}
			className={cn("detail-artwork-pasito-hero", className)}
		/>
	);
}
