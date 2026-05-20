import "server-only";

import type { DiaryLogRow } from "@/components/diary/diary-entry";
import { coerceDiaryLogRows } from "@/lib/diary-lobby-order";
import { serverApi } from "@/lib/server-api";

type ServerApiClient = Awaited<ReturnType<typeof serverApi>>;

/**
 * RSC helper for **`GET /api/logs/me`** — forwards the visitor’s cookies via Eden and
 * normalises **`watch_venue` / `watchVenue`** so the diary lobby filter always sees a
 * consistent shape (see `coerceDiaryLogRows`).
 *
 * Pass an existing **`serverApi()`** client when you already have one to avoid a second
 * factory call; omit it to create a client only for this fetch.
 */
export async function fetchMyLogsMeServer(
	api?: ServerApiClient,
): Promise<DiaryLogRow[]> {
	const client = api ?? (await serverApi());
	try {
		// Eden Treaty usually resolves even on 4xx/5xx — check **`error`**; only network/parser issues throw.
		const logRes = await client.api.logs.me.get();
		if (logRes.error != null) {
			console.error(
				"[fetchMyLogsMeServer] GET /api/logs/me failed:",
				logRes.error,
				"status" in logRes
					? (logRes as { status?: unknown }).status
					: undefined,
			);
			return [];
		}
		const rows = (logRes.data as unknown as DiaryLogRow[]) ?? [];
		return coerceDiaryLogRows(rows);
	} catch (err) {
		console.error("[fetchMyLogsMeServer] GET /api/logs/me threw:", err);
		return [];
	}
}
