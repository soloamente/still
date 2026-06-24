import { classifyRoom } from "@still/realtime";

import { timingSafeEqual, verifyConnectToken } from "./auth";
import { RealtimeHub } from "./hub-do";

export { RealtimeHub };

export interface Env {
	HUB: DurableObjectNamespace;
	SERVER_ORIGIN: string;
	REALTIME_JWT_SECRET: string;
	REALTIME_INTERNAL_SECRET: string;
	ALLOWED_ORIGINS?: string;
}

function originAllowed(origin: string | null, allowedOrigins: string): boolean {
	// Dev mode: empty allowlist accepts any (or missing) origin.
	if (!allowedOrigins.trim()) return true;
	if (!origin) return false;
	return allowedOrigins
		.split(",")
		.map((s) => s.trim())
		.includes(origin);
}

function hubStub(env: Env): DurableObjectStub {
	return env.HUB.get(env.HUB.idFromName("hub"));
}

async function authorizeRoom(
	userId: string,
	room: string,
	serverOrigin: string,
	internalSecret: string,
): Promise<boolean> {
	const { tier, ownerUserId } = classifyRoom(room);
	if (tier === "allow") return true;
	if (tier === "deny") return false;
	if (tier === "self") return userId === ownerUserId;

	try {
		const res = await fetch(`${serverOrigin}/api/realtime/authorize`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${internalSecret}`,
			},
			body: JSON.stringify({ userId, room }),
		});
		if (!res.ok) return false;
		const body = (await res.json()) as { allowed?: boolean };
		return body.allowed === true;
	} catch {
		return false;
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/health") {
			return Response.json({ ok: true });
		}

		if (url.pathname === "/connect") {
			const origin = request.headers.get("Origin");
			if (!originAllowed(origin, env.ALLOWED_ORIGINS ?? "")) {
				return new Response("Forbidden", { status: 403 });
			}

			const token = url.searchParams.get("token");
			if (!token) return new Response("Missing token", { status: 401 });

			const claims = await verifyConnectToken(token, env.REALTIME_JWT_SECRET);
			if (!claims) return new Response("Invalid token", { status: 401 });

			const userId = claims.sub;
			const requestedRooms = (url.searchParams.get("rooms") ?? "")
				.split(",")
				.filter(Boolean);

			const results = await Promise.all(
				requestedRooms.map((room) =>
					authorizeRoom(
						userId,
						room,
						env.SERVER_ORIGIN,
						env.REALTIME_INTERNAL_SECRET,
					),
				),
			);
			const authorizedRooms = requestedRooms.filter((_, i) => results[i]);

			const doUrl = new URL("/connect", "http://do-internal");
			doUrl.searchParams.set("userId", userId);
			doUrl.searchParams.set("rooms", authorizedRooms.join(","));

			return hubStub(env).fetch(
				new Request(doUrl.toString(), {
					headers: request.headers,
					method: request.method,
				}),
			);
		}

		if (url.pathname === "/publish" && request.method === "POST") {
			const auth = request.headers.get("Authorization");
			if (
				!auth ||
				!timingSafeEqual(auth, `Bearer ${env.REALTIME_INTERNAL_SECRET}`)
			) {
				return new Response("Unauthorized", { status: 401 });
			}
			return hubStub(env).fetch(
				new Request("http://do-internal/publish", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: request.body,
				}),
			);
		}

		if (url.pathname === "/occupancy" && request.method === "GET") {
			const auth = request.headers.get("Authorization");
			if (
				!auth ||
				!timingSafeEqual(auth, `Bearer ${env.REALTIME_INTERNAL_SECRET}`)
			) {
				return new Response("Unauthorized", { status: 401 });
			}
			const room = url.searchParams.get("room") ?? "";
			return hubStub(env).fetch(
				new Request(
					`http://do-internal/occupancy?room=${encodeURIComponent(room)}`,
				),
			);
		}

		return new Response("Not Found", { status: 404 });
	},
};
