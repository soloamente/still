"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import type { NotificationPreviewRow } from "@/components/notifications/notifications-dropdown-panel";
import { api } from "@/lib/api";
import { subscribeNotificationsInboxLive } from "@/lib/notifications-inbox-live";
import {
	computeNotificationsUnreadCount,
	decrementUnread,
	NOTIFICATIONS_INBOX_FETCH_LIMIT,
	NOTIFICATIONS_INBOX_POLL_INTERVAL_MS,
	shouldRunNotificationsInboxPoll,
} from "@/lib/notifications-inbox-poll";
import {
	fetchNotificationsUnreadCount,
	postNotificationRead,
} from "@/lib/still-api-fetch";

export type NotificationsInboxContextValue = {
	rows: NotificationPreviewRow[];
	unreadCount: number;
	loading: boolean;
	refresh: () => Promise<void>;
	markOneRead: (row: NotificationPreviewRow) => Promise<void>;
	markAllRead: () => Promise<void>;
};

const NotificationsInboxContext =
	createContext<NotificationsInboxContextValue | null>(null);

/** Patron inbox state — shared across bell surfaces, mobile tab, and /notifications. */
export function NotificationsInboxProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [rows, setRows] = useState<NotificationPreviewRow[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(false);
	const inFlight = useRef(new Set<string>());
	const rowsRef = useRef(rows);
	rowsRef.current = rows;

	const fetchNotifications = useCallback(async () => {
		const res = await api.api.notifications.get({
			query: { limit: String(NOTIFICATIONS_INBOX_FETCH_LIMIT) },
		});
		return (res.data as unknown as NotificationPreviewRow[]) ?? [];
	}, []);

	const refresh = useCallback(async () => {
		if (rowsRef.current.length === 0) setLoading(true);
		try {
			const data = await fetchNotifications();
			setRows(data);
			setUnreadCount(computeNotificationsUnreadCount(data));
		} catch {
			// Keep last good inbox on transient failure.
		} finally {
			setLoading(false);
		}
	}, [fetchNotifications]);

	useEffect(() => {
		let cancelled = false;

		const loadCount = async () => {
			try {
				const count = await fetchNotificationsUnreadCount();
				if (!cancelled) setUnreadCount(count);
			} catch {
				// Best-effort — keep last known count on transient failure.
			}
		};

		void loadCount();

		// SSE invalidation is primary; this poll is just a slow safety net.
		let timer: ReturnType<typeof setInterval> | null = null;
		const startPoll = () => {
			if (timer != null) return;
			timer = setInterval(() => {
				if (shouldRunNotificationsInboxPoll(document.visibilityState)) {
					void loadCount();
				}
			}, NOTIFICATIONS_INBOX_POLL_INTERVAL_MS);
		};
		const stopPoll = () => {
			if (timer == null) return;
			clearInterval(timer);
			timer = null;
		};

		if (shouldRunNotificationsInboxPoll(document.visibilityState)) startPoll();

		const onVisibility = () => {
			if (document.visibilityState === "visible") {
				void loadCount();
				startPoll();
			} else {
				stopPoll();
			}
		};
		document.addEventListener("visibilitychange", onVisibility);

		const unsubLive = subscribeNotificationsInboxLive(() => {
			if (shouldRunNotificationsInboxPoll(document.visibilityState)) {
				void loadCount();
			}
		});

		return () => {
			cancelled = true;
			stopPoll();
			unsubLive();
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, []);

	const markOneRead = useCallback(async (row: NotificationPreviewRow) => {
		if (row.readAt || inFlight.current.has(row.id)) return;
		inFlight.current.add(row.id);
		const previousReadAt = row.readAt;
		setRows((prev) =>
			prev.map((r) =>
				r.id === row.id ? { ...r, readAt: new Date().toISOString() } : r,
			),
		);
		if (!previousReadAt) setUnreadCount((c) => decrementUnread(c));
		const res = await postNotificationRead(row.id);
		if (!res.ok) {
			setRows((prev) =>
				prev.map((r) =>
					r.id === row.id ? { ...r, readAt: previousReadAt } : r,
				),
			);
			if (!previousReadAt) setUnreadCount((c) => c + 1);
		}
		inFlight.current.delete(row.id);
	}, []);

	const markAllRead = useCallback(async () => {
		try {
			await api.api.notifications["read-all"].post();
			setRows((prev) =>
				prev.map((r) => ({
					...r,
					readAt: r.readAt ?? new Date().toISOString(),
				})),
			);
			setUnreadCount(0);
		} catch {
			// Best-effort.
		}
	}, []);

	const value = useMemo<NotificationsInboxContextValue>(
		() => ({
			rows,
			unreadCount,
			loading,
			refresh,
			markOneRead,
			markAllRead,
		}),
		[rows, unreadCount, loading, refresh, markOneRead, markAllRead],
	);

	return (
		<NotificationsInboxContext.Provider value={value}>
			{children}
		</NotificationsInboxContext.Provider>
	);
}

/** Read shared patron inbox state (must render under `NotificationsInboxProvider`). */
export function useNotificationsInbox(): NotificationsInboxContextValue {
	const ctx = useContext(NotificationsInboxContext);
	if (!ctx) {
		throw new Error(
			"useNotificationsInbox must be used within NotificationsInboxProvider",
		);
	}
	return ctx;
}

/** Optional inbox hook for surfaces that may render outside the provider in tests. */
export function useNotificationsInboxOptional(): NotificationsInboxContextValue | null {
	return useContext(NotificationsInboxContext);
}
