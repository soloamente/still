"use client";

import { cn } from "@still/ui/lib/utils";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Film,
  ListMusic,
  MessageCircle,
  Newspaper,
  Search,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";

import { fetchMoviesSearch } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

/**
 * Universal search palette — ⌘K from anywhere. Tiny zustand store so
 * any component can pop it open (e.g. the header search input). The
 * results are debounced TMDb passthrough; static "navigate to"
 * shortcuts always appear so the palette doubles as a launcher.
 */
type Store = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export const useCommandPalette = create<Store>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));

type MovieHit = { id: number; title: string; year?: string; poster_url: string | null };

const NAV_SHORTCUTS = [
  { id: "home", label: "Home", icon: Film, href: "/home" },
  { id: "diary", label: "Diary", icon: Film, href: "/diary" },
  { id: "watchlist", label: "Watchlist", icon: ListMusic, href: "/watchlist" },
  /**
   * Full TMDb popular billboard — surfaced here so ⌘K still routes people who typed
   * “popular” toward browse, not toward an empty TMDB substring match.
   */
  { id: "popular", label: "Popular films", icon: TrendingUp, href: "/movies/popular" },
  { id: "news", label: "News", icon: Newspaper, href: "/news" },
  { id: "achievements", label: "Achievements", icon: Trophy, href: "/achievements" },
  { id: "chat", label: "Chat", icon: MessageCircle, href: "/chat" },
  { id: "notifications", label: "Notifications", icon: Bell, href: "/notifications" },
  /** Mirrors the standalone search page — shareable bookmarks + deep grids. */
  { id: "search", label: "Search screen", icon: Search, href: "/search" },
] as const;

export function CommandPaletteRoot() {
  const { isOpen, close } = useCommandPalette();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MovieHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [setupHint, setSetupHint] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      // Closing the dialog must reset search UI; otherwise a prior aborted run can leave
      // isSearching=true and the list stays blank (no empty state, no results).
      setIsSearching(false);
      setSetupHint(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSetupHint(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetchMoviesSearch(trimmed, { signal: ctrl.signal });
        // Debounce cleanup aborts in-flight work — never apply stale payloads.
        if (ctrl.signal.aborted) return;
        if (res.error) {
          setResults([]);
          setSetupHint(null);
          return;
        }
        const data = res.data as { results?: MovieHit[] } | null;
        setSetupHint(tmdbSetupHint(data));
        const list = (data?.results ?? []).slice(0, 8).map((m) => ({
          id: m.id,
          title: m.title,
          year: (m as { release_date?: string }).release_date?.slice(0, 4) ?? "",
          poster_url: m.poster_url,
        }));
        setResults(list);
      } catch {
        if (!ctrl.signal.aborted) {
          setResults([]);
          setSetupHint(null);
        }
      } finally {
        // Always clear the spinner — skipping this when `abort()` ran is what stuck the UI in "loading"
        // and hid both hits and the empty state.
        setIsSearching(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  // Filter shortcuts client-side so they remain searchable.
  const filteredShortcuts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_SHORTCUTS;
    return NAV_SHORTCUTS.filter((s) => s.label.toLowerCase().includes(q));
  }, [query]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          // Dialog backdrop — click to close, motion only on enter/leave.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 grid place-items-start bg-absolute-black/70 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-label="Search"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.165, 0.84, 0.44, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto mt-[12vh] w-[92vw] max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <Command
              label="Search"
              /**
               * We filter shortcuts + TMDB hits ourselves (`filteredShortcuts`, `results`).
               * Letting cmdk score items makes `filtered.count` hit zero while TMDB flights
               * are mid-air — Radix-labelled “Suggestions” list then mounts `Command.Empty`
               * even though we intentionally render neither nav rows nor film rows yet, so it
               * reads as permanently blank (“no suggestions”).
               */
              shouldFilter={false}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
              }}
            >
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Search className="size-4 text-muted-foreground" aria-hidden />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search films, people, lists, friends…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] tracking-wide text-muted-foreground">
                  esc
                </kbd>
              </div>
              <Command.List className="max-h-[60vh] overflow-y-auto px-2 py-2">
                {/* Keep launcher rows mounted whenever shortcuts match the slash query — hides the
                    “everything vanished” valley between keystroke and TMDB round-trip. */}
                {filteredShortcuts.length > 0 ? (
                  <Command.Group heading="Go to" className="px-2 py-1 text-xs text-muted-foreground">
                    {filteredShortcuts.map((s) => (
                      <CommandItem
                        key={s.id}
                        onSelect={() => {
                          router.push(s.href);
                          close();
                        }}
                        leading={<s.icon className="size-4" />}
                      >
                        {s.label}
                      </CommandItem>
                    ))}
                  </Command.Group>
                ) : null}
                {results.length > 0 ? (
                  <Command.Group heading="Films" className="px-2 py-1 text-xs text-muted-foreground">
                    {results.map((m) => (
                      <CommandItem
                        key={m.id}
                        onSelect={() => {
                          router.push(`/movies/${m.id}`);
                          close();
                        }}
                        leading={
                          m.poster_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.poster_url}
                              alt=""
                              className="size-7 rounded object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="size-7 rounded bg-muted" />
                          )
                        }
                      >
                        <span className="flex-1 truncate">{m.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{m.year}</span>
                      </CommandItem>
                    ))}
                  </Command.Group>
                ) : null}
                {/*
                 * Avoid `Command.Empty`: with client-filtered subsets it races TMDB latency and
                 * paints an empty Radix “Suggestions” surface even while work is flying.
                 */}
                {query.trim() && results.length === 0 && isSearching ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground" role="status">
                    Searching…
                  </p>
                ) : null}
                {query.trim() && results.length === 0 && !isSearching && filteredShortcuts.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground" role="status">
                    {setupHint ?? <>No results for &ldquo;{query}&rdquo;</>}
                  </div>
                ) : null}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function CommandItem({
  children,
  onSelect,
  leading,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  leading?: React.ReactNode;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground",
        "aria-selected:bg-muted aria-selected:text-foreground",
      )}
    >
      {leading}
      {children}
    </Command.Item>
  );
}
