"use client";

import { useForm } from "@tanstack/react-form";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import z from "zod";
import {
	AuthFieldErrors,
	AuthMotionInput,
} from "@/components/auth/auth-motion-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { authClient } from "@/lib/auth-client";

const schema = z.object({
	email: z.email("Enter a valid email"),
});

/**
 * Request a password-reset email. Always shows neutral success copy so we do not
 * reveal whether the address exists in our system.
 */
export function ForgotPasswordForm() {
	const reduceMotion = useReducedMotion();
	const [submitted, setSubmitted] = useState(false);

	const form = useForm({
		defaultValues: { email: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			try {
				await authClient.requestPasswordReset({
					email: value.email,
					redirectTo: "/reset-password",
				});
			} catch {
				// Still show neutral success — avoids email enumeration on network errors too.
			}
			setSubmitted(true);
		},
	});

	if (submitted) {
		return (
			<div className="mx-auto w-full min-w-0 max-w-sm">
				<motion.p
					animate={{ opacity: 1 }}
					className="text-pretty text-center text-muted-foreground text-sm"
					initial={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
				>
					If that email exists, we sent a link.
				</motion.p>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full min-w-0 max-w-sm">
			<form
				className="space-y-3"
				noValidate
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div>
					<form.Field name="email">
						{(field) => (
							<div>
								<label className="sr-only" htmlFor={field.name}>
									Email
								</label>
								<AuthMotionInput
									autoComplete="email"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Email"
									reduceMotion={reduceMotion}
									spellCheck={false}
									type="email"
									value={field.state.value}
								/>
								<AuthFieldErrors errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
				</div>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
						email: state.values.email,
					})}
				>
					{({ canSubmit, isSubmitting, email }) => {
						const isEmailEmpty = !email || email.trim() === "";
						const isDisabled = !canSubmit || isSubmitting || isEmailEmpty;

						return (
							<AuthSubmitButton
								disabled={isDisabled}
								isSubmitting={isSubmitting}
								reduceMotion={reduceMotion}
							>
								Send reset link
							</AuthSubmitButton>
						);
					}}
				</form.Subscribe>
			</form>
		</div>
	);
}
