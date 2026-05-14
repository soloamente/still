import { db, notification } from "@still/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";

export const notificationsRoute = new Elysia({
  prefix: "/api/notifications",
  tags: ["notifications"],
})
  .use(context)
  .get("/", async ({ user, status, query }) => {
    if (!user) return status(401, "Sign in");
    const limit = Math.min(Number(query.limit ?? 50), 100);
    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, user.id))
      .orderBy(desc(notification.createdAt))
      .limit(limit);
    return rows;
  }, { query: t.Object({ limit: t.Optional(t.String()) }) })
  .get("/unread-count", async ({ user, status }) => {
    if (!user) return status(401, "Sign in");
    const [row] = await db
      .select({ c: sql<number>`count(*)` })
      .from(notification)
      .where(and(eq(notification.userId, user.id), isNull(notification.readAt)));
    return { count: Number(row?.c ?? 0) };
  })
  .post("/read-all", async ({ user, status }) => {
    if (!user) return status(401, "Sign in");
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.userId, user.id), isNull(notification.readAt)));
    return { ok: true };
  })
  .post(
    "/:id/read",
    async ({ params, user, status }) => {
      if (!user) return status(401, "Sign in");
      await db
        .update(notification)
        .set({ readAt: new Date() })
        .where(and(eq(notification.id, params.id), eq(notification.userId, user.id)));
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) },
  );
