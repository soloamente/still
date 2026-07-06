import { db, planFeature, planFeatureTier, planTier } from "@still/db";
import { asc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context, requirePermission } from "../context";
import { makeId } from "../lib/cuid";

/** Stable slug for plan_feature.key — staff-created rows are display-only, not entitlement gates. */
function featureKeyFromName(name: string): string {
	const base = name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 48);
	return base.length > 0 ? base : "feature";
}

async function uniqueFeatureKey(name: string): Promise<string> {
	const base = featureKeyFromName(name);
	const existing = await db
		.select({ key: planFeature.key })
		.from(planFeature)
		.where(eq(planFeature.key, base))
		.limit(1);
	if (existing.length === 0) return base;

	let suffix = 2;
	while (suffix < 100) {
		const candidate = `${base}_${suffix}`.slice(0, 64);
		const clash = await db
			.select({ key: planFeature.key })
			.from(planFeature)
			.where(eq(planFeature.key, candidate))
			.limit(1);
		if (clash.length === 0) return candidate;
		suffix += 1;
	}
	return `${base}_${makeId("feat").slice(-8)}`;
}

type PlanFeatureRow = {
	id: string;
	key: string | null;
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
		key: f.key,
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
				const key = await uniqueFeatureKey(body.name);
				const existing = await db
					.select({ o: planFeature.sortOrder })
					.from(planFeature)
					.orderBy(asc(planFeature.sortOrder));
				const sortOrder = existing.length;
				await db.insert(planFeature).values({
					id,
					key,
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
