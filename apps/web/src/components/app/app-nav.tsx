"use client";

import { Button } from "@still/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@still/ui/components/dropdown-menu";
import { cn } from "@still/ui/lib/utils";
import { motion } from "framer-motion";
import {
  Bell,
  BookMarked,
  ChevronDown,
  Home,
  ListMusic,
  MessageCircle,
  MoreHorizontal,
  Newspaper,
  Search,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand-mark";
import { useCommandPalette } from "@/components/app/command-palette";
import { authClient } from "@/lib/auth-client";

/** Core routes in the floating bar (icon-first, compact). */
const NAV_MAIN = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/diary", label: "Diary", icon: BookMarked },
  { href: "/watchlist", label: "Watchlist", icon: ListMusic },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/chat", label: "Chat", icon: MessageCircle },
] as const;

/** Secondary destinations surfaced from the overflow control. */
const NAV_MORE = [{ href: "/achievements", label: "Achievements", icon: Trophy }] as const;

type NavUser = { id: string; name: string; image: string | null; handle: string };

export function AppNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const openCommand = useCommandPalette((s) => s.open);

  // ⌘K / Ctrl+K opens the universal search palette.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCommand();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCommand]);

  return (
    <motion.nav
      role="navigation"
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center"
      initial={false}
      /* Subtle float — stays dynamic without stealing focus from content. */
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <div
        className={cn(
          "pointer-events-auto mb-[max(0.75rem,env(safe-area-inset-bottom))] flex w-full max-w-3xl items-center gap-1 px-3",
          "sm:mb-4 sm:max-w-4xl sm:gap-2 sm:px-4",
        )}
      >
        <div
          className={cn(
            "flex min-h-14 flex-1 items-center justify-between gap-1 rounded-2xl border border-border/70 bg-card/80 px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl",
            "sm:min-h-[3.25rem] sm:gap-2 sm:px-3 sm:py-2 sm:rounded-[1.25rem]",
          )}
        >
          {/* Wordmark — one Link only (BrandMark owns the anchor) so we never nest <a>. */}
          <BrandMark
            size="sm"
            href="/home"
            className="hidden shrink-0 pl-1 sm:flex sm:items-center"
            aria-label="Still — home"
          />

          <div className="flex flex-1 items-center justify-evenly sm:justify-center sm:gap-1">
            {NAV_MAIN.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href || (href !== "/home" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 min-w-11 flex-col items-center justify-center rounded-xl px-1.5 py-1 text-[10px] font-medium transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
                    "sm:min-h-10 sm:min-w-10 sm:px-2 sm:text-xs",
                    "hover:bg-muted/80",
                    "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active-pip"
                      className="absolute inset-x-2 -top-0.5 h-0.5 rounded-full bg-accent"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  ) : null}
                  <Icon className="size-5 sm:size-[1.35rem]" aria-hidden />
                  <span className="mt-0.5 max-w-[3.25rem] truncate leading-none sm:max-w-none">
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-xl sm:size-11"
              onClick={openCommand}
              aria-label="Search — ⌘K"
            >
              <Search className="size-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 rounded-xl sm:size-11"
                    aria-label="More"
                  >
                    {/* Trophy stays on the Achievements row inside the menu; overflow uses a neutral "more" glyph. */}
                    <MoreHorizontal className="size-5 opacity-80" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-44">
                {/* Base UI: GroupLabel must sit under Menu.Group, same as the user menu below. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>More</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {NAV_MORE.map(({ href, label, icon: Icon }) => (
                    <DropdownMenuItem key={href} onClick={() => router.push(href)}>
                      <Icon className="mr-2 size-4 opacity-70" />
                      {label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onClick={() => router.push("/lists")}>
                    <ListMusic className="mr-2 size-4 opacity-70" />
                    Lists
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link href="/notifications" aria-label="Notifications" className="hidden sm:block">
              <Button variant="ghost" size="icon" className="size-10 rounded-xl sm:size-11">
                <Bell className="size-5" />
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 gap-1 rounded-xl px-1.5 sm:h-11 sm:px-2"
                  >
                    <Avatar src={user.image} name={user.name} />
                    <ChevronDown className="hidden size-3.5 opacity-60 sm:block" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>@{user.handle}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(`/profile/${user.handle}`)}>
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/notifications")}>
                    Notifications
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/me/settings")}>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/me/customization")}>
                    Customize
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      authClient.signOut({
                        fetchOptions: {
                          onSuccess: () => {
                            router.replace("/");
                            router.refresh();
                          },
                        },
                      })
                    }
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}

/** Compact avatar — falls back to initials when no image is set. */
function Avatar({ src, name }: { src: string | null; name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        className="size-8 rounded-full object-cover sm:size-9"
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <span className="inline-flex size-8 items-center justify-center rounded-full bg-soft-stone text-[10px] font-medium text-pure-white sm:size-9">
      {initials}
    </span>
  );
}
