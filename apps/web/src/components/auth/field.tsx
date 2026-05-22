"use client";

import { cn } from "@still/ui/lib/utils";
import type { AnyFieldApi } from "@tanstack/react-form";
import { useReducedMotion } from "motion/react";
import type * as React from "react";
import {
	AuthFieldErrors,
	AuthMotionInput,
} from "@/components/auth/auth-motion-field";

/**
 * Sign-up field: icaru input styling. Uses a visible label when `showLabel` (handle hints);
 * otherwise sr-only label + placeholder like login.
 */
export function Field({
	field,
	label,
	helper,
	hint,
	showLabel = false,
	className,
	inputClassName,
	placeholder,
	...input
}: {
	field: AnyFieldApi;
	label: string;
	helper?: React.ReactNode;
	hint?: string;
	showLabel?: boolean;
	className?: string;
	inputClassName?: string;
	placeholder?: string;
} & Pick<
	React.ComponentPropsWithoutRef<"input">,
	| "type"
	| "autoComplete"
	| "autoCapitalize"
	| "disabled"
	| "readOnly"
	| "required"
	| "spellCheck"
	| "inputMode"
	| "maxLength"
	| "minLength"
	| "pattern"
>) {
	const reduceMotion = useReducedMotion();
	const errorMessage = field.state.meta.errors.find(Boolean) as
		| { message?: string }
		| undefined;

	return (
		<div className={cn(className)}>
			{showLabel ? (
				<div className="mb-2 flex items-baseline justify-between gap-2">
					<label
						className="font-medium text-foreground text-sm"
						htmlFor={field.name}
					>
						{label}
					</label>
					{hint ? (
						<span className="text-muted-foreground text-xs">{hint}</span>
					) : null}
				</div>
			) : (
				<label className="sr-only" htmlFor={field.name}>
					{label}
				</label>
			)}
			<AuthMotionInput
				aria-invalid={errorMessage ? true : undefined}
				className={inputClassName}
				id={field.name}
				name={field.name}
				onBlur={field.handleBlur}
				onChange={(e) => field.handleChange(e.target.value)}
				placeholder={placeholder ?? label}
				reduceMotion={reduceMotion}
				value={field.state.value as string}
				{...input}
			/>
			{errorMessage ? (
				<AuthFieldErrors errors={field.state.meta.errors} />
			) : helper ? (
				<div className="mt-1 min-h-4 text-muted-foreground text-xs">
					{helper}
				</div>
			) : null}
		</div>
	);
}
