"use client";

import { useForm } from "@tanstack/react-form";

import Link from "next/link";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { useOptionalAuthLegalDrawer } from "@/components/auth/auth-legal-drawer";
import { SignaturePad } from "@/components/auth/signature-pad";
import { authClient } from "@/lib/auth-client";
import { clearReferralCookie, readReferralCookie } from "@/lib/referral-cookie";
import { stillApiOrigin } from "@/lib/still-api-origin";

import { Field } from "./field";

const fieldsSchema = z.object({
	email: z.email("Enter a valid email"),
	password: z.string().min(8, "At least 8 characters"),
});

const schema = fieldsSchema.extend({
	acceptedLegal: z.literal(true, {
		error: "Sign to accept the Terms and Privacy Policy",
	}),
});

/** Better Auth requires a display name; onboarding collects the real one later. */
function signUpNameFromEmail(email: string): string {
	const local = email.split("@")[0]?.trim();
	if (!local) return "Patron";
	return local.slice(0, 60);
}

export function SignUpForm() {
	const router = useRouter();
	const legalDrawer = useOptionalAuthLegalDrawer();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
			// Unsigned until the pad folds after a signature.
			acceptedLegal: false as boolean,
		},
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

				<p className="text-pretty text-center text-muted-foreground text-sm leading-snug">
					Sign to accept the{" "}
					{legalDrawer ? (
						<button
							type="button"
							className="text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
							onClick={() => legalDrawer.openPolicy("terms")}
						>
							Terms
						</button>
					) : (
						<Link
							href="/terms"
							className="text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
						>
							Terms
						</Link>
					)}{" "}
					and{" "}
					{legalDrawer ? (
						<button
							type="button"
							className="text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
							onClick={() => legalDrawer.openPolicy("privacy")}
						>
							Privacy Policy
						</button>
					) : (
						<Link
							href="/privacy"
							className="text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
						>
							Privacy Policy
						</Link>
					)}
					.
				</p>

				<form.Subscribe
					selector={(state) => ({
						isSubmitting: state.isSubmitting,
						email: state.values.email,
						password: state.values.password,
					})}
				>
					{({ isSubmitting, email, password }) => {
						const fieldsOk = fieldsSchema.safeParse({
							email,
							password,
						}).success;
						return (
							<form.Field name="acceptedLegal">
								{(field) => (
									<SignaturePad
										asCreateAccount
										canStart={fieldsOk}
										isSubmitting={isSubmitting}
										onRequestStart={() => {
											const parsed = fieldsSchema.safeParse({
												email,
												password,
											});
											if (!parsed.success) {
												const message =
													parsed.error.issues[0]?.message ??
													"Check your email and password";
												toast.error(message);
												return false;
											}
											return true;
										}}
										onSignedChange={(signed) => {
											field.handleChange(signed);
											if (signed) field.handleBlur();
										}}
									/>
								)}
							</form.Field>
						);
					}}
				</form.Subscribe>
			</form>
		</div>
	);
}
