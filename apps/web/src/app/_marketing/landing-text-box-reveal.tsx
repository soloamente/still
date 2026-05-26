"use client";

import { cn } from "@still/ui/lib/utils";
import { type MotionValue, motion, useTransform } from "motion/react";

interface LandingIntroRevealCopyProps {
	text: string;
	highlight?: string;
	progress: MotionValue<number>;
	className?: string;
}

interface AnimatedCharProps {
	char: string;
	progress: MotionValue<number>;
	charIndex: number;
	totalChars: number;
	isHighlight: boolean;
}

/** Per-character scrub — opacity, blur, and lift like La Nube `.txrev .char`. */
function AnimatedChar({
	char,
	progress,
	charIndex,
	totalChars,
	isHighlight,
}: AnimatedCharProps) {
	const overlapChars = 24;
	const charStart = charIndex / totalChars;
	const charEnd = charStart + overlapChars / totalChars;
	const totalAnimationLength = 1 + overlapChars / totalChars;
	const timelineScale =
		1 /
		Math.min(
			totalAnimationLength,
			1 + (totalChars - 1) / totalChars + overlapChars / totalChars,
		);
	const adjustedStart = charStart * timelineScale;
	const adjustedEnd = charEnd * timelineScale;

	const opacity = useTransform(progress, [adjustedStart, adjustedEnd], [0, 1]);
	const y = useTransform(
		progress,
		[adjustedStart, adjustedEnd],
		["0.3em", "0em"],
	);
	const blurPx = useTransform(progress, [adjustedStart, adjustedEnd], [5, 0]);
	const filter = useTransform(blurPx, (value) => `blur(${value}px)`);

	return (
		<motion.span
			className={cn(
				"inline-block will-change-[filter,transform]",
				isHighlight ? "text-desert-orange" : "text-foreground",
			)}
			style={{ opacity, y, filter }}
		>
			{char}
		</motion.span>
	);
}

/** Split copy into chars; mark indices inside the highlight word (La Nube `words` + `chars`). */
function tokenizeIntroChars(copy: string, highlight: string) {
	const highlightStart = copy.indexOf(highlight);
	const highlightEnd =
		highlightStart === -1 ? -1 : highlightStart + highlight.length;

	return [...copy].map((char, index) => ({
		key: `intro-${index}`,
		char: char === " " ? "\u00a0" : char,
		isSpace: char === " ",
		isHighlight:
			highlightStart !== -1 && index >= highlightStart && index < highlightEnd,
	}));
}

/** Manifesto typography — muted until scroll scrubs each character in. */
export function LandingIntroRevealCopy({
	text,
	highlight = "taste",
	progress,
	className,
}: LandingIntroRevealCopyProps) {
	const chars = tokenizeIntroChars(text, highlight);
	const animatable = chars.filter((token) => !token.isSpace);
	const totalChars = animatable.length;
	let charIndex = 0;

	return (
		<p
			className={cn(
				"max-w-[90rem] font-medium font-sans text-[clamp(1.5rem,4vw,2.75rem)] text-foreground/20 leading-[1.2] tracking-[-0.03em]",
				className,
			)}
		>
			{chars.map((token) => {
				if (token.isSpace) {
					return (
						<span key={token.key} className="inline-block">
							{token.char}
						</span>
					);
				}

				const index = charIndex;
				charIndex += 1;

				return (
					<span key={token.key} className="inline-block">
						<AnimatedChar
							char={token.char}
							progress={progress}
							charIndex={index}
							totalChars={totalChars}
							isHighlight={token.isHighlight}
						/>
					</span>
				);
			})}
		</p>
	);
}
