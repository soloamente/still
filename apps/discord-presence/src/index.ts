import { authorizeInternal } from "./auth";
import type { Env } from "./env";
import { DiscordGateway } from "./gateway-do";

export type { Env };
export { authorizeInternal, DiscordGateway };

const USERS_PATH = /^\/v1\/users\/([^/]+)$/;

function gatewayStub(env: Env): DurableObjectStub<DiscordGateway> {
	const namespace =
		env.DISCORD_GATEWAY as DurableObjectNamespace<DiscordGateway> & {
			getByName?: (name: string) => DurableObjectStub<DiscordGateway>;
		};
	if (typeof namespace.getByName === "function") {
		return namespace.getByName("gateway");
	}
	return namespace.get(namespace.idFromName("gateway"));
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/health" && request.method === "GET") {
			const stub = gatewayStub(env);
			const gateway = await stub.getGatewayStatus();
			return Response.json({ ok: true, gateway });
		}

		if (url.pathname === "/internal/ensure" && request.method === "POST") {
			if (!authorizeInternal(request, env.DISCORD_PRESENCE_INTERNAL_SECRET)) {
				return new Response("Unauthorized", { status: 401 });
			}
			const stub = gatewayStub(env);
			await stub.ensureConnected();
			return Response.json({ ok: true });
		}

		const usersMatch = USERS_PATH.exec(url.pathname);
		if (usersMatch && request.method === "GET") {
			if (!authorizeInternal(request, env.DISCORD_PRESENCE_INTERNAL_SECRET)) {
				return new Response("Unauthorized", { status: 401 });
			}
			const discordUserId = decodeURIComponent(usersMatch[1] ?? "");
			const stub = gatewayStub(env);
			const data = await stub.getPresence(discordUserId);
			return Response.json({ success: true, data });
		}

		return new Response("Not Found", { status: 404 });
	},
};
