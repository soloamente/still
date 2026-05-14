import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const newsSourceKind = pgEnum("news_source_kind", [
  "tmdb_trending",
  "tmdb_upcoming",
  "tmdb_now_playing",
  "tmdb_popular",
  "rss",
]);

/**
 * Where a news article came from. RSS sources point at the feed URL; TMDb
 * "sources" are synthetic — one per virtual feed so the article table is
 * uniform regardless of origin.
 */
export const newsSource = pgTable(
  "news_source",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: newsSourceKind("kind").notNull(),
    url: text("url"),
    iconUrl: text("icon_url"),
    isActive: boolean("is_active").default(true).notNull(),
    lastFetchedAt: timestamp("last_fetched_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("news_source_kind_idx").on(table.kind)],
);

export const newsArticle = pgTable(
  "news_article",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => newsSource.id, { onDelete: "cascade" }),
    // externalId is a guid/url from the source — uniquely identifies the
    // article so we can idempotently re-ingest the feed.
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    body: text("body"),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    author: text("author"),
    publishedAt: timestamp("published_at").notNull(),
    // TMDb ids that the article is *about* — populated by the title-match
    // heuristic in jobs/rss-ingest.ts.
    movieIds: jsonb("movie_ids").$type<number[]>().default([]).notNull(),
    personIds: jsonb("person_ids").$type<number[]>().default([]).notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("news_article_source_external_uk").on(table.sourceId, table.externalId),
    index("news_article_published_idx").on(table.publishedAt),
    index("news_article_source_published_idx").on(table.sourceId, table.publishedAt),
  ],
);

export const newsSourceRelations = relations(newsSource, ({ many }) => ({
  articles: many(newsArticle),
}));

export const newsArticleRelations = relations(newsArticle, ({ one }) => ({
  source: one(newsSource, {
    fields: [newsArticle.sourceId],
    references: [newsSource.id],
  }),
}));
