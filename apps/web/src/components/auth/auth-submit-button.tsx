"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { Spinner } from "@/components/ui/spinner";

/** Primary auth CTA — icaru `motion.button` styling + spinner ↔ label swap. */
export function AuthSubmitButton({
	isSubmitting,
	disabled,
	reduceMotion,
	children,
	className,
}: {
	isSubmitting: boolean;
	disabled?: boolean;
	reduceMotion?: boolean | null;
	children: React.ReactNode;
	className?: string;
}) {
	const isDisabled = Boolean(disabled);

	return (
		<motion.button
			className={cn(
				"active:!bg-foreground active:!text-background flex w-full cursor-pointer items-center justify-center rounded-2xl bg-foreground px-4 py-2.75 font-medium text-background transition-[background-color,opacity,transform] duration-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:hover)]:hover:bg-foreground/90",
				className,
			)}
			disabled={isDisabled}
			style={{ willChange: reduceMotion ? undefined : "transform" }}
			transition={{ duration: 0.2 }}
			type="submit"
			whileHover={isDisabled || reduceMotion ? undefined : { scale: 1.01 }}
			whileTap={isDisabled || reduceMotion ? undefined : { scale: 0.98 }}
		>
			<div className="flex h-5 items-center justify-center">
				<AnimatePresence initial={false} mode="wait">
					{isSubmitting ? (
						<motion.div
							animate={{ opacity: 1, scale: 1 }}
							className="flex items-center justify-center"
							exit={{ opacity: 0, scale: 0.8 }}
							initial={{ opacity: 0, scale: 0.8 }}
							key="spinner"
							transition={{ duration: 0.2 }}
						>
							<Spinner className="text-background" size={16} />
						</motion.div>
					) : (
						<motion.span
							animate={{ opacity: 1, scale: 1 }}
							className="leading-none"
							exit={{ opacity: 0, scale: 0.8 }}
							initial={{ opacity: 0, scale: 0.8 }}
							key="text"
							transition={{ duration: 0.2 }}
						>
							{children}
						</motion.span>
					)}
				</AnimatePresence>
			</div>
		</motion.button>
	);
}
