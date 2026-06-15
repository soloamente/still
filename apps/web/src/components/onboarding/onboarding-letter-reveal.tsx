"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

type TextSegment = {
	key: string;
	text: string;
	isSpace: boolean;
};

/** Split copy into word + whitespace chunks for per-letter animation. */
export function splitTextSegments(text: string): TextSegment[] {
	const parts = text.split(/(\s+)/);
	const segments: TextSegment[] = [];

	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index];
		if (!part) continue;

		segments.push({
			key: `segment-${index}`,
			text: part,
			isSpace: /^\s+$/.test(part),
		});
	}

	return segments;
}

type LetterToken = {
	key: string;
	letter: string;
};

function letterTokensForSegment(segment: TextSegment): LetterToken[] {
	const tokens: LetterToken[] = [];
	for (const letter of segment.text) {
		tokens.push({
			key: `${segment.key}-pos-${tokens.length}-${letter}`,
			letter,
		});
	}
	return tokens;
}

type OnboardingLetterRevealProps = {
	text: string;
	/** When false, render static text (inactive preview fields). */
	active: boolean;
	className?: string;
};

/**
 * Per-letter reveal for the live profile preview — mirrors the reference
 * onboarding shell without animating inactive fields.
 */
export function OnboardingLetterReveal({
	text,
	active,
	className,
}: OnboardingLetterRevealProps) {
	const reduceMotion = useReducedMotion();
	const segments = useMemo(() => splitTextSegments(text), [text]);

	if (!text.trim() || !active || reduceMotion) {
		return <span className={className}>{text}</span>;
	}

	return (
		<span className={className}>
			<AnimatePresence mode="popLayout">
				{segments.map((segment) => {
					if (segment.isSpace) {
						return (
							<span key={segment.key} style={{ whiteSpace: "pre" }}>
								{segment.text}
							</span>
						);
					}

					return (
						<span
							key={segment.key}
							style={{ display: "inline-block", whiteSpace: "nowrap" }}
						>
							{letterTokensForSegment(segment).map((token, letterIndex) => (
								<motion.span
									key={token.key}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.5 }}
									initial={{ opacity: 0, scale: 0.5 }}
									style={{ display: "inline-block" }}
									transition={{
										duration: 0.1,
										ease: "easeOut",
										delay: letterIndex * 0.02,
									}}
								>
									{token.letter}
								</motion.span>
							))}
						</span>
					);
				})}
			</AnimatePresence>
		</span>
	);
}
