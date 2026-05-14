import { cn } from "@still/ui/lib/utils";
import { Award } from "lucide-react";

type EarnedBadge = {
  badge: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
    tier: string;
  };
  userBadge: { awardedAt: string };
};

/**
 * Round-pill badge tiles arranged in a responsive grid. Tier maps to
 * Aker's accent palette so bronze < silver < gold feel different at a
 * glance without leaning on color alone.
 */
export function BadgeShelf({ badges }: { badges: EarnedBadge[] }) {
  if (badges.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
        No badges yet. Log your first film to start collecting.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-3 gap-3 md:grid-cols-5">
      {badges.map(({ badge }) => (
        <li
          key={badge.id}
          className={cn(
            "flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/60 p-4 text-center",
            badge.tier === "gold" && "border-desert-orange/40 bg-desert-orange/5",
          )}
        >
          <span
            className={cn(
              "grid size-14 place-items-center rounded-[var(--radius-badge)] border border-border bg-soft-stone text-pure-white",
              badge.tier === "gold" && "border-desert-orange bg-desert-orange text-absolute-black",
              badge.tier === "silver" && "bg-slate-border text-absolute-black",
              badge.tier === "bronze" && "bg-copper-clay text-pure-white",
            )}
          >
            {badge.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={badge.iconUrl} alt="" className="size-7" />
            ) : (
              <Award className="size-6" aria-hidden />
            )}
          </span>
          <p className="font-serif text-sm font-medium">{badge.name}</p>
          {badge.description ? (
            <p className="text-xs text-muted-foreground">{badge.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
