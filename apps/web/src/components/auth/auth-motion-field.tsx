"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";

/**
 * Auth input surface on `bg-card` — keyboard `:focus-visible` uses theme
 * `foreground` (not `--ring` / accent orange). Scale feedback is on
 * `AuthMotionInput`.
 */
export const AUTH_INPUT_CLASS =
	"auth-input w-full rounded-2xl bg-input px-3.75 py-3.25 text-base leading-none transition-[color,box-shadow] placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground/35 focus-visible:ring-offset-2 focus-visible:ring-offset-card aria-invalid:ring-1 aria-invalid:ring-destructive/30 md:text-[15px]";

/** Stable id for `aria-describedby` on the matching auth input. */
export function authFieldErrorId(fieldName: string): string {
	return `${fieldName}-error`;
}

/** Collapsing error line under each field (icaru height + opacity animation). */
export function AuthFieldErrors({
	errors,
	id,
	className,
}: {
	errors: Array<{ message?: string } | undefined>;
	/** When set, links the message for screen readers via the input’s `aria-describedby`. */
	id?: string;
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
				{/* role=alert + id so invalid fields announce the linked message */}
				<motion.p
					animate={{ opacity: 1 }}
					className="text-center text-destructive text-sm"
					exit={{ opacity: 0 }}
					id={id}
					initial={{ opacity: 0 }}
					role="alert"
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
