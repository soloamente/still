import { createClient } from "@still/api-client";
import { env } from "@still/env/native";

import { authClient } from "@/lib/auth-client";

/**
 * React Native has no cookie jar, so we inject the better-auth session cookie
 * (kept in SecureStore by the Expo plugin) onto every request.
 */
const cookieFetcher: typeof fetch = ((
	input: RequestInfo | URL,
	init?: RequestInit,
) => {
	const cookie = authClient.getCookie();
	const headers = new Headers(init?.headers);
	if (cookie) headers.set("Cookie", cookie);
	return fetch(input, { ...init, headers });
}) as typeof fetch;

export const api = createClient({
	baseURL: env.EXPO_PUBLIC_SERVER_URL,
	fetcher: cookieFetcher,
});
