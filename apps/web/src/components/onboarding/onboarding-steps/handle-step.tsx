"use client";

import { cn } from "@still/ui/lib/utils";
import { useEffect, useState } from "react";

import { OnboardingFieldInput } from "@/components/onboarding/onboarding-form-controls";
import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";
import {
	HANDLE_RE,
	isOwnSavedHandle,
	normalizeHandleInput,
} from "@/lib/onboarding-handle";
import { fetchProfileHandleAvailable } from "@/lib/still-api-fetch";

type HandleAvailability =
	| { state: "idle" }
	| { state: "checking" }
	| { state: "available" }
	| { state: "taken" }
	| { state: "invalid" };

/** Live @handle availability for the wizard continue gate. */
export function useHandleAvailability(
	handle: string,
	savedHandle?: string,
): HandleAvailability {
	const [availability, setAvailability] = useState<HandleAvailability>({
		state: "idle",
	});

	useEffect(() => {
		const trimmed = normalizeHandleInput(handle);
		if (!trimmed) {
			setAvailability({ state: "idle" });
			return;
		}
		if (!HANDLE_RE.test(trimmed)) {
			setAvailability({ state: "invalid" });
			return;
		}
		if (isOwnSavedHandle(trimmed, savedHandle)) {
			setAvailability({ state: "available" });
			return;
		}

		setAvailability({ state: "checking" });
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchProfileHandleAvailable(trimmed, {
					signal: ctrl.signal,
				});
				if (ctrl.signal.aborted) return;
				const data = res.data as { available: boolean } | null;
				if (!data) {
					setAvailability({ state: "idle" });
					return;
				}
				setAvailability({
					state: data.available ? "available" : "taken",
				});
			} catch {
				if (!ctrl.signal.aborted) setAvailability({ state: "idle" });
			}
		}, 250);

		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [handle, savedHandle]);

	return availability;
}

type HandleStepProps = {
	handle: string;
	onHandleChange: (value: string) => void;
	onFocus?: () => void;
	onBlur?: (value: string) => void;
	availability: HandleAvailability;
};

/** Step 3 — public @handle with live availability check. */
export function HandleStep({
	handle,
	onHandleChange,
	onFocus,
	onBlur,
	availability,
}: HandleStepProps) {
	const helper =
		availability.state === "checking"
			? "Checking availability…"
			: availability.state === "available"
				? `@${normalizeHandleInput(handle)} is yours`
				: availability.state === "taken"
					? "Handle is taken"
					: availability.state === "invalid"
						? "Use a–z, 0–9, . _ -"
						: "Lowercase, 2–24 characters. This is your public URL.";

	const helperClass = cn(
		"mt-2 min-h-4 text-center text-xs",
		availability.state === "available" && "text-emerald-500",
		(availability.state === "taken" || availability.state === "invalid") &&
			"text-destructive",
		(availability.state === "idle" || availability.state === "checking") &&
			"text-muted-foreground",
	);

	return (
		<div className="flex flex-col gap-8">
			<OnboardingStepHeader
				description="This is the username people will use to find you."
				title="How would you like to be called?"
			/>

			<div>
				<OnboardingFieldInput
					autoCapitalize="none"
					autoComplete="username"
					onBlur={(e) => onBlur?.(e.target.value)}
					onChange={(e) => onHandleChange(normalizeHandleInput(e.target.value))}
					onFocus={onFocus}
					placeholder="handle"
					spellCheck={false}
					value={handle}
				/>
				<p className={helperClass}>{helper}</p>
			</div>
		</div>
	);
}

export function isHandleStepReady(
	handle: string,
	availability: HandleAvailability,
): boolean {
	const trimmed = normalizeHandleInput(handle);
	if (!HANDLE_RE.test(trimmed)) return false;
	if (availability.state === "checking" || availability.state === "taken") {
		return false;
	}
	return trimmed.length >= 2;
}
