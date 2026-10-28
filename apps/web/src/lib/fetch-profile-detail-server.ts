import "server-only";

import { cache } from "react";
import {
	type ContentPrivateKind,
	contentPrivateCodeFromEdenError,
	contentPrivateKindFromCode,
} from "@/lib/content-private";
import { edenApiErrorStatus } from "@/lib/eden-api-error";
import { serverApi } from "@/lib/server-api";

export type ProfileDetailFetchResult =
	| { status: "ok"; data: unknown }
	| { status: "private"; kind: ContentPrivateKind }
	| { status: "missing" };

/**
 * React-cached GET /api/profiles/:handle — executes at most once per RSC render pass.
 * Deduplicates the call between generateMetadata and the page component.
 * Distinguishes missing (404) from private (403 PROFILE_PRIVATE).
 */
export const fetchProfileDetailServer = cache(
	async (handle: string): Promise<ProfileDetailFetchResult> => {
		try {
			const api = await serverApi();
			const res = await api.api.profiles({ handle }).get();
			if (res.error) {
				const httpStatus = edenApiErrorStatus(res.error);
				const privateCode = contentPrivateCodeFromEdenError(res.error);
				if (httpStatus === 403 && privateCode) {
					return {
						status: "private",
						kind: contentPrivateKindFromCode(privateCode),
					};
				}
				if (process.env.NODE_ENV === "development") {
					console.error(
						"[fetchProfileDetailServer] API error",
						handle,
						httpStatus ?? res.status,
						res.error,
					);
				}
				return { status: "missing" };
			}
			if (!res.data) return { status: "missing" };
			return { status: "ok", data: res.data };
		} catch (err) {
			if (process.env.NODE_ENV === "development") {
				console.error("[fetchProfileDetailServer] fetch failed", handle, err);
			}
			return { status: "missing" };
		}
	},
);
