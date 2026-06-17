"use client";

import { Button } from "@still/ui/components/button";
import { useEffect } from "react";

/** Onboarding lives outside `(app)` — catch taste-step crashes without taking down the whole app. */
export default function OnboardingError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("[onboarding] caught error", error);
	}, [error]);

	return (
		<div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center">
			<h1 className="font-display text-4xl tracking-[-0.02em]">
				Something stalled.
			</h1>
			<p className="mt-2 text-muted-foreground">
				We logged it. Try again — you can pick up where you left off.
			</p>
			<div className="mt-6 flex justify-center gap-2">
				<Button variant="accent" size="pill" onClick={reset}>
					Try again
				</Button>
			</div>
		</div>
	);
}
