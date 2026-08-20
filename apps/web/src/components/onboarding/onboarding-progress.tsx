"use client";

/** Quiet rail meter — width tweens via transitions.dev card-resize. */
export function OnboardingProgress({ value }: { value: number }) {
	const clamped = Math.min(1, Math.max(0, value));
	const pct = Math.round(clamped * 100);

	return (
		<div
			aria-label="Setup progress"
			aria-valuemax={100}
			aria-valuemin={0}
			aria-valuenow={pct}
			className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-background"
			role="progressbar"
		>
			<div
				className="t-resize h-full rounded-full bg-foreground"
				style={{ width: `${pct}%` }}
			/>
		</div>
	);
}
