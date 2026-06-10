"use client";

import { useForm } from "@tanstack/react-form";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import {
	AuthFieldErrors,
	AuthMotionInput,
} from "@/components/auth/auth-motion-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

import { authClient } from "@/lib/auth-client";

const schema = z.object({
	email: z.email("Enter a valid email"),
	password: z.string().min(8, "At least 8 characters"),
});

export function SignInForm({ redirectTo = "/home" }: { redirectTo?: string }) {
	const router = useRouter();
	const reduceMotion = useReducedMotion();
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { email: "", password: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			setServerError(null);
			await authClient.signIn.email(value, {
				onSuccess: () => {
					toast.success("Welcome back");
					router.replace(redirectTo);
					router.refresh();
				},
				onError: (err) => {
					const message = err.error.message || "Could not sign you in";
					setServerError(message);
					toast.error(message);
				},
			});
		},
	});

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

				<div>
					<form.Field name="password">
						{(field) => (
							<div>
								<label className="sr-only" htmlFor={field.name}>
									Password
								</label>
								<AuthMotionInput
									autoComplete="current-password"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Password"
									reduceMotion={reduceMotion}
									type="password"
									value={field.state.value}
								/>
								<AuthFieldErrors errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
				</div>

				<AnimatePresence mode="wait">
					{serverError ? (
						<motion.div
							animate={{ opacity: 1, height: "auto", marginTop: 4 }}
							className="overflow-hidden"
							exit={{ opacity: 0, height: 0, marginTop: 0 }}
							initial={{ opacity: 0, height: 0, marginTop: 0 }}
							key={serverError}
							transition={{ duration: 0.2 }}
						>
							<motion.p
								animate={{ opacity: 1 }}
								className="text-center text-destructive text-sm"
								exit={{ opacity: 0 }}
								initial={{ opacity: 0 }}
								transition={{ duration: 0.15 }}
							>
								{serverError}
							</motion.p>
						</motion.div>
					) : null}
				</AnimatePresence>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
						email: state.values.email,
						password: state.values.password,
					})}
				>
					{({ canSubmit, isSubmitting, email, password }) => {
						const isEmailEmpty = !email || email.trim() === "";
						const isPasswordEmpty = !password || password.trim() === "";
						const isDisabled =
							!canSubmit || isSubmitting || isEmailEmpty || isPasswordEmpty;

						return (
							<AuthSubmitButton
								disabled={isDisabled}
								isSubmitting={isSubmitting}
								reduceMotion={reduceMotion}
							>
								Sign in
							</AuthSubmitButton>
						);
					}}
				</form.Subscribe>
			</form>
		</div>
	);
}
