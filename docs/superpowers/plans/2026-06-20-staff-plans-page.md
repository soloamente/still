# Staff Plans Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/staff/plans` — a staff-only page for reviewing and collaboratively editing the subscription plan feature catalogue, with live presence (avatars + hover tooltips showing name · role), a grid view, a details view, and a drawer for creating new features.

**Architecture:** Three new Drizzle tables (`plan_tier`, `plan_feature`, `plan_feature_tier`) seeded with the agreed catalogue. An Elysia route exposes CRUD under `/api/staff/plan-features`. The web client is a server-gated page with a client shell that reuses `useListingPresence` (new `staff:plans` room ID) for presence, `DetailVaulSheet` + zustand for the create drawer, and an inline edit panel shared between grid and details views.

**Tech Stack:** Drizzle ORM (pg-core), Elysia, Next.js App Router, React, zustand, vaul (`DetailVaulSheet`), Radix Tooltip (`@still/ui/components/tooltip`), sonner toasts, Tailwind CSS vars only.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/db/src/schema/plan.ts` | `planTier`, `planFeature`, `planFeatureTier` tables + relations |
| Modify | `packages/db/src/schema/index.ts` | barrel export for `./plan` |
| Create | `packages/db/src/migrations/0036_plan_tables.sql` | SQL migration |
| Create | `apps/server/src/lib/seed-plan-catalogue.ts` | seed helper for initial tiers + features |
| Modify | `packages/realtime/src/room-ids.ts` | add `staffPlansRoomId()` |
| Create | `apps/server/src/routes/plan-features.ts` | Elysia CRUD route |
| Modify | `apps/server/src/server/app.ts` | register `planFeaturesRoute` |
| Create | `apps/web/src/lib/staff-plan-features-api.ts` | typed fetch helpers for the client |
| Create | `apps/web/src/components/staff/use-plan-feature-drawer.ts` | zustand store for create drawer |
| Create | `apps/web/src/components/staff/plan-feature-create-drawer.tsx` | `DetailVaulSheet` create form |
| Create | `apps/web/src/components/staff/plan-feature-inline-edit.tsx` | shared inline edit panel (grid + details) |
| Create | `apps/web/src/components/staff/staff-plans-topbar.tsx` | topbar with presence avatars + tooltips + view toggle + add button |
| Create | `apps/web/src/components/staff/staff-plans-grid-view.tsx` | feature matrix with inline edit |
| Create | `apps/web/src/components/staff/staff-plans-details-view.tsx` | per-tier feature breakdown with inline edit |
| Create | `apps/web/src/components/staff/staff-plans-shell.tsx` | client shell (state, presence hook, view toggle) |
| Create | `apps/web/src/app/(app)/staff/plans/page.tsx` | server page (auth gate) |

---

## Task 1: DB schema — plan tables

**Files:**
- Create: `packages/db/src/schema/plan.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Write the schema file**

```ts
// packages/db/src/schema/plan.ts
import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Static reference rows — seeded once, never deleted via UI. */
export const planTier = pgTable("plan_tier", {
  id: text("id").primaryKey(), // "still" | "attuned" | "immersed" | "devoted"
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  priceYearly: integer("price_yearly"), // cents, null = free
  priceMonthly: integer("price_monthly"), // cents, null = free
  tagline: text("tagline").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const planFeature = pgTable("plan_feature", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  buildStatus: text("build_status").notNull().default("planned"), // "exists" | "planned"
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Which tiers include a feature. */
export const planFeatureTier = pgTable(
  "plan_feature_tier",
  {
    featureId: text("feature_id")
      .notNull()
      .references(() => planFeature.id, { onDelete: "cascade" }),
    tierId: text("tier_id")
      .notNull()
      .references(() => planTier.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.featureId, table.tierId] })],
);

export const planTierRelations = relations(planTier, ({ many }) => ({
  featureTiers: many(planFeatureTier),
}));

export const planFeatureRelations = relations(planFeature, ({ many }) => ({
  featureTiers: many(planFeatureTier),
}));

export const planFeatureTierRelations = relations(planFeatureTier, ({ one }) => ({
  feature: one(planFeature, {
    fields: [planFeatureTier.featureId],
    references: [planFeature.id],
  }),
  tier: one(planTier, {
    fields: [planFeatureTier.tierId],
    references: [planTier.id],
  }),
}));
```

- [ ] **Step 2: Add to schema barrel**

In `packages/db/src/schema/index.ts`, add at the end:
```ts
export * from "./plan";
```

- [ ] **Step 3: Generate migration**

```bash
bun run db:generate
```

Expected: new file created at `packages/db/src/migrations/0036_plan_tables.sql`.

- [ ] **Step 4: Apply migration**

```bash
bun run db:push
```

Expected: output shows tables `plan_tier`, `plan_feature`, `plan_feature_tier` created with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/plan.ts packages/db/src/schema/index.ts packages/db/src/migrations/
git commit -m "feat(db): add plan_tier, plan_feature, plan_feature_tier tables"
```

---

## Task 2: Seed the plan catalogue

**Files:**
- Create: `apps/server/src/lib/seed-plan-catalogue.ts`

This seed is run once manually (not a migration) to populate the initial tiers and features from the agreed spec.

- [ ] **Step 1: Write the seed helper**

```ts
// apps/server/src/lib/seed-plan-catalogue.ts
import { db, planFeature, planFeatureTier, planTier } from "@still/db";
import { makeId } from "./cuid";

