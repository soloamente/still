"use client";

import { cn } from "@still/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import {
	AuthFieldErrors,
	AuthMotionInput,
} from "@/components/auth/auth-motion-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { fetchProfileHandleAvailable } from "@/lib/still-api-fetch";

import { Field } from "./field";

const HANDLE_RE = /^[a-z0-9._-]{2,24}$/;

const schema = z.object({
	name: z.string().min(2, "At least 2 characters").max(60),
	handle: z
		.string()
		.min(2, "At least 2 characters")
		.max(24, "Max 24 characters")
		.regex(HANDLE_RE, "Use lowercase letters, numbers, . _ -"),
	email: z.email("Enter a valid email"),
	password: z.string().min(8, "At least 8 characters"),
});

type HandleStatus =
	| { state: "idle" }
	| { state: "checking" }
	| { state: "available" }
	| { state: "taken" }
	| { state: "invalid" };

export function SignUpForm() {
	const router = useRouter();
	const reduceMotion = useReducedMotion();
	const [handleStatus, setHandleStatus] = useState<HandleStatus>({
		state: "idle",
	});
	const [handleValue, setHandleValue] = useState("");

	useEffect(() => {
		const trimmed = handleValue.trim().toLowerCase();
		if (!trimmed) {
			setHandleStatus({ state: "idle" });
			return;
		}
		if (!HANDLE_RE.test(trimmed)) {
			setHandleStatus({ state: "invalid" });
			return;
		}
		setHandleStatus({ state: "checking" });
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchProfileHandleAvailable(trimmed, {
					signal: ctrl.signal,
				});
				if (ctrl.signal.aborted) return;
				const data = res.data as { available: boolean; reason: string } | null;
				if (!data) return setHandleStatus({ state: "idle" });
				setHandleStatus({
					state: data.available ? "available" : "taken",
				});
			} catch {
				if (!ctrl.signal.aborted) setHandleStatus({ state: "idle" });
			}
		}, 250);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [handleValue]);

	const form = useForm({
		defaultValues: { name: "", handle: "", email: "", password: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			const handle = value.handle.toLowerCase();
			await authClient.signUp.email(
				{ email: value.email, password: value.password, name: value.name },
				{
					onSuccess: async () => {
						try {
							await api.api.profiles.me.patch({
								handle,
								displayName: value.name,
							});
						} catch (err) {
							console.error("[sign-up] profile bootstrap failed", err);
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
					<form.Field name="name">
						{(field) => (
							<Field
								autoComplete="name"
								field={field}
								label="Display name"
								placeholder="Display name"
								required
							/>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="handle">
						{(field) => {
							const errorMessage = field.state.meta.errors.find(Boolean) as
								| { message?: string }
								| undefined;
							const helper =
								handleStatus.state === "checking"
									? "Checking availability…"
									: handleStatus.state === "available"
										? `still.app/@${handleValue} is yours`
										: handleStatus.state === "taken"
											? "Handle is taken"
											: handleStatus.state === "invalid"
												? "Use a–z, 0–9, . _ -"
												: "Lowercase, 2–24 characters. This is your public URL.";
							const helperClass =
								handleStatus.state === "taken" ||
								handleStatus.state === "invalid"
									? "text-destructive"
									: "text-muted-foreground";

							return (
								<div>
									<label className="sr-only" htmlFor={field.name}>
										Handle
									</label>
									<AuthMotionInput
										autoCapitalize="none"
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => {
											const next = e.target.value
												.toLowerCase()
												.replace(/\s+/g, "");
											field.handleChange(next);
											setHandleValue(next);
										}}
										placeholder="Handle"
										reduceMotion={reduceMotion}
										required
										spellCheck={false}
										value={field.state.value}
									/>
									{errorMessage ? (
										<AuthFieldErrors errors={field.state.meta.errors} />
									) : (
										<p
											className={cn(
												"mt-1 min-h-4 text-center text-xs",
												helperClass,
											)}
										>
											{helper}
										</p>
									)}
								</div>
							);
						}}
					</form.Field>
				</div>

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
							disabled={!canSubmit || handleStatus.state === "taken"}
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
