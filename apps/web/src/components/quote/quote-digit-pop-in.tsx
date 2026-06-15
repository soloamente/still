"use client";

import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";

/** transitions.dev number pop-in on upvote count changes only. */
export function QuoteDigitPopIn({
	value,
	className,
}: {
	value: number;
	className?: string;
}) {
	const reduceMotion = useReducedMotion();
	const groupRef = useRef<HTMLSpanElement>(null);
	const text = String(value);

	useLayoutEffect(() => {
		const group = groupRef.current;
		if (!group || reduceMotion) return;

		group.classList.remove("is-animating");
		group.replaceChildren();

		for (const [index, ch] of [...text].entries()) {
			const span = document.createElement("span");
			span.className = "t-digit";
			span.textContent = ch;
			if (index === text.length - 2) span.dataset.stagger = "1";
			else if (index === text.length - 1) span.dataset.stagger = "2";
			group.appendChild(span);
		}

		void group.offsetHeight;
		group.classList.add("is-animating");
	}, [reduceMotion, text]);

	if (reduceMotion) {
		return <span className={cn("tabular-nums", className)}>{text}</span>;
	}

	return (
		<span
			ref={groupRef}
			className={cn("t-digit-group tabular-nums", className)}
		>
			{text}
		</span>
	);
}