const TIERS = [
  { id: "still", name: "Still", sortOrder: 0, priceYearly: null, priceMonthly: null, tagline: "Quiet foundation — always free" },
  { id: "attuned", name: "Attuned", sortOrder: 1, priceYearly: 2400, priceMonthly: 300, tagline: "Know yourself as a watcher" },
  { id: "immersed", name: "Immersed", sortOrder: 2, priceYearly: 4800, priceMonthly: 600, tagline: "Expression, social depth, engagement layer" },
  { id: "devoted", name: "Devoted", sortOrder: 3, priceYearly: 10000, priceMonthly: 1200, tagline: "You helped build this" },
] as const;

type FeatureSeed = {
  name: string;
  description: string;
  buildStatus: "exists" | "planned";
  tiers: Array<"still" | "attuned" | "immersed" | "devoted">;
};

const FEATURES: FeatureSeed[] = [
  // ── Still ──
  { name: "Log movies, TV & anime", description: "Mark anything as watched. Movies pull from TMDB. TV tracks episode by episode. Anime works the same way. You can log something multiple times (rewatches).", buildStatus: "exists", tiers: ["still", "attuned", "immersed", "devoted"] },
  { name: "Watchlist & ratings", description: "Save things you want to watch. Rate anything on a 0–10 scale. Ratings are stored to the tenth (e.g. 8.5). You can also mark things you own.", buildStatus: "exists", tiers: ["still", "attuned", "immersed", "devoted"] },
  { name: "Reviews & lists", description: "Write reviews tied to a log entry. Create public lists — curated collections of any movies/TV/anime. Lists have titles, descriptions, and covers.", buildStatus: "exists", tiers: ["still", "attuned", "immersed", "devoted"] },
  { name: "Follow & social feed", description: "Follow other users. Your feed shows what people you follow are watching, rating, and reviewing. Feed supports real-time presence and shows rating divergence.", buildStatus: "exists", tiers: ["still", "attuned", "immersed", "devoted"] },
  { name: "Import from Letterboxd, AniList, MAL", description: "Bring your entire watch history over. Letterboxd via CSV. AniList and MyAnimeList via API. Imports match titles to TMDB, map episodes, and preserve ratings.", buildStatus: "exists", tiers: ["still", "attuned", "immersed", "devoted"] },
  { name: "TV episode progress tracking", description: "Track progress at the episode level. The server syncs new episodes as they air. Mark episodes watched in bulk or one by one.", buildStatus: "exists", tiers: ["still", "attuned", "immersed", "devoted"] },
  { name: "Basic streaks & starter badges", description: "A running count of consecutive days you've logged something. Volume milestone badges — watched 10, 100, 1000 things. These appear in your Achievements section.", buildStatus: "exists", tiers: ["still", "attuned", "immersed", "devoted"] },
  { name: "Year in review (annual snapshot)", description: "An annual summary generated once per year: how many things you watched, top genres, highest-rated, most active month. Free users get this once a year.", buildStatus: "planned", tiers: ["still", "attuned", "immersed", "devoted"] },

  // ── Attuned ──
  { name: "Full stats", description: "All-time & per-year breakdowns: genres, media types, average rating, most active periods. Attuned users get on-demand access across any time range — free tier gets the annual snapshot only.", buildStatus: "exists", tiers: ["attuned", "immersed", "devoted"] },
  { name: "Taste signature", description: "Rule-based archetype auto-generated from your diary: Contrarian, Curator, Genre Purist, Dual Affinity, Generous, Selective, Genre-Led, Eclectic. A one-line headline shows on your profile and updates as you log more.", buildStatus: "exists", tiers: ["attuned", "immersed", "devoted"] },
  { name: "Activity signature", description: "GitHub-style 52-week heatmap on your profile. Darker squares = more activity that day. Shows whether you're a weekend binger, daily watcher, or seasonal burst viewer.", buildStatus: "exists", tiers: ["attuned", "immersed", "devoted"] },
  { name: "Streaming filters", description: "Filter the catalogue by what's actually available on your streaming services right now in your country. Start from what you can already watch.", buildStatus: "exists", tiers: ["attuned", "immersed", "devoted"] },
  { name: "Watchlist alerts", description: "Get notified when something on your watchlist becomes available on a streaming service in your region. Works by periodically diffing TMDB streaming availability against your preferences.", buildStatus: "exists", tiers: ["attuned", "immersed", "devoted"] },
  { name: "Theater listings", description: "Shows what's currently playing in cinemas near you. Pulls from TMDB theatrical release data filtered by your region.", buildStatus: "planned", tiers: ["attuned", "immersed", "devoted"] },
  { name: "Advanced feed filters", description: "Filter your social feed by type — only reviews, only logs, only ratings, only a specific person. Free users see everything chronologically.", buildStatus: "planned", tiers: ["attuned", "immersed", "devoted"] },

  // ── Immersed ──
  { name: "All themes unlocked", description: "Ember and Midnight themes unlocked (currently gated as 'pro' in app-themes.ts — gate renamed to 'immersed'). All future themes included automatically.", buildStatus: "exists", tiers: ["immersed", "devoted"] },
  { name: "Profile customization", description: "Choose an accent color (Desert, Copper, Rose, Slate) and banner frame (None, Cinema, Editorial). These change how your profile looks to visitors.", buildStatus: "exists", tiers: ["immersed", "devoted"] },
  { name: "Pinned reviews & custom list covers", description: "Pin your best reviews to the top of your profile. Custom list covers let you pick which poster represents a list instead of the auto-generated one.", buildStatus: "exists", tiers: ["immersed", "devoted"] },
  { name: "Private lists & collaboration", description: "Make a list private so only you and invited collaborators can see it. Invite specific users to co-curate before making it public.", buildStatus: "exists", tiers: ["immersed", "devoted"] },
  { name: "Taste overlap scores", description: "See how much your taste overlaps with anyone you follow. Compares shared watches, finds titles you both rated, and shows where you agree vs. diverge.", buildStatus: "exists", tiers: ["immersed", "devoted"] },
  { name: "Rivalry mode", description: "Send a head-to-head taste challenge to someone — compatibility score, biggest disagreements, shared obsessions. Shareable card for social media. Builds on the existing taste overlap engine.", buildStatus: "planned", tiers: ["immersed", "devoted"] },
  { name: "Full badge collection & prestige unlocks", description: "Beyond volume milestones: prestige badges earned by completing director filmographies, developing a contrarian taste signature, writing high-engagement reviews. Tiers: Bronze → Silver → Gold → Platinum → Legendary.", buildStatus: "exists", tiers: ["immersed", "devoted"] },
  { name: "Completionist challenges", description: "Structured watchlists with a goal attached. Current: Nolan Essentials, Horror Canon, Ghibli Magic, A24 Highlights. Completing one earns a permanent prestige badge.", buildStatus: "exists", tiers: ["immersed", "devoted"] },
  { name: "Leaderboard visibility", description: "Appear on the community leaderboard ranked by activity, reviews, list quality, and engagement. Free and Attuned users can view it but aren't listed.", buildStatus: "exists", tiers: ["immersed", "devoted"] },

  // ── Devoted ──
  { name: "Vote on upcoming features", description: "Access to a private roadmap board where Devoted members can upvote and comment on what gets built next. Votes are tracked and used to prioritize.", buildStatus: "planned", tiers: ["devoted"] },
  { name: "Beta access", description: "New features before they're released to anyone else. Polished betas close to shipping — you're the first to see what's coming.", buildStatus: "planned", tiers: ["devoted"] },
  { name: "Direct feedback channel to team", description: "A direct line to the team — not a support ticket queue. Closer to a private Discord channel where your feedback is seen and responded to personally.", buildStatus: "planned", tiers: ["devoted"] },
  { name: "Inner circle community", description: "A private space for Devoted members only to talk about the platform, share opinions on features, and be part of the conversation that shapes Sense.", buildStatus: "planned", tiers: ["devoted"] },
  { name: "Name in app credits", description: "Your name or username appears in a dedicated supporters page in the app — permanent and visible to all users. Accumulates as long as you're Devoted.", buildStatus: "planned", tiers: ["devoted"] },
  { name: "Devoted badge on profile", description: "A visible marker on your profile that signals to everyone that you're a Devoted supporter. Designed to be noticed — other users will know you believe in the platform.", buildStatus: "planned", tiers: ["devoted"] },
  { name: "Public supporters page listing", description: "A page on Sense listing all Devoted members with profile links. Part recognition, part community — the people who love the platform most, celebrated.", buildStatus: "planned", tiers: ["devoted"] },
  { name: "Seasonal exclusive themes", description: "Themes released for specific moments — a film festival season, a Sense anniversary — available only to Devoted members, never sold or released to other tiers.", buildStatus: "planned", tiers: ["devoted"] },
  { name: "Rare Devoted-only badges", description: "Special badges that can only ever exist on Devoted member profiles. Not earnable by anyone else regardless of watch history. Permanent identity markers.", buildStatus: "planned", tiers: ["devoted"] },
];

