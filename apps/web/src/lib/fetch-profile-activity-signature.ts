import "server-only";

import {
	type ActivitySignaturePayload,
	normalizeActivitySignaturePayload,
} from "@/lib/activity-signature";
import { serverApi } from "@/lib/server-api";

export async function fetchProfileActivitySignature(
	handle: string,
): Promise<ActivitySignaturePayload | null> {
	const api = await serverApi();
	const res = await api.api
		.profiles({ handle })
		["activity-signature"].get()
		.catch(() => ({ data: null, error: true }));
	if (res.error || !res.data) return null;
	return normalizeActivitySignaturePayload(
		res.data as ActivitySignaturePayload,
	);
}
