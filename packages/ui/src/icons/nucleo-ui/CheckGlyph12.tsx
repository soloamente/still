import type { SVGProps } from "react";

export type CheckGlyph12Props = SVGProps<SVGSVGElement>;

/** Nucleo UI check (12px glyph). */
export function CheckGlyph12(props: CheckGlyph12Props) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={12}
			height={12}
			viewBox="0 0 12 12"
			{...props}
		>
			<path
				d="m4.01,10.754c-.225.007-.458-.111-.6-.3l-2.25-3c-.249-.332-.181-.802.15-1.05.333-.248.802-.181,1.05.15l1.652,2.203L9.642,1.294c.25-.331.72-.396,1.05-.147.331.25.396.72.147,1.05l-6.23,8.258c-.142.188-.363.298-.599.298Z"
				fill="currentColor"
			/>
		</svg>
	);
}
