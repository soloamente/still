import "server-only";

import type { RealtimeEvent } from "@still/realtime";

type DevBusListener = (roomId: string, event: RealtimeEvent) => void;

type DevBus = {
	listeners: Set<DevBusListener>;
	emit: (roomId: string, event: RealtimeEvent) => void;
	subscribe: (listener: DevBusListener) => () => void;
};

/** Survive Next.js dev HMR — one in-process bus per Node worker. */
const globalForDevBus = globalThis as typeof globalThis & {
	__stillRealtimeDevBus?: DevBus;
};

function getDevBus(): DevBus {
	if (!globalForDevBus.__stillRealtimeDevBus) {
		const listeners = new Set<DevBusListener>();
		globalForDevBus.__stillRealtimeDevBus = {
			listeners,
			emit(roomId, event) {
				for (const listener of listeners) {
					listener(roomId, event);
				}
			},
			subscribe(listener) {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			},
		};
	}
	return globalForDevBus.__stillRealtimeDevBus;
}

/** Local dev fallback when Upstash env is unset — Elysia POSTs via `/api/realtime/dev-relay`. */
export function emitRealtimeDevBusEvent(
	roomId: string,
	event: RealtimeEvent,
): void {
	getDevBus().emit(roomId, event);
}

/** SSE stream route subscribes here instead of Redis when `shouldUseRealtimeDevBus()`. */
export function subscribeRealtimeDevBus(listener: DevBusListener): () => void {
	return getDevBus().subscribe(listener);
}

/** True when SSE should use the in-process dev bus instead of Upstash. */
export function shouldUseRealtimeDevBus(): boolean {
	return (
		process.env.NODE_ENV === "development" &&
		!process.env.UPSTASH_REDIS_REST_URL?.trim()
	);
}
