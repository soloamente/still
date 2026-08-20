import type { ReactNode } from "react";

export const ONBOARDING_STEP_TITLE_ID = "onboarding-step-title";

type OnboardingStepHeaderProps = {
	title: ReactNode;
	description: ReactNode;
	/** Optional meta line under the description (e.g. rating progress). */
	meta?: ReactNode;
};

/** Title + copy — centered on narrow screens, leading-aligned on the desktop rail. */
export function OnboardingStepHeader({
	title,
	description,
	meta,
}: OnboardingStepHeaderProps) {
	return (
		<div className="flex flex-col gap-2 text-center lg:text-start">
			<h1
				className="text-balance font-sans font-semibold text-3xl leading-[1.1] tracking-tight"
				id={ONBOARDING_STEP_TITLE_ID}
			>
				{title}
			</h1>
			<p className="text-pretty text-muted-foreground">{description}</p>
			{meta ? (
				<p className="text-muted-foreground text-sm tabular-nums">{meta}</p>
			) : null}
		</div>
	);
}
