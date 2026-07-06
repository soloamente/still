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
	key: string | null;
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
	const res = await fetch(baseUrl(), {
		credentials: "include",
		cache: "no-store",
	});
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
