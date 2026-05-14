import { db, movie, newsArticle, newsSource } from "@still/db";
import { eq, ilike } from "drizzle-orm";

import { makeId } from "../lib/cuid";

/**
 * Curated RSS feeds to ingest. New sources can be added at runtime via
 * the admin tool by inserting into news_source.
 */
export const DEFAULT_RSS_SOURCES = [
  { id: "rss_variety", name: "Variety", url: "https://variety.com/v/film/feed/" },
  {
    id: "rss_deadline",
    name: "Deadline",
    url: "https://deadline.com/v/film/feed/",
  },
  { id: "rss_indiewire", name: "IndieWire", url: "https://www.indiewire.com/feed/" },
  {
    id: "rss_thr",
    name: "The Hollywood Reporter",
    url: "https://www.hollywoodreporter.com/feed/",
  },
  { id: "rss_screenrant", name: "Screen Rant", url: "https://screenrant.com/feed/" },
] as const;

export async function ensureRssSources() {
  for (const s of DEFAULT_RSS_SOURCES) {
    await db
      .insert(newsSource)
      .values({ id: s.id, name: s.name, kind: "rss", url: s.url, isActive: true })
      .onConflictDoNothing();
  }
}

/**
 * Crude but dependency-light RSS parser. Extracts <item>...</item> blocks
 * and grabs title / link / pubDate / description / image. RSS feeds in
 * the wild are messy; we fall back gracefully on missing fields.
 */
function parseRss(xml: string) {
  const items: {
    title: string;
    link: string;
    pubDate: string | null;
    description: string | null;
    guid: string | null;
    imageUrl: string | null;
  }[] = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  for (const block of xml.match(itemRe) ?? []) {
    const titleM = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkM = block.match(/<link>([\s\S]*?)<\/link>/i);
    const guidM = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    const pubM = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const descM = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    const enclosureM = block.match(/<enclosure[^>]*url="([^"]+)"/i);
    const mediaM = block.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i);
    const imgM =
      descM?.[1]?.match(/<img[^>]*src="([^"]+)"/i) ?? block.match(/<img[^>]*src="([^"]+)"/i);
    items.push({
      title: (titleM?.[1] ?? "").trim(),
      link: (linkM?.[1] ?? "").trim(),
      pubDate: pubM?.[1]?.trim() ?? null,
      description: (descM?.[1] ?? "").replace(/<[^>]+>/g, "").trim() || null,
      guid: guidM?.[1]?.trim() ?? null,
      imageUrl: enclosureM?.[1] ?? mediaM?.[1] ?? imgM?.[1] ?? null,
    });
  }
  return items;
}

/**
 * Naive movie-linking heuristic: scan article title + summary for known
 * movie titles in our `movie` table (case-insensitive `ilike`), then
 * dedupe and store the matched tmdb ids on the article row.
 *
 * False positives are kept down by requiring a year match (the article
 * mentions the release year alongside the title), but for v1 a plain
 * title match is acceptable — the article still surfaces.
 */
async function linkMoviesByTitle(text: string): Promise<number[]> {
  const tokens = Array.from(
    new Set(
      text.match(/[A-Z][A-Za-z'’0-9]+(?:\s+[A-Z][A-Za-z'’0-9]+){0,5}/g) ?? [],
    ),
  ).slice(0, 12);
  if (tokens.length === 0) return [];
  const matched = new Set<number>();
  for (const candidate of tokens) {
    if (candidate.length < 4) continue;
    const rows = await db
      .select({ id: movie.tmdbId, title: movie.title })
      .from(movie)
      .where(ilike(movie.title, candidate))
      .limit(3);
    for (const r of rows) matched.add(r.id);
  }
  return Array.from(matched);
}

export async function ingestRss() {
  await ensureRssSources();
  const sources = await db
    .select()
    .from(newsSource)
    .where(eq(newsSource.kind, "rss"));

  for (const src of sources) {
    if (!src.isActive || !src.url) continue;
    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": "StillBot/1.0 (+https://still.app)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.error(`[rss] ${src.id} ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseRss(xml);
      for (const item of items) {
        const externalId = item.guid ?? item.link;
        if (!externalId || !item.title) continue;
        const linkedMovies = await linkMoviesByTitle(`${item.title} ${item.description ?? ""}`);
        await db
          .insert(newsArticle)
          .values({
            id: makeId("nws"),
            sourceId: src.id,
            externalId,
            title: item.title,
            summary: item.description?.slice(0, 480) ?? null,
            url: item.link,
            imageUrl: item.imageUrl,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            movieIds: linkedMovies,
          })
          .onConflictDoNothing();
      }
      await db
        .update(newsSource)
        .set({ lastFetchedAt: new Date() })
        .where(eq(newsSource.id, src.id));
    } catch (err) {
      console.error(`[rss] ${src.id} failed`, err);
    }
  }
}
