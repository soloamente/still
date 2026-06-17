/** Patron inbox SSE invalidation — lightweight pub/sub between subscriber and bell. */
type InboxLiveListener = () => void;

const listeners = new Set<InboxLiveListener>();

/** Register a refetch handler; returns unsubscribe. */
export function subscribeNotificationsInboxLive(
	listener: InboxLiveListener,
): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Notify inbox consumers that a new notification row was pushed over SSE. */
export function emitNotificationsInboxLive(): void {
	for (const listener of listeners) {
		listener();
	}
}
