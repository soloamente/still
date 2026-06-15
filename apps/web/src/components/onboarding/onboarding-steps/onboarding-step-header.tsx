import type { ReactNode } from "react";

type OnboardingStepHeaderProps = {
	title: ReactNode;
	description: ReactNode;
	/** Optional meta line under the description (e.g. rating progress). */
	meta?: ReactNode;
};

/** Centered title + copy block shared across wizard steps. */
export function OnboardingStepHeader({
	title,
	description,
	meta,
}: OnboardingStepHeaderProps) {
	return (
		<div className="flex flex-col gap-2 text-center">
			<h1 className="text-balance font-bold font-sans text-3xl leading-none">
				{title}
			</h1>
			<p className="text-pretty text-muted-foreground">{description}</p>
			{meta ? (
				<p className="text-muted-foreground text-sm tabular-nums">{meta}</p>
			) : null}
		</div>
	);
}
