import { db, newsArticle, newsSource } from "@still/db";
import { desc, eq, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";

export const newsRoute = new Elysia({ prefix: "/api/news", tags: ["news"] })
  .use(context)
  .get("/", async ({ query }) => {
    const limit = Math.min(Number(query.limit ?? 30), 60);
    const rows = await db
      .select({ article: newsArticle, source: newsSource })
      .from(newsArticle)
      .leftJoin(newsSource, eq(newsArticle.sourceId, newsSource.id))
      .orderBy(desc(newsArticle.publishedAt))
      .limit(limit);
    return rows;
  }, { query: t.Object({ limit: t.Optional(t.String()) }) })
  .get(
    "/about/:movieId",
    async ({ params }) => {
      const rows = await db
        .select({ article: newsArticle, source: newsSource })
        .from(newsArticle)
        .leftJoin(newsSource, eq(newsArticle.sourceId, newsSource.id))
        .where(sql`${newsArticle.movieIds}::jsonb @> ${JSON.stringify([Number(params.movieId)])}::jsonb`)
        .orderBy(desc(newsArticle.publishedAt))
        .limit(20);
      return rows;
    },
    { params: t.Object({ movieId: t.String() }) },
  )
  .get("/sources", async () => {
    return db.select().from(newsSource).where(eq(newsSource.isActive, true));
  });
