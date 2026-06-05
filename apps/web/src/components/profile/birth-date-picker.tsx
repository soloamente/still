"use client";

import { LogWatchedDatePicker } from "@/components/log/log-watched-date-picker";
import { APP_MODAL_POPOVER_POSITIONER_CLASS } from "@/lib/app-modal-layer";

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
	return (
		<LogWatchedDatePicker
			id={id}
			value={value}
			onChange={onChange}
			allowEmpty
			emptyPlaceholder="Select date of birth"
			hideTodayShortcut
			popoverSide="bottom"
			popoverPositionerClassName={APP_MODAL_POPOVER_POSITIONER_CLASS}
		/>
	);
}
