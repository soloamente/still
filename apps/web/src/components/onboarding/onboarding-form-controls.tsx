"use client";

import { cn } from "@still/ui/lib/utils";
import { type HTMLMotionProps, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import {
	AUTH_INPUT_CLASS,
	AuthMotionInput,
} from "@/components/auth/auth-motion-field";

/** Textarea surface — same icaru field chrome as auth inputs. */
const ONBOARDING_TEXTAREA_CLASS = cn(
	AUTH_INPUT_CLASS,
	"min-h-[120px] resize-none py-3.25 leading-relaxed",
);

type OnboardingFieldInputProps = Omit<
	React.ComponentProps<typeof AuthMotionInput>,
	"reduceMotion"
>;

/** Single-line field on the onboarding `bg-card` wizard (auth input parity). */
export function OnboardingFieldInput({
	className,
	...props
}: OnboardingFieldInputProps) {
	const reduceMotion = useReducedMotion();
	return (
		<AuthMotionInput
			// Shared auth/onboarding input sizing already enforces mobile-safe 16px.
			className={className}
			reduceMotion={reduceMotion}
			{...props}
		/>
	);
}

type OnboardingFieldTextareaProps = Omit<
	HTMLMotionProps<"textarea">,
	"reduceMotion"
>;

/** Multi-line field — matches `OnboardingFieldInput` focus scale and surface. */
export function OnboardingFieldTextarea({
	className,
	...props
}: OnboardingFieldTextareaProps) {
	const reduceMotion = useReducedMotion();

	return (
		<motion.textarea
			className={cn(ONBOARDING_TEXTAREA_CLASS, className)}
			style={{ willChange: reduceMotion ? undefined : "transform" }}
			transition={{ duration: 0.2 }}
			whileFocus={reduceMotion ? undefined : { scale: 1.01 }}
			{...props}
		/>
	);
}

type OnboardingActionButtonProps = {
	children: ReactNode;
	className?: string;
	disabled?: boolean;
	onClick?: () => void;
	type?: "button" | "submit";
};

const onboardingPrimaryButtonClass =
	"flex cursor-pointer items-center justify-center rounded-2xl bg-foreground px-4 py-2.75 font-medium text-background transition-[background-color,opacity,transform] duration-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:hover)]:hover:bg-foreground/90";

const onboardingSecondaryButtonClass =
	"flex cursor-pointer items-center justify-center rounded-2xl bg-background px-4 py-2.75 font-medium text-foreground transition-[background-color,opacity,transform] duration-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:hover)]:hover:bg-foreground/10";

/** Nested on `bg-background` tiles — lift with `bg-card` instead of canvas. */
const onboardingSecondaryNestedButtonClass =
	"flex cursor-pointer items-center justify-center rounded-2xl bg-card px-4 py-2.75 font-medium text-foreground transition-[background-color,opacity,transform] duration-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:hover)]:hover:bg-muted/32";

/** Primary CTA — mirrors `AuthSubmitButton` geometry on the card wizard. */
export function OnboardingPrimaryButton({
	children,
	className,
	disabled,
	onClick,
	type = "button",
}: OnboardingActionButtonProps) {
	const reduceMotion = useReducedMotion();
	const isDisabled = Boolean(disabled);

	return (
		<motion.button
			className={cn(onboardingPrimaryButtonClass, className)}
			disabled={isDisabled}
			onClick={onClick}
			style={{ willChange: reduceMotion ? undefined : "transform" }}
			transition={{ duration: 0.2 }}
			type={type}
			whileHover={isDisabled || reduceMotion ? undefined : { scale: 1.01 }}
			whileTap={isDisabled || reduceMotion ? undefined : { scale: 0.98 }}
		>
			{children}
		</motion.button>
	);
}

type OnboardingSecondaryButtonProps = OnboardingActionButtonProps & {
	/** Use inside `bg-background` panels so the control stays visible. */
	nested?: boolean;
};

/** Secondary / back actions on the onboarding card. */
export function OnboardingSecondaryButton({
	children,
	className,
	disabled,
	nested = false,
	onClick,
	type = "button",
}: OnboardingSecondaryButtonProps) {
	const reduceMotion = useReducedMotion();
	const isDisabled = Boolean(disabled);

	return (
		<motion.button
			className={cn(
				nested
					? onboardingSecondaryNestedButtonClass
					: onboardingSecondaryButtonClass,
				className,
			)}
			disabled={isDisabled}
			onClick={onClick}
			style={{ willChange: reduceMotion ? undefined : "transform" }}
			transition={{ duration: 0.2 }}
			type={type}
			whileHover={isDisabled || reduceMotion ? undefined : { scale: 1.01 }}
			whileTap={isDisabled || reduceMotion ? undefined : { scale: 0.98 }}
		>
			{children}
		</motion.button>
	);
}
