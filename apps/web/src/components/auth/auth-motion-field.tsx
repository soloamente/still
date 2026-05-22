"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";

/** icaru input surface — no focus ring/outline; scale feedback lives on `AuthMotionInput`. */
export const AUTH_INPUT_CLASS =
	"auth-input w-full rounded-2xl bg-input px-3.75 py-3.25 leading-none transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-0";

/** Collapsing error line under each field (icaru height + opacity animation). */
export function AuthFieldErrors({
	errors,
	className,
}: {
	errors: Array<{ message?: string } | undefined>;
	className?: string;
}) {
	const message = errors.find(Boolean)?.message;
	if (!message) return null;

	return (
		<AnimatePresence mode="wait">
			<motion.div
				animate={{ opacity: 1, height: "auto", marginTop: 4 }}
				className={cn("overflow-hidden", className)}
				exit={{ opacity: 0, height: 0, marginTop: 0 }}
				initial={{ opacity: 0, height: 0, marginTop: 0 }}
				key={message}
				transition={{ duration: 0.2 }}
			>
				<motion.p
					animate={{ opacity: 1 }}
					className="text-center text-destructive text-sm"
					exit={{ opacity: 0 }}
					initial={{ opacity: 0 }}
					transition={{ duration: 0.15 }}
				>
					{message}
				</motion.p>
			</motion.div>
		</AnimatePresence>
	);
}

/** Motion input with `whileFocus` scale — matches icaru login fields. */
export function AuthMotionInput({
	className,
	reduceMotion,
	...props
}: React.ComponentProps<typeof motion.input> & {
	reduceMotion?: boolean | null;
}) {
	return (
		<motion.input
			className={cn(AUTH_INPUT_CLASS, className)}
			style={{ willChange: reduceMotion ? undefined : "transform" }}
			transition={{ duration: 0.2 }}
			whileFocus={reduceMotion ? undefined : { scale: 1.01 }}
			{...props}
		/>
	);
}
