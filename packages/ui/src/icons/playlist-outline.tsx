import type React from "react";

/**
 * Outline playlist — home chrome lists shortcut when not on `/lists`.
 * Pair with `list-play` (filled) for inactive vs active, like ticket / ticket-filled.
 */
function IconPlaylistOutline({
	strokeWidth = 1.5,
	size = "18px",
	...props
}: React.SVGProps<SVGSVGElement> & { strokeWidth?: number; size?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 18 18"
			{...props}
			aria-hidden={props["aria-hidden"] ?? true}
		>
			<title>List with play</title>
			<path
				d="M11.037,9.629l-3.14-1.832c-.287-.167-.647,.04-.647,.371v3.663c0,.332,.36,.539,.647,.371l3.14-1.832c.284-.166,.284-.577,0-.743Z"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={strokeWidth}
			/>
			<rect
				x="2.25"
				y="4.75"
				width="13.5"
				height="10.5"
				rx="2"
				ry="2"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={strokeWidth}
			/>
			<line
				x1="4.75"
				y1="1.75"
				x2="13.25"
				y2="1.75"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={strokeWidth}
			/>
		</svg>
	);
}

export default IconPlaylistOutline;