export async function seedPlanCatalogue() {
  console.log("Seeding plan tiers…");
  await db.insert(planTier).values(TIERS).onConflictDoNothing();

  console.log("Seeding plan features…");
  for (let i = 0; i < FEATURES.length; i++) {
    const f = FEATURES[i];
    const id = makeId("feat");
    await db
      .insert(planFeature)
      .values({ id, name: f.name, description: f.description, buildStatus: f.buildStatus, sortOrder: i })
      .onConflictDoNothing();
    await db
      .insert(planFeatureTier)
      .values(f.tiers.map((tierId) => ({ featureId: id, tierId })))
      .onConflictDoNothing();
  }
  console.log("Done.");
}
```

- [ ] **Step 2: Run the seed**

```bash
cd apps/server && bun -e "import { seedPlanCatalogue } from './src/lib/seed-plan-catalogue.ts'; await seedPlanCatalogue();"
```

Expected: output shows "Seeding plan tiers… Seeding plan features… Done."

- [ ] **Step 3: Verify rows exist**

```bash
cd apps/server && bun -e "import { db, planTier, planFeature } from '@still/db'; console.log(await db.select().from(planTier)); console.log((await db.select().from(planFeature)).length, 'features');"
```

Expected: 4 tier rows, 33 feature rows.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/lib/seed-plan-catalogue.ts
git commit -m "feat(server): add plan catalogue seed"
```

---

## Task 3: Add `staffPlansRoomId` to realtime package

**Files:**
- Modify: `packages/realtime/src/room-ids.ts`

- [ ] **Step 1: Add the room ID helper**

In `packages/realtime/src/room-ids.ts`, append after the last export:

```ts
/** Staff plans collaboration room — presence for /staff/plans. */
export const STAFF_PLANS_ROOM = "staff:plans";

export function staffPlansRoomId(): string {
  return STAFF_PLANS_ROOM;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/realtime/src/room-ids.ts
git commit -m "feat(realtime): add staffPlansRoomId"
```

---

## Task 4: Server route — plan features CRUD

