import { cn } from "@still/ui/lib/utils";
import { formatDistanceToNowStrict } from "@/lib/format";

type Item = {
  article: {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    imageUrl: string | null;
    publishedAt: string;
    movieIds: number[];
  };
  source: { id: string; name: string; kind: string } | null;
};

/**
 * Horizontal news rail used on the home page. Each item links to the
 * source article in a new tab; the image is purely decorative — keep
 * alt empty so screen readers skip it.
 */
export function NewsStrip({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No headlines yet. Check back shortly.</p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ article, source }) => (
        <a
          key={article.id}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card/60 p-4",
            "transition-colors duration-[var(--aker-duration)] hover:border-desert-orange/40",
          )}
        >
          {article.imageUrl ? (
            <div className="relative aspect-[16/9] overflow-hidden rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.imageUrl}
                alt=""
                className="size-full object-cover transition-transform duration-[var(--aker-duration)] group-hover:scale-[1.02]"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {source?.name ?? "News"} · {formatDistanceToNowStrict(new Date(article.publishedAt))}{" "}
              ago
            </p>
            <h3 className="mt-1 line-clamp-3 font-serif text-base font-medium leading-snug group-hover:text-foreground">
              {article.title}
            </h3>
            {article.summary ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.summary}</p>
            ) : null}
          </div>
        </a>
      ))}
    </div>
  );
}
