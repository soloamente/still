"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { MoviePoster } from "@/components/movie/movie-poster";
import { fetchMoviesPopular } from "@/lib/still-api-fetch";

export type PopularMovieSeed = {
  id: number;
  title: string;
  poster_url: string | null;
};

interface PopularMoviesInfiniteProps {
  /** First TMDb page — server-rendered for fast paint. */
  seedMovies: PopularMovieSeed[];
  /** Always `1` today — kept for symmetry if we hydrate mid-catalogue later. */
  seedPage: number;
  totalPages: number;
  totalResults: number;
  /** TMDB unset / upstream failure — no further client fetches. */
  blockedReason: string | null;
}

/** How far below the fold we start pulling the next sheet (pixels). Mirrors “feels infinite” pacing. */
const SCROLL_MARGIN_PX = 280;

export function PopularMoviesInfinite({
  seedMovies,
  seedPage,
  totalPages: initialTotalPages,
  totalResults,
  blockedReason,
}: PopularMoviesInfiniteProps) {
  const blockedRef = useRef(false);
  blockedRef.current = Boolean(blockedReason);

  const [items, setItems] = useState<PopularMovieSeed[]>(() => [...seedMovies]);

  /** Stale-safe mirror for async closure + post-fetch peek without resubscribing observers. */
  const nextPageRef = useRef(seedPage + 1);
  const totalPagesRef = useRef(initialTotalPages);
  totalPagesRef.current = initialTotalPages;

  const loadingRef = useRef(false);

  /** Footer UX only — observers use refs so we never miss a “still pinned” sentinel. */
  const [footerState, setFooterState] = useState<"idle" | "loading" | "exhausted" | "error">(() => {
    if (blockedReason) return "exhausted";
    if (!initialTotalPages || seedPage >= initialTotalPages) return "exhausted";
    return "idle";
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
  /** Let the IntersectionObserver call the latest loader without tearing the observer on each tick. */
  const loadMoreRef = useRef<() => Promise<void>>(async () => {});

  /**
   * If the viewport is taller than two sheets of posters stacked, IntersectionObserver
   * fires once — we chain with a geometry peek after each idle flush so backlog drains.
   */
  const peekIfRoomForMore = useCallback(() => {
    if (typeof window === "undefined") return;
    if (blockedRef.current || loadingRef.current) return;

    const next = nextPageRef.current;
    const tp = totalPagesRef.current;
    if (tp > 0 && next > tp) return;

    const el = sentinelRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    if (r.top <= window.innerHeight + SCROLL_MARGIN_PX) {
      void loadMoreRef.current();
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (blockedRef.current) return;

    const next = nextPageRef.current;
    const tp = totalPagesRef.current;

    /** Catalogue tail — TMDB publishes `total_pages`. */
    if (tp > 0 && next > tp) {
      setFooterState("exhausted");
      return;
    }

    if (loadingRef.current) return;

    loadingRef.current = true;
    setFooterState("loading");

    try {
      const { data, error } = await fetchMoviesPopular(next);

      loadingRef.current = false;

      if (error || !data || typeof data !== "object") {
        setFooterState("error");
        return;
      }

      const pageData = data as {
        results?: PopularMovieSeed[];
        total_pages?: number;
      };

      const batch = Array.isArray(pageData.results) ? pageData.results : [];

      if (typeof pageData.total_pages === "number" && pageData.total_pages > 0) {
        totalPagesRef.current = pageData.total_pages;
      }

      /** Merge without duplicate keys across overlapping windows (defensive only). */
      setItems((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const out = [...prev];
        for (const row of batch) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            out.push(row);
          }
        }
        return out;
      });

      nextPageRef.current = next + 1;

      const effectiveTp = totalPagesRef.current;
      const depleted =
        batch.length === 0 || (effectiveTp > 0 && nextPageRef.current > effectiveTp);

      setFooterState(depleted ? "exhausted" : "idle");

      /** Drain tall viewports until the sentinel scrolls below the chrome. */
      if (!depleted) {
        queueMicrotask(() => peekIfRoomForMore());
      }
    } catch {
      loadingRef.current = false;
      setFooterState("error");
    }
  }, [peekIfRoomForMore]);

  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  /** IntersectionObserver — primary trigger for normal scroll velocities. */
  useEffect(() => {
    if (blockedReason) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        void loadMoreRef.current();
      },
      { root: null, rootMargin: `${SCROLL_MARGIN_PX}px`, threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [blockedReason]);

  /** First paint — short catalogues sometimes keep the sentinel in view without an IO edge. */
  useEffect(() => {
    if (blockedReason) return;
    queueMicrotask(() => peekIfRoomForMore());
  }, [blockedReason, peekIfRoomForMore]);

  return (
    <>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 sm:gap-5 md:grid-cols-5 md:gap-6 lg:grid-cols-6 lg:gap-7">
        {items.map((m) => (
          <MoviePoster key={m.id} movieId={m.id} title={m.title} posterUrl={m.poster_url} showTitle />
        ))}
      </div>

      {!blockedReason && footerState !== "exhausted" ? (
        <div ref={sentinelRef} className="pointer-events-none h-px w-full shrink-0" aria-hidden />
      ) : null}

      <div
        className="flex min-h-10 justify-center pb-8 pt-4"
        aria-live="polite"
        aria-busy={footerState === "loading"}
      >
        {footerState === "loading" ? (
          <>
            <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">Loading more titles</span>
          </>
        ) : null}
        {footerState === "error" ? (
          <p className="text-center text-sm text-muted-foreground">
            Something jammed fetching the next sheet —{" "}
            <button
              type="button"
              className="underline decoration-dashed underline-offset-2 hover:text-foreground"
              onClick={() => {
                loadingRef.current = false;
                setFooterState("idle");
                queueMicrotask(() => peekIfRoomForMore());
              }}
            >
              try again
            </button>
            .
          </p>
        ) : null}
        {footerState === "exhausted" && !blockedReason && items.length > 0 && totalResults > 0 ? (
          <p className="max-w-xl text-center text-xs text-muted-foreground">
            You’ve scrolled through{" "}
            <span className="tabular-nums">{items.length}</span>
            {items.length === 1 ? " title" : " titles"}
            {totalResults >= items.length
              ? ` of ${totalResults.toLocaleString()} in TMDb’s popular catalogue.`
              : "."}
          </p>
        ) : null}
      </div>
    </>
  );
}