**Files:**
- Create: `apps/server/src/routes/plan-features.ts`
- Modify: `apps/server/src/server/app.ts`

- [ ] **Step 1: Write the route**

```ts
// apps/server/src/routes/plan-features.ts
import { db, planFeature, planFeatureTier, planTier } from "@still/db";
import { asc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context, requirePermission } from "../context";
import { makeId } from "../lib/cuid";

/** Shape returned to the client for a single feature. */
type PlanFeatureRow = {
  id: string;
  name: string;
  description: string;
  buildStatus: string;
  sortOrder: number;
  tierIds: string[];
};

async function listFeaturesWithTiers(): Promise<PlanFeatureRow[]> {
  const features = await db
    .select()
    .from(planFeature)
    .orderBy(asc(planFeature.sortOrder), asc(planFeature.createdAt));
  const joins = await db.select().from(planFeatureTier);

  const tierMap = new Map<string, string[]>();
  for (const j of joins) {
    const arr = tierMap.get(j.featureId) ?? [];
    arr.push(j.tierId);
    tierMap.set(j.featureId, arr);
  }

  return features.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
    buildStatus: f.buildStatus,
    sortOrder: f.sortOrder,
    tierIds: tierMap.get(f.id) ?? [],
  }));
}

export const planFeaturesRoute = new Elysia({
  prefix: "/api/staff/plan-features",
  tags: ["staff"],
})
  .use(context)
  .get("/", async ({ user: viewer, status }) => {
    try {
      await requirePermission({ user: viewer }, { user: ["list"] });
      const tiers = await db
        .select()
        .from(planTier)
        .orderBy(asc(planTier.sortOrder));
      const features = await listFeaturesWithTiers();
      return { tiers, features };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "UNAUTHORIZED") return status(401, "Sign in");
      if (msg === "FORBIDDEN") return status(403, "Not allowed");
      return status(500, msg);
    }
  })
  .post(
    "/",
    async ({ user: viewer, body, status }) => {
      try {
        await requirePermission({ user: viewer }, { user: ["list"] });
        const id = makeId("feat");
        const maxOrder = await db
          .select({ o: planFeature.sortOrder })
          .from(planFeature)
          .orderBy(asc(planFeature.sortOrder));
        const sortOrder = maxOrder.length;
        await db.insert(planFeature).values({
          id,
          name: body.name,
          description: body.description,
          buildStatus: body.buildStatus,
          sortOrder,
        });
        if (body.tierIds.length > 0) {
          await db
            .insert(planFeatureTier)
            .values(body.tierIds.map((tierId) => ({ featureId: id, tierId })));
        }
        const features = await listFeaturesWithTiers();
        return { features };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "UNAUTHORIZED") return status(401, "Sign in");
        if (msg === "FORBIDDEN") return status(403, "Not allowed");
        return status(500, msg);
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        description: t.String({ minLength: 1 }),
        buildStatus: t.Union([t.Literal("exists"), t.Literal("planned")]),
        tierIds: t.Array(t.String()),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ user: viewer, params, body, status }) => {
      try {
        await requirePermission({ user: viewer }, { user: ["list"] });
        await db
          .update(planFeature)
          .set({
            name: body.name,
            description: body.description,
            buildStatus: body.buildStatus,
            updatedAt: new Date(),
          })
          .where(eq(planFeature.id, params.id));
        // Replace tier assignments
        await db
          .delete(planFeatureTier)
          .where(eq(planFeatureTier.featureId, params.id));
        if (body.tierIds.length > 0) {
          await db.insert(planFeatureTier).values(
            body.tierIds.map((tierId) => ({
              featureId: params.id,
              tierId,
            })),
          );
        }
        const features = await listFeaturesWithTiers();
        return { features };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "UNAUTHORIZED") return status(401, "Sign in");
        if (msg === "FORBIDDEN") return status(403, "Not allowed");
        return status(500, msg);
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        description: t.String({ minLength: 1 }),
        buildStatus: t.Union([t.Literal("exists"), t.Literal("planned")]),
        tierIds: t.Array(t.String()),
      }),
    },
  )
  .delete("/:id", async ({ user: viewer, params, status }) => {
    try {
      await requirePermission({ user: viewer }, { user: ["list"] });
      await db.delete(planFeature).where(eq(planFeature.id, params.id));
      const features = await listFeaturesWithTiers();
      return { features };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "UNAUTHORIZED") return status(401, "Sign in");
      if (msg === "FORBIDDEN") return status(403, "Not allowed");
      return status(500, msg);
    }
  });
```

- [ ] **Step 2: Register the route in app.ts**

In `apps/server/src/server/app.ts`, add the import near the other staff/routes imports:

```ts
import { planFeaturesRoute } from "../routes/plan-features";
```

Then add `.use(planFeaturesRoute)` in the chain after `.use(staffRoute)`.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/plan-features.ts apps/server/src/server/app.ts
git commit -m "feat(server): add plan-features CRUD route"
```

---

## Task 5: Client API helpers

**Files:**
- Create: `apps/web/src/lib/staff-plan-features-api.ts`

- [ ] **Step 1: Write the helpers**

```ts
// apps/web/src/lib/staff-plan-features-api.ts
import { stillApiOrigin } from "@/lib/still-api-origin";

export type PlanTier = {
  id: string;
  name: string;
  sortOrder: number;
  priceYearly: number | null;
  priceMonthly: number | null;
  tagline: string;
};

export type PlanFeature = {
  id: string;
  name: string;
  description: string;
  buildStatus: "exists" | "planned";
  sortOrder: number;
  tierIds: string[];
};

