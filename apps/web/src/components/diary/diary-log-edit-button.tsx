"use client";

import { Button } from "@still/ui/components/button";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

import type { DiaryLogRow } from "@/components/diary/diary-entry";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import { diaryLogToQuickLogOpenPayload } from "@/lib/diary-open-log";

/**
 * Opens the shared **Quick log** sheet in PATCH mode for this row — keeps diary tickets
 * free of invalid `<button>` inside `<a>` by living beside the title link instead.
 */
export function DiaryLogEditButton({ row }: { row: DiaryLogRow }) {
	const router = useRouter();
	const openQuickLog = useQuickLog((s) => s.open);
	if (!(row.movie ?? row.tv)) return null;

	return (
		<Button
			type="button"
			variant="ghost-light"
			size="pill"
			className="mt-2 w-full border border-white/25 bg-black/25 text-white text-xs hover:bg-black/35"
			onClick={() => {
				const payload = diaryLogToQuickLogOpenPayload(row, () => {
					router.refresh();
				});
				if (payload) openQuickLog(payload);
			}}
		>
			<Pencil className="size-3.5 opacity-90" aria-hidden />
			Edit log
		</Button>
	);
}
