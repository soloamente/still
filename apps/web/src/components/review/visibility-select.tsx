"use client";

import {
	StillPopoverSelect,
	type StillPopoverSelectOption,
} from "@/components/ui/still-popover-select";

export type ContentVisibility = "public" | "followers" | "friends" | "private";

const VISIBILITY_OPTIONS: StillPopoverSelectOption[] = [
	{ value: "public", label: "Public — anyone" },
	{ value: "followers", label: "Followers — people who follow you" },
	{ value: "friends", label: "Friends — only people you follow back" },
	{ value: "private", label: "Private — only you" },
];

export function VisibilitySelect({
	id,
	value,
	onChange,
	disabled,
	popoverPositionerClassName,
	popoverSide = "top",
}: {
	id: string;
	value: ContentVisibility;
	onChange: (next: ContentVisibility) => void;
	disabled?: boolean;
	popoverPositionerClassName?: string;
	popoverSide?: "top" | "bottom" | "left" | "right";
}) {
	return (
		<StillPopoverSelect
			id={id}
			value={value}
			onChange={(next) => onChange(next as ContentVisibility)}
			options={VISIBILITY_OPTIONS}
			placeholder="Who can see this"
			listAriaLabel="Choose who can see this"
			disabled={disabled}
			popoverPositionerClassName={popoverPositionerClassName}
			popoverSide={popoverSide}
		/>
	);
}