export type PlanCatalogueResponse = {
  tiers: PlanTier[];
  features: PlanFeature[];
};

function baseUrl() {
  return `${stillApiOrigin()}/api/staff/plan-features`;
}

export async function fetchPlanCatalogue(): Promise<PlanCatalogueResponse> {
  const res = await fetch(baseUrl(), { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<PlanCatalogueResponse>;
}

export type PlanFeaturePayload = {
  name: string;
  description: string;
  buildStatus: "exists" | "planned";
  tierIds: string[];
};

export async function createPlanFeature(
  payload: PlanFeaturePayload,
): Promise<PlanFeature[]> {
  const res = await fetch(baseUrl(), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { features: PlanFeature[] };
  return data.features;
}

export async function updatePlanFeature(
  id: string,
  payload: PlanFeaturePayload,
): Promise<PlanFeature[]> {
  const res = await fetch(`${baseUrl()}/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { features: PlanFeature[] };
  return data.features;
}

export async function deletePlanFeature(id: string): Promise<PlanFeature[]> {
  const res = await fetch(`${baseUrl()}/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { features: PlanFeature[] };
  return data.features;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/staff-plan-features-api.ts
git commit -m "feat(web): add staff plan features API helpers"
```

---

## Task 6: Zustand store for create drawer

**Files:**
- Create: `apps/web/src/components/staff/use-plan-feature-drawer.ts`

- [ ] **Step 1: Write the store**

```ts
// apps/web/src/components/staff/use-plan-feature-drawer.ts
"use client";

import { create } from "zustand";

type PlanFeatureDrawerStore = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

export const usePlanFeatureDrawer = create<PlanFeatureDrawerStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

export function openPlanFeatureDrawer() {
  usePlanFeatureDrawer.getState().open();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/staff/use-plan-feature-drawer.ts
git commit -m "feat(web): add plan feature drawer zustand store"
```

---

## Task 7: Create feature drawer

**Files:**
- Create: `apps/web/src/components/staff/plan-feature-create-drawer.tsx`

- [ ] **Step 1: Write the drawer**

```tsx
// apps/web/src/components/staff/plan-feature-create-drawer.tsx
"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import {
  createPlanFeature,
  type PlanFeature,
  type PlanTier,
} from "@/lib/staff-plan-features-api";

import { usePlanFeatureDrawer } from "./use-plan-feature-drawer";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

export function PlanFeatureCreateDrawerRoot({
  tiers,
  onCreated,
}: {
  tiers: PlanTier[];
  onCreated: (features: PlanFeature[]) => void;
}) {
  const { isOpen, close } = usePlanFeatureDrawer();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [buildStatus, setBuildStatus] = useState<"exists" | "planned">("planned");
  const [selectedTierIds, setSelectedTierIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setBuildStatus("planned");
    setSelectedTierIds([]);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      close();
      reset();
    }
  }

  function toggleTier(id: string) {
    setSelectedTierIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  async function handleSubmit() {
    if (!name.trim() || !description.trim()) {
      toast.error("Name and description are required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await createPlanFeature({
        name: name.trim(),
        description: description.trim(),
        buildStatus,
        tierIds: selectedTierIds,
      });
      onCreated(updated);
      toast.success("Feature created.");
      close();
      reset();
    } catch {
      toast.error("Failed to create feature.");
    } finally {
      setSaving(false);
    }
  }

  const orderedTiers = TIER_ORDER.map((id) =>
    tiers.find((t) => t.id === id),
  ).filter(Boolean) as PlanTier[];

  return (
    <DetailVaulSheet
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="Add feature"
      description="New feature will appear in the grid and details view immediately."
    >
      <div className="mx-auto w-full max-w-lg space-y-5 px-4 pb-10 pt-2 sm:max-w-xl">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            Feature name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Taste overlap scores"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Plain language explanation shown on the pricing page and details view…"
            className="min-h-24 resize-none"
          />
        </div>

        {/* Tiers */}
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            Available in
          </label>
          <div className="flex flex-wrap gap-2">
            {orderedTiers.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => toggleTier(tier.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  selectedTierIds.includes(tier.id)
                    ? "border-foreground/20 bg-foreground/10 text-foreground"
                    : "border-muted text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {tier.name}
              </button>
            ))}
          </div>
        </div>

        {/* Build status */}
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            Build status
          </label>
          <div className="flex gap-2">
            {(["exists", "planned"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setBuildStatus(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  buildStatus === s
                    ? "border-foreground/20 bg-foreground/10 text-foreground"
                    : "border-muted text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-full"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Creating…" : "Create feature"}
          </Button>
        </div>
      </div>
    </DetailVaulSheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/staff/plan-feature-create-drawer.tsx
git commit -m "feat(web): add plan feature create drawer"
```

---

## Task 8: Shared inline edit panel

**Files:**
- Create: `apps/web/src/components/staff/plan-feature-inline-edit.tsx`

Shared between grid and details views — shown when a feature row is clicked for editing.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/staff/plan-feature-inline-edit.tsx
"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

import {
  type PlanFeature,
  type PlanTier,
  updatePlanFeature,
} from "@/lib/staff-plan-features-api";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

export function PlanFeatureInlineEdit({
  feature,
  tiers,
  onSaved,
  onCancel,
}: {
  feature: PlanFeature;
  tiers: PlanTier[];
  onSaved: (features: PlanFeature[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(feature.name);
  const [description, setDescription] = useState(feature.description);
  const [buildStatus, setBuildStatus] = useState<"exists" | "planned">(
    feature.buildStatus as "exists" | "planned",
  );
  const [selectedTierIds, setSelectedTierIds] = useState<string[]>(
    feature.tierIds,
  );
  const [saving, setSaving] = useState(false);

  function toggleTier(id: string) {
    setSelectedTierIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    if (!name.trim() || !description.trim()) {
      toast.error("Name and description are required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updatePlanFeature(feature.id, {
        name: name.trim(),
        description: description.trim(),
        buildStatus,
        tierIds: selectedTierIds,
      });
      onSaved(updated);
      toast.success("Feature saved.");
    } catch {
      toast.error("Failed to save feature.");
    } finally {
      setSaving(false);
    }
  }

  const orderedTiers = TIER_ORDER.map((id) =>
    tiers.find((t) => t.id === id),
  ).filter(Boolean) as PlanTier[];

  return (
    <div className="rounded-2xl bg-muted/30 p-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            Feature name
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {/* Build status */}
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            Build status
          </label>
          <div className="flex gap-2">
            {(["exists", "planned"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setBuildStatus(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  buildStatus === s
                    ? "border-foreground/20 bg-foreground/10 text-foreground"
                    : "border-muted text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-20 resize-none"
          />
        </div>

        {/* Tiers */}
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            Available in
          </label>
          <div className="flex flex-wrap gap-2">
            {orderedTiers.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => toggleTier(tier.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  selectedTierIds.includes(tier.id)
                    ? "border-foreground/20 bg-foreground/10 text-foreground"
                    : "border-muted text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {tier.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="rounded-full"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/staff/plan-feature-inline-edit.tsx
git commit -m "feat(web): add plan feature inline edit panel"
```

---

## Task 9: Staff plans topbar

**Files:**
- Create: `apps/web/src/components/staff/staff-plans-topbar.tsx`

- [ ] **Step 1: Write the topbar**

```tsx
// apps/web/src/components/staff/staff-plans-topbar.tsx
"use client";

import { Button } from "@still/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";

import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import type { ListingPresenceViewingPatron } from "@/lib/fetch-listing-presence";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

import { openPlanFeatureDrawer } from "./use-plan-feature-drawer";

/** Max avatars shown before +N pill. */
const MAX_AVATARS = 5;

export type PlansView = "grid" | "details";

export function StaffPlansTopbar({
  viewingPatrons,
  viewerCount,
  view,
  onViewChange,
}: {
  viewingPatrons: ListingPresenceViewingPatron[];
  viewerCount: number;
  view: PlansView;
  onViewChange: (v: PlansView) => void;
}) {
  const visible = viewingPatrons.slice(0, MAX_AVATARS);
  const overflow = viewerCount - visible.length;

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-muted-foreground text-sm">
        <span>Staff</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="font-medium text-foreground">Plans</span>
      </nav>

      <div className="flex-1" />

      {/* Presence */}
      {viewerCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Viewing now</span>
          <TooltipProvider delayDuration={0}>
            <div className="flex items-center">
              {visible.map((patron, i) => (
                <Tooltip key={patron.userId}>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "block size-7 shrink-0 cursor-pointer rounded-full ring-2 ring-background",
                        i > 0 && "-ml-2",
                      )}
                    >
                      <PatronPortraitWithMetalTier
                        handle={patron.handle}
                        avatarUrl={patron.image}
                        name={patron.displayName || patron.handle}
                        className="size-full rounded-full"
                        width={28}
                        height={28}
                        showOnlineStatus
                        presenceState={patron.presenceState}
                        isAnimated={inferAnimatedFromProfileUrl(
                          patron.image,
                          patron.avatarIsAnimated,
                        )}
                        diaryMetalTier={patron.diaryMetalTier}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    <p className="text-xs">
                      {patron.displayName}
                      {patron.handle ? (
                        <span className="ml-1 text-muted-foreground">
                          · @{patron.handle}
                        </span>
                      ) : null}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
              {overflow > 0 && (
                <span
                  className={cn(
                    "-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background",
                    "text-muted-foreground text-xs font-semibold tabular-nums",
                  )}
                >
                  +{overflow}
                </span>
              )}
            </div>
          </TooltipProvider>
        </div>
      )}

      {/* View toggle */}
      <div className="flex rounded-full border border-border bg-background p-0.5">
        {(["grid", "details"] as PlansView[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
              view === v
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Add feature */}
      <Button
        size="sm"
        className="rounded-full"
        onClick={openPlanFeatureDrawer}
      >
        + Add feature
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/staff/staff-plans-topbar.tsx
git commit -m "feat(web): add staff plans topbar with presence avatars + tooltip"
```

---

## Task 10: Grid view

**Files:**
- Create: `apps/web/src/components/staff/staff-plans-grid-view.tsx`

- [ ] **Step 1: Write the grid view**

```tsx
// apps/web/src/components/staff/staff-plans-grid-view.tsx
"use client";

import { cn } from "@still/ui/lib/utils";
import { useState } from "react";

import { type PlanFeature, type PlanTier } from "@/lib/staff-plan-features-api";

import { PlanFeatureInlineEdit } from "./plan-feature-inline-edit";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        status === "exists" ? "bg-emerald-700" : "bg-amber-700",
      )}
      aria-label={status}
    />
  );
}

export function StaffPlansGridView({
  tiers,
  features,
  onFeaturesChange,
}: {
  tiers: PlanTier[];
  features: PlanFeature[];
  onFeaturesChange: (features: PlanFeature[]) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const orderedTiers = TIER_ORDER.map((id) =>
    tiers.find((t) => t.id === id),
  ).filter(Boolean) as PlanTier[];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Feature
            </th>
            {orderedTiers.map((tier) => (
              <th
                key={tier.id}
                className="w-24 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {tier.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => (
            <>
              <tr
                key={feature.id}
                className={cn(
                  "group cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/30",
                  expandedId === feature.id && "bg-muted/30",
                )}
                onClick={() =>
                  setExpandedId(
                    expandedId === feature.id ? null : feature.id,
                  )
                }
              >
                <td className="py-2.5 pr-4">
                  <span className="flex items-center gap-2">
                    <StatusDot status={feature.buildStatus} />
                    <span className="text-foreground/80 text-sm">
                      {feature.name}
                    </span>
                    <span className="ml-auto text-muted-foreground/40 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                      ✎
                    </span>
                  </span>
                </td>
                {orderedTiers.map((tier) => (
                  <td
                    key={tier.id}
                    className="py-2.5 text-center text-muted-foreground"
                  >
                    {feature.tierIds.includes(tier.id) ? (
                      <span className="text-emerald-700 text-base">✓</span>
                    ) : (
                      <span className="text-muted-foreground/20">—</span>
                    )}
                  </td>
                ))}
              </tr>

              {expandedId === feature.id && (
                <tr key={`${feature.id}-edit`}>
                  <td colSpan={orderedTiers.length + 1} className="pb-3 pt-1">
                    <PlanFeatureInlineEdit
                      feature={feature}
                      tiers={tiers}
                      onSaved={(updated) => {
                        onFeaturesChange(updated);
                        setExpandedId(null);
                      }}
                      onCancel={() => setExpandedId(null)}
                    />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/staff/staff-plans-grid-view.tsx
git commit -m "feat(web): add staff plans grid view"
```

---

## Task 11: Details view

**Files:**
- Create: `apps/web/src/components/staff/staff-plans-details-view.tsx`

- [ ] **Step 1: Write the details view**

```tsx
// apps/web/src/components/staff/staff-plans-details-view.tsx
"use client";

import { cn } from "@still/ui/lib/utils";
import { useState } from "react";

import { type PlanFeature, type PlanTier } from "@/lib/staff-plan-features-api";

import { PlanFeatureInlineEdit } from "./plan-feature-inline-edit";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "mt-1 inline-block size-1.5 shrink-0 rounded-full",
        status === "exists" ? "bg-emerald-700" : "bg-amber-700",
      )}
      aria-label={status}
    />
  );
}

export function StaffPlansDetailsView({
  tiers,
  features,
  onFeaturesChange,
}: {
  tiers: PlanTier[];
  features: PlanFeature[];
  onFeaturesChange: (features: PlanFeature[]) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const orderedTiers = TIER_ORDER.map((id) =>
    tiers.find((t) => t.id === id),
  ).filter(Boolean) as PlanTier[];

  return (
    <div className="space-y-10">
      {orderedTiers.map((tier) => {
        const tierFeatures = features.filter((f) =>
          f.tierIds.includes(tier.id),
        );

        return (
          <section key={tier.id}>
            {/* Tier header */}
            <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tier.name}
              </span>
              <span className="text-muted-foreground/50 text-sm">
                {tier.tagline}
              </span>
              <span className="ml-auto text-muted-foreground/40 text-xs">
                {tier.priceYearly == null
                  ? "Free"
                  : `$${(tier.priceYearly / 100).toFixed(0)}/yr`}
              </span>
            </div>

            {/* Feature rows */}
            <div className="space-y-1">
              {tierFeatures.length === 0 && (
                <p className="text-muted-foreground/50 text-sm">
                  No features assigned to this tier yet.
                </p>
              )}
              {tierFeatures.map((feature) => (
                <div key={feature.id}>
                  <div
                    className={cn(
                      "group grid cursor-pointer grid-cols-[160px_1fr_20px] items-start gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/30",
                      expandedId === feature.id && "bg-muted/30",
                    )}
                    onClick={() =>
                      setExpandedId(
                        expandedId === feature.id ? null : feature.id,
                      )
                    }
                  >
                    <div className="flex items-start gap-2 pt-0.5">
                      <StatusDot status={feature.buildStatus} />
                      <span className="text-foreground/80 text-sm font-medium leading-snug">
                        {feature.name}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                    <span className="text-muted-foreground/30 text-xs opacity-0 transition-opacity group-hover:opacity-100 pt-0.5">
                      ✎
                    </span>
                  </div>

                  {expandedId === feature.id && (
                    <div className="mt-1 px-3 pb-2">
                      <PlanFeatureInlineEdit
                        feature={feature}
                        tiers={tiers}
                        onSaved={(updated) => {
                          onFeaturesChange(updated);
                          setExpandedId(null);
                        }}
                        onCancel={() => setExpandedId(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/staff/staff-plans-details-view.tsx
git commit -m "feat(web): add staff plans details view"
```

---

## Task 12: Shell + page

**Files:**
- Create: `apps/web/src/components/staff/staff-plans-shell.tsx`
- Create: `apps/web/src/app/(app)/staff/plans/page.tsx`

- [ ] **Step 1: Write the shell (client component — owns state + presence)**

```tsx
// apps/web/src/components/staff/staff-plans-shell.tsx
"use client";

import { staffPlansRoomId } from "@still/realtime";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useListingPresence } from "@/hooks/use-listing-presence";
import {
  fetchPlanCatalogue,
  type PlanFeature,
  type PlanTier,
} from "@/lib/staff-plan-features-api";

import { PlanFeatureCreateDrawerRoot } from "./plan-feature-create-drawer";
import { StaffPlansDetailsView } from "./staff-plans-details-view";
import { StaffPlansGridView } from "./staff-plans-grid-view";
import { StaffPlansTopbar, type PlansView } from "./staff-plans-topbar";

export function StaffPlansShell() {
  const [view, setView] = useState<PlansView>("grid");
  const [tiers, setTiers] = useState<PlanTier[]>([]);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [loading, setLoading] = useState(true);

  // Presence — reuse useListingPresence with the staff:plans room ID override.
  // listingKind/listingId are unused when roomId is provided directly.
  const { viewingPatrons, viewerCount } = useListingPresence({
    roomId: staffPlansRoomId(),
    listingKind: "movie", // required by type but unused — roomId takes precedence
    listingId: 0,
  });

  useEffect(() => {
    fetchPlanCatalogue()
      .then(({ tiers, features }) => {
        setTiers(tiers);
        setFeatures(features);
      })
      .catch(() => toast.error("Failed to load plan catalogue."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-background">
        <StaffPlansTopbar
          viewingPatrons={viewingPatrons}
          viewerCount={viewerCount}
          view={view}
          onViewChange={setView}
        />
        <div className="p-5">
          {view === "grid" ? (
            <StaffPlansGridView
              tiers={tiers}
              features={features}
              onFeaturesChange={setFeatures}
            />
          ) : (
            <StaffPlansDetailsView
              tiers={tiers}
              features={features}
              onFeaturesChange={setFeatures}
            />
          )}
        </div>
      </div>

      <PlanFeatureCreateDrawerRoot
        tiers={tiers}
        onCreated={setFeatures}
      />
    </>
  );
}
```

- [ ] **Step 2: Write the page (server component — auth gate)**

```tsx
// apps/web/src/app/(app)/staff/plans/page.tsx
import { redirect } from "next/navigation";

import { StaffPlansShell } from "@/components/staff/staff-plans-shell";
import { authServer } from "@/lib/auth-server";

const STAFF_ROLES = ["owner", "admin", "moderator", "support"];

export default async function StaffPlansPage() {
  const session = await authServer();
  const role = session?.user?.role ?? "user";
  if (!session || !STAFF_ROLES.includes(role)) redirect("/home");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="mb-1 font-semibold text-2xl">Plans</h1>
      <p className="mb-6 text-muted-foreground text-sm">
        Subscription tier feature catalogue. Changes are live immediately.
      </p>
      <StaffPlansShell />
    </div>
  );
}
```

- [ ] **Step 3: Check `useListingPresence` returns `viewingPatrons` and `viewerCount` directly**

Open `apps/web/src/hooks/use-listing-presence.ts`. The hook returns `ListingPresenceSnapshot` which is `{ viewerCount, viewingPatrons }`. The shell destructures these correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/staff/staff-plans-shell.tsx "apps/web/src/app/(app)/staff/plans/page.tsx"
git commit -m "feat(web): add staff plans page and shell"
```

---

## Task 13: Add Plans link to staff page

**Files:**
- Modify: `apps/web/src/app/(app)/staff/page.tsx`

- [ ] **Step 1: Add a nav link to `/staff/plans`**

In `apps/web/src/app/(app)/staff/page.tsx`, add after the `<h1>` and `<p>` header:

```tsx
import Link from "next/link";
```

And in the JSX, before `<StaffUsersTab>`:

```tsx
<div className="mb-6 flex gap-3">
  <Link
    href="/staff/plans"
    className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
  >
    Plans →
  </Link>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/(app)/staff/page.tsx"
git commit -m "feat(web): add Plans link on staff page"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `/staff/plans` route with server auth gate → Task 12
- ✅ `plan_tier`, `plan_feature`, `plan_feature_tier` DB tables → Task 1
- ✅ Initial seed with all 33 features → Task 2
- ✅ `staffPlansRoomId()` room ID → Task 3
- ✅ GET / POST / PATCH / DELETE routes → Task 4
- ✅ Typed client helpers → Task 5
- ✅ Presence with max-5 avatars + Radix tooltip (name · @handle) → Task 9
- ✅ View toggle (grid / details) → Tasks 9, 12
- ✅ Grid view: feature matrix, ✓/—, inline edit on row click → Task 10
- ✅ Details view: per-tier sections, full description, hover edit → Task 11
- ✅ Inline edit: name, description, tier chips, build status → Task 8
- ✅ Optimistic update (server returns full updated list) → Tasks 8, 7
- ✅ sonner toasts on success/error → Tasks 7, 8
- ✅ `DetailVaulSheet` for create drawer → Task 7
- ✅ Zustand store for drawer open/close → Task 6
- ✅ Design patterns: `bg-background`, `rounded-full`, `Button`, `Input`, `Textarea` from `@still/ui` → all web tasks
- ✅ Plans link on staff page → Task 13

**Placeholder scan:** No TBD, TODO, or placeholder patterns found.

**Type consistency:**
- `PlanFeature.tierIds: string[]` defined in Task 5, consumed identically in Tasks 7, 8, 10, 11, 12.
- `PlanTier` defined in Task 5, passed through shell → topbar / grid / details / drawer consistently.
- `useListingPresence` returns `ListingPresenceSnapshot` which has `{ viewerCount, viewingPatrons }` — shell destructures these correctly.
- `staffPlansRoomId()` exported from `@still/realtime` after Task 3, imported in shell in Task 12. ✅
