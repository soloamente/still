"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";

const PROFILE_VISIBILITY_TOOLTIPS = {
	public:
		"Anyone can find your profile, diary, and public lists.\nGood when you want friends and the community to see what you watch.",
	private:
		"Only approved followers can see your activity.\nGood when you want a closed diary until you accept follow requests.",
} as const;

const pillLayoutId = "settings-profile-visibility-pill";

function segmentChip(active: boolean) {
	return cn(
		"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-5 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
		active
			? "text-foreground"
			: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
	);
}

function VisibilitySegment({
	active,
	label,
	tooltip,
	onSelect,
	pillTransition,
}: {
	active: boolean;
	label: string;
	tooltip: string;
	onSelect: () => void;
	pillTransition:
		| { duration: number }
		| {
				type: "tween";
				duration: number;
				ease: readonly [number, number, number, number];
		  };
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						className={segmentChip(active)}
						aria-pressed={active}
						onClick={onSelect}
					>
						{active ? (
							<motion.span
								layoutId={pillLayoutId}
								className="absolute inset-0 z-0 rounded-full bg-background"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">{label}</span>
					</button>
				}
			/>
			<TooltipContent className="w-fit max-w-[19rem] whitespace-pre-line text-balance text-center">
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}

/** Public / Private rail — bottom of profile settings card, create-list tooltips. */
export function MeProfileVisibilityToggle({
	checked: isPrivate,
	onChange,
}: {
	checked: boolean;
	onChange: (isPrivate: boolean) => void;
}) {
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	return (
		<TooltipProvider delay={280} closeDelay={80}>
			<LayoutGroup id="settings-profile-visibility">
				<fieldset className="m-0 flex w-fit items-center rounded-full border-0 bg-card p-1">
					<legend className="sr-only">Profile visibility</legend>
					<VisibilitySegment
						active={!isPrivate}
						label="Public"
						tooltip={PROFILE_VISIBILITY_TOOLTIPS.public}
						onSelect={() => onChange(false)}
						pillTransition={pillTransition}
					/>
					<VisibilitySegment
						active={isPrivate}
						label="Private"
						tooltip={PROFILE_VISIBILITY_TOOLTIPS.private}
						onSelect={() => onChange(true)}
						pillTransition={pillTransition}
					/>
				</fieldset>
			</LayoutGroup>
		</TooltipProvider>
	);
}
