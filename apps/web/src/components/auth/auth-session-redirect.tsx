"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Sends signed-in visitors away from auth routes. Isolated so `useSearchParams`
 * sits inside a Suspense boundary (required for static prerender of `/sign-in`).
 */
function AuthSessionRedirectInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { data: session, isPending } = authClient.useSession();

	const from = searchParams.get("from");
	const redirectTo =
		typeof from === "string" && from.startsWith("/") ? from : "/home";

	useEffect(() => {
		if (isPending) return;
		if (session) {
			router.replace(redirectTo);
		}
	}, [isPending, redirectTo, router, session]);

	return null;
}

/** Suspense wrapper — parent pages must not call `useSearchParams` directly. */
export function AuthSessionRedirect() {
	return (
		<Suspense fallback={null}>
			<AuthSessionRedirectInner />
		</Suspense>
	);
}
