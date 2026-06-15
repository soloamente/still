"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import useMeasure from "react-use-measure";

const stepVariants = {
	initial: (direction: number) => ({
		x: `${110 * direction}%`,
		opacity: 0,
	}),
	active: { x: "0%", opacity: 1 },
	exit: (direction: number) => ({
		x: `${-110 * direction}%`,
		opacity: 0,
	}),
};

type OnboardingStepShellProps = {
	stepKey: string;
	direction: number;
	children: ReactNode;
	/** Optional nav row rendered below step content (back / continue). */
	footer?: ReactNode;
};

/**
 * Animated step container — directional slide + measured height spring.
 * Height uses a bounce-free spring (reference); slides stay at 200ms ease-out.
 */
export function OnboardingStepShell({
	stepKey,
	direction,
	children,
	footer,
}: OnboardingStepShellProps) {
	const reduceMotion = useReducedMotion();
	const slideTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as const };
	const heightTransition = reduceMotion
		? { duration: 0 }
		: { type: "spring" as const, bounce: 0, duration: 0.4 };
	const [ref, bounds] = useMeasure();
	const [hasMeasured, setHasMeasured] = useState(false);

	useEffect(() => {
		if (bounds.height > 0 && !hasMeasured) setHasMeasured(true);
	}, [bounds.height, hasMeasured]);

	return (
		<motion.div
			animate={{
				height: bounds.height > 0 ? bounds.height : "auto",
			}}
			className="w-full max-w-[400px] shrink-0 overflow-hidden"
			initial={false}
			transition={hasMeasured ? heightTransition : { duration: 0 }}
		>
			<div className="flex flex-col gap-8 p-6" ref={ref}>
				<AnimatePresence custom={direction} initial={false} mode="popLayout">
					<motion.div
						key={stepKey}
						animate="active"
						custom={direction}
						exit="exit"
						initial="initial"
						transition={slideTransition}
						variants={stepVariants}
					>
						{children}
					</motion.div>
				</AnimatePresence>
				{footer ? <div>{footer}</div> : null}
			</div>
		</motion.div>
	);
}
