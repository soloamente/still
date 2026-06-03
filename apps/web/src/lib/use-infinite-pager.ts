"use client";

import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

export type LoadMoreResult<T, C> =
	| { items: T[]; nextCursor: C | null }
	| { error: true };

/** Pure merge used by the pager and unit-tested directly. */
export function mergeDedupe<T>(
	prev: T[],
	next: T[],
	getKey: (item: T) => string,
): T[] {
	const seen = new Set(prev.map(getKey));
	const out = [...prev];
	for (const row of next) {
		const k = getKey(row);
		if (!seen.has(k)) {
			seen.add(k);
			out.push(row);
		}
	}
	return out;
}

const SCROLL_MARGIN_PX = 280;

/**
 * Infinite-scroll engine shared by the community feeds. `C` is an opaque cursor —
 * a page number for offset feeds, an ISO timestamp for the activity feed.
 */
export function useInfinitePager<T, C>(opts: {
	seeds: T[];
	/** Cursor that fetches the next page; null when the seed is the whole set. */
	initialCursor: C | null;
	loadMore: (cursor: C, signal: AbortSignal) => Promise<LoadMoreResult<T, C>>;
	getKey: (item: T) => string;
}): {
	items: T[];
	footerState: "idle" | "loading" | "exhausted" | "error";
	sentinelRef: RefObject<HTMLDivElement | null>;
	retry: () => void;
} {
	const { seeds, initialCursor, loadMore, getKey } = opts;

	const [items, setItems] = useState<T[]>(() => [...seeds]);
	const [footerState, setFooterState] = useState<
		"idle" | "loading" | "exhausted" | "error"
	>(() => (initialCursor == null ? "exhausted" : "idle"));

	const cursorRef = useRef<C | null>(initialCursor);
	const loadingRef = useRef(false);
	const genRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const loadMoreRef = useRef<() => Promise<void>>(async () => {});

	// Re-seed when the server sends a new first page (chip navigation).
	useEffect(() => {
		genRef.current += 1;
		abortRef.current?.abort();
		abortRef.current = null;
		loadingRef.current = false;
		cursorRef.current = initialCursor;
		setItems([...seeds]);
		setFooterState(initialCursor == null ? "exhausted" : "idle");
	}, [seeds, initialCursor]);

	const peek = useCallback(() => {
		if (typeof window === "undefined") return;
		if (loadingRef.current || cursorRef.current == null) return;
		const el = sentinelRef.current;
		if (!el) return;
		if (
			el.getBoundingClientRect().top <=
			window.innerHeight + SCROLL_MARGIN_PX
		) {
			void loadMoreRef.current();
		}
	}, []);

	const runLoadMore = useCallback(async () => {
		const cursor = cursorRef.current;
		if (cursor == null) {
			setFooterState("exhausted");
			return;
		}
		if (loadingRef.current) return;
		loadingRef.current = true;
		setFooterState("loading");

		const gen = genRef.current;
		const controller = new AbortController();
		abortRef.current = controller;

		let res: LoadMoreResult<T, C>;
		try {
			res = await loadMore(cursor, controller.signal);
		} catch {
			if (gen !== genRef.current) return;
			loadingRef.current = false;
			setFooterState("error");
			return;
		}
		if (gen !== genRef.current) return;

		loadingRef.current = false;
		if ("error" in res) {
			setFooterState("error");
			return;
		}
		setItems((prev) => mergeDedupe(prev, res.items, getKey));
		cursorRef.current = res.nextCursor;
		const depleted = res.nextCursor == null || res.items.length === 0;
		setFooterState(depleted ? "exhausted" : "idle");
		if (!depleted) queueMicrotask(() => peek());
	}, [loadMore, getKey, peek]);

	useEffect(() => {
		loadMoreRef.current = runLoadMore;
	}, [runLoadMore]);

	const showSentinel = footerState !== "exhausted";

	useEffect(() => {
		if (!showSentinel) return;
		const el = sentinelRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) void loadMoreRef.current();
			},
			{ root: null, rootMargin: `${SCROLL_MARGIN_PX}px`, threshold: 0 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [showSentinel]);

	useEffect(() => {
		queueMicrotask(() => peek());
	}, [peek]);

	const retry = useCallback(() => {
		loadingRef.current = false;
		setFooterState("idle");
		queueMicrotask(() => peek());
	}, [peek]);

	return { items, footerState, sentinelRef, retry };
}
