"use client";

import { useForm } from "@tanstack/react-form";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import {
	AuthFieldErrors,
	AuthMotionInput,
} from "@/components/auth/auth-motion-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { authClient } from "@/lib/auth-client";

const schema = z
	.object({
		password: z.string().min(8, "At least 8 characters"),
		confirmPassword: z.string().min(8, "At least 8 characters"),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

/** Shown when the reset token is missing or Better Auth flagged it invalid. */
function ResetPasswordInvalidPanel() {
	return (
		<div className="mx-auto w-full min-w-0 max-w-sm space-y-4">
			<motion.p
				animate={{ opacity: 1 }}
				className="text-center text-destructive text-sm"
				initial={{ opacity: 0 }}
				transition={{ duration: 0.2 }}
			>
				This reset link is invalid or has expired.
			</motion.p>
			<p className="text-center text-muted-foreground text-sm">
				<Link
					className="font-medium text-foreground underline-offset-4 hover:underline"
					href="/forgot-password"
				>
					Request a new link
				</Link>
			</p>
		</div>
	);
}

function ResetPasswordFormFields({ token }: { token: string }) {
	const router = useRouter();
	const reduceMotion = useReducedMotion();
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { password: "", confirmPassword: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			setServerError(null);
			const { error } = await authClient.resetPassword({
				newPassword: value.password,
				token,
			});
			if (error) {
				const message = error.message || "Could not reset your password";
				setServerError(message);
				toast.error(message);
				return;
			}
			toast.success("Password updated");
			router.replace("/sign-in");
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
					<form.Field name="password">
						{(field) => (
							<div>
								<label className="sr-only" htmlFor={field.name}>
									New password
								</label>
								<AuthMotionInput
									autoComplete="new-password"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="New password"
									reduceMotion={reduceMotion}
									type="password"
									value={field.state.value}
								/>
								<AuthFieldErrors errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="confirmPassword">
						{(field) => (
							<div>
								<label className="sr-only" htmlFor={field.name}>
									Confirm password
								</label>
								<AuthMotionInput
									autoComplete="new-password"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Confirm password"
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
						password: state.values.password,
						confirmPassword: state.values.confirmPassword,
					})}
				>
					{({ canSubmit, isSubmitting, password, confirmPassword }) => {
						const isPasswordEmpty = !password || password.trim() === "";
						const isConfirmEmpty =
							!confirmPassword || confirmPassword.trim() === "";
						const isDisabled =
							!canSubmit || isSubmitting || isPasswordEmpty || isConfirmEmpty;

						return (
							<AuthSubmitButton
								disabled={isDisabled}
								isSubmitting={isSubmitting}
								reduceMotion={reduceMotion}
							>
								Update password
							</AuthSubmitButton>
						);
					}}
				</form.Subscribe>
			</form>
		</div>
	);
}

/** Reads `?token=` / `?error=` from the reset email redirect. */
function ResetPasswordFormInner() {
	const searchParams = useSearchParams();
	const token = searchParams.get("token");
	const error = searchParams.get("error");
	const isInvalid = error === "INVALID_TOKEN" || !token;

	if (isInvalid) {
		return <ResetPasswordInvalidPanel />;
	}

	return <ResetPasswordFormFields token={token} />;
}

/** Suspense wrapper — `useSearchParams` must not run outside a boundary. */
export function ResetPasswordForm() {
	return (
		<Suspense fallback={null}>
			<ResetPasswordFormInner />
		</Suspense>
	);
}
