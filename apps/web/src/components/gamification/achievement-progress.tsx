import { formatDistanceToNowStrict } from "@/lib/format";
import { Check } from "lucide-react";

type Achievement = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  target: number | null;
};

/**
 * Horizontal progress card — shows goal vs current, with a filled bar
 * tinted to the Aker accent. When complete, the bar collapses into a
 * checkmark + relative time.
 */
export function AchievementProgress({
  achievement,
  progress,
  completedAt,
}: {
  achievement: Achievement;
  progress: number;
  completedAt: string | null;
}) {
  const goal = achievement.target ?? 1;
  const pct = Math.min(100, Math.round((progress / Math.max(1, goal)) * 100));
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-base">{achievement.name}</h3>
          {achievement.description ? (
            <p className="mt-1 text-xs text-muted-foreground">{achievement.description}</p>
          ) : null}
        </div>
        {completedAt ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-desert-orange/40 bg-desert-orange/10 px-2 py-1 text-[10px] uppercase tracking-wider text-desert-orange">
            <Check className="size-3" /> {formatDistanceToNowStrict(new Date(completedAt))} ago
          </span>
        ) : (
          <span className="text-xs tabular-nums text-muted-foreground">
            {progress} / {goal}
          </span>
        )}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-desert-orange transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
