"use client";

import { PlanFilterChip } from "./plan-filter-chip";

const STATUS_OPTIONS = [
	{ id: "exists" as const, label: "Exists" },
	{ id: "planned" as const, label: "Planned" },
];

export function PlanBuildStatusChipFilter({
	value,
	onChange,
	disabled = false,
}: {
	value: "exists" | "planned";
	onChange: (next: "exists" | "planned") => void;
	disabled?: boolean;
}) {
	return (
		<fieldset
			className="flex w-fit flex-wrap gap-1.5 border-0 p-0"
			aria-label="Build status"
		>
			{STATUS_OPTIONS.map((option) => (
				<PlanFilterChip
					key={option.id}
					label={option.label}
					selected={value === option.id}
					onClick={() => onChange(option.id)}
					disabled={disabled}
				/>
			))}
		</fieldset>
	);
}
