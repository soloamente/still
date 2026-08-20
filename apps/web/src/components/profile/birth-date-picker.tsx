"use client";

import { LogWatchedDatePicker } from "@/components/log/log-watched-date-picker";
import { meFieldControlClass } from "@/components/profile/me-form-field";
import { APP_MODAL_POPOVER_POSITIONER_CLASS } from "@/lib/app-modal-layer";
import { normalizeProfileBirthDateYmd } from "@/lib/normalize-profile-birth-date";

/**
 * Date-of-birth field for the adult-content enable dialog — same Mobbin-style
 * calendar popover as quick-log “Watched on”, without a “Today” shortcut.
 */
export function BirthDatePicker({
	id,
	value,
	onChange,
}: {
	id: string;
	value: string;
	onChange: (ymd: string) => void;
}) {
	// API / Eden may hand back ISO datetimes — coerce so the trigger shows the day.
	const ymd = normalizeProfileBirthDateYmd(value) ?? "";

	return (
		<LogWatchedDatePicker
			id={id}
			value={ymd}
			onChange={(next) => onChange(normalizeProfileBirthDateYmd(next) ?? next)}
			allowEmpty
			emptyPlaceholder="Select date of birth"
			hideTodayShortcut
			popoverSide="bottom"
			popoverPositionerClassName={APP_MODAL_POPOVER_POSITIONER_CLASS}
			triggerClassName={meFieldControlClass(
				"flex w-full min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left",
			)}
			popoverContentClassName="bg-card"
		/>
	);
}
