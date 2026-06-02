"use client";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	StillPopoverSelect,
	type StillPopoverSelectOption,
} from "@/components/ui/still-popover-select";

export type ContentVisibility = "public" | "followers" | "friends" | "private";

const VISIBILITY_FIELD_OPTIONS: StillPopoverSelectOption[] = [
	{ value: "public", label: "Public — anyone" },
	{ value: "followers", label: "Followers — people who follow you" },
	{ value: "friends", label: "Friends — only people you follow back" },
	{ value: "private", label: "Private — only you" },
];

/** Inline pills — same segmented track as `/home` catalogue filters. */
const VISIBILITY_PILL_OPTIONS: readonly {
	id: ContentVisibility;
	label: string;
	title: string;
}[] = [
	{ id: "public", label: "Public", title: "Public — anyone" },
	{
		id: "followers",
		label: "Followers",
		title: "Followers — people who follow you",
	},
	{
		id: "friends",
		label: "Friends",
		title: "Friends — only people you follow back",
	},
	{ id: "private", label: "Private", title: "Private — only you" },
];

export type VisibilitySelectVariant = "field" | "pills";

export function VisibilitySelect({
	id,
	value,
	onChange,
	disabled,
	variant = "field",
	popoverPositionerClassName,
	popoverSide = "top",
}: {
	id: string;
	value: ContentVisibility;
	onChange: (next: ContentVisibility) => void;
	disabled?: boolean;
	/** `pills` — tap segments (review / quick log); `field` — dropdown row (settings). */
	variant?: VisibilitySelectVariant;
	popoverPositionerClassName?: string;
	popoverSide?: "top" | "bottom" | "left" | "right";
}) {
	if (variant === "pills") {
		return (
			<SegmentedPillToolbar
				layoutId={`${id}-visibility-pill`}
				aria-label="Who can see this"
				value={value}
				onChange={onChange}
				options={VISIBILITY_PILL_OPTIONS}
				compact
				disabled={disabled}
				className="mx-auto"
			/>
		);
	}

	return (
		<StillPopoverSelect
			id={id}
			value={value}
			onChange={(next) => onChange(next as ContentVisibility)}
			options={VISIBILITY_FIELD_OPTIONS}
			placeholder="Who can see this"
			listAriaLabel="Choose who can see this"
			disabled={disabled}
			popoverPositionerClassName={popoverPositionerClassName}
			popoverSide={popoverSide}
		/>
	);
}
