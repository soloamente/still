import { auth } from "@still/auth";
import { chatMember, db } from "@still/db";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { routeBody } from "../lib/route-body";
import { broadcast, setTyping, subscribe } from "./hub";

const wsChatMessageBody = t.Object({
	kind: t.Union([
		t.Literal("join"),
		t.Literal("leave"),
		t.Literal("typing"),
		t.Literal("ping"),
	]),
	threadId: t.Optional(t.String()),
	isTyping: t.Optional(t.Boolean()),
});

type WsChatMessage = {
	kind: "join" | "leave" | "typing" | "ping";
	threadId?: string;
	isTyping?: boolean;
};

/**
 * /ws/chat — single socket per client; the client tells the server
 * which thread(s) it cares about via {kind:'join', threadId}. Auth is
 * resolved on upgrade by reading the Better Auth cookie off the
 * upgrade request. Failing to auth closes the socket politely.
 */
export const wsRoute = new Elysia({ tags: ["ws"] }).ws("/ws/chat", {
	body: wsChatMessageBody,
	async beforeHandle({ request, status, set }) {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			set.status = 401;
			return status(401, "Unauthorized");
		}
		// Stash on the request so `open` can read it. Elysia doesn't yet expose
		// a typed extension point for upgrade-time state, so we attach to a
		// side bag and read it via a cast in `open`.
		(request as unknown as { __userId?: string }).__userId = session.user.id;
	},
	open(ws) {
		const userId = (ws.data.request as unknown as { __userId?: string })
			.__userId;
		if (!userId) {
			ws.close();
			return;
		}
		(
			ws.data as unknown as {
				store: { userId: string; joined: Map<string, () => void> };
			}
		).store = { userId, joined: new Map<string, () => void>() };
	},
	async message(ws, rawMsg) {
		const store = (
			ws.data as unknown as {
				store?: { userId: string; joined: Map<string, () => void> };
			}
		).store;
		if (!store) return;

		// Vercel's Elysia WS pass does not infer message body from `body` schema.
		const msg = routeBody<WsChatMessage>(rawMsg);

		if (msg.kind === "ping") {
			ws.send({ kind: "pong" });
			return;
		}

		if (msg.kind === "join" && msg.threadId) {
			const [member] = await db
				.select()
				.from(chatMember)
				.where(
					and(
						eq(chatMember.threadId, msg.threadId),
						eq(chatMember.userId, store.userId),
					),
				)
				.limit(1);
			if (!member) {
				ws.send({ kind: "error", reason: "not_a_member" });
				return;
			}
			if (store.joined.has(msg.threadId)) return;
			const unsubscribe = subscribe(msg.threadId, (payload) =>
				ws.send(payload),
			);
			store.joined.set(msg.threadId, unsubscribe);
			ws.send({ kind: "joined", threadId: msg.threadId });
			return;
		}

		if (msg.kind === "leave" && msg.threadId) {
			const unsubscribe = store.joined.get(msg.threadId);
			unsubscribe?.();
			store.joined.delete(msg.threadId);
			return;
		}

		if (msg.kind === "typing" && msg.threadId) {
			setTyping(store.userId, msg.threadId, Boolean(msg.isTyping));
			return;
		}
	},
	close(ws) {
		const store = (
			ws.data as unknown as {
				store?: { userId: string; joined: Map<string, () => void> };
			}
		).store;
		if (!store) return;
		for (const [threadId, unsubscribe] of store.joined) {
			unsubscribe();
			// Clear typing on disconnect.
			setTyping(store.userId, threadId, false);
		}
		store.joined.clear();
	},
});

// Re-export so route files can publish without importing the WS route directly.
export { broadcast };
