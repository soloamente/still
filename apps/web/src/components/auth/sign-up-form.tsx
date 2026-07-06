"use client";

import { useForm } from "@tanstack/react-form";
import { useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { authClient } from "@/lib/auth-client";
import { clearReferralCookie, readReferralCookie } from "@/lib/referral-cookie";
import { stillApiOrigin } from "@/lib/still-api-origin";

import { Field } from "./field";

const schema = z.object({
	email: z.email("Enter a valid email"),
	password: z.string().min(8, "At least 8 characters"),
});

/** Better Auth requires a display name; onboarding collects the real one later. */
function signUpNameFromEmail(email: string): string {
	const local = email.split("@")[0]?.trim();
	if (!local) return "Patron";
	return local.slice(0, 60);
}

export function SignUpForm() {
	const router = useRouter();
	const reduceMotion = useReducedMotion();

	const form = useForm({
		defaultValues: { email: "", password: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			await authClient.signUp.email(
				{
					email: value.email,
					password: value.password,
					name: signUpNameFromEmail(value.email),
				},
				{
					onSuccess: async () => {
						const referralCode = readReferralCookie();
						if (referralCode) {
							try {
								await fetch(`${stillApiOrigin()}/api/referrals/capture`, {
									method: "POST",
									credentials: "include",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ referralCode }),
								});
							} catch (err) {
								console.error("[sign-up] referral capture failed", err);
							} finally {
								clearReferralCookie();
							}
						}
						toast.success(
							"Check your inbox to verify before sharing publicly.",
						);
						router.replace("/onboarding");
						router.refresh();
					},
					onError: (err) => {
						toast.error(err.error.message || "Could not create your account");
					},
				},
			);
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
							<Field
								autoComplete="email"
								field={field}
								label="Email"
								placeholder="Email"
								required
								spellCheck={false}
								type="email"
							/>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="password">
						{(field) => (
							<Field
								autoComplete="new-password"
								field={field}
								label="Password"
								placeholder="Password"
								required
								type="password"
							/>
						)}
					</form.Field>
				</div>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<AuthSubmitButton
							disabled={!canSubmit}
							isSubmitting={isSubmitting}
							reduceMotion={reduceMotion}
						>
							Create account
						</AuthSubmitButton>
					)}
				</form.Subscribe>

				<p className="text-pretty text-center text-muted-foreground text-xs">
					By signing up you agree to our community guidelines. <br /> We
					don&apos;t spoil films you haven&apos;t logged.
				</p>
			</form>
		</div>
	);
}
