import type React from "react";

/** Outbound share arrow — film detail top bar and other share affordances. */
function IconShareOut({
	size = "20px",
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 20 20"
			{...props}
			aria-hidden={props["aria-hidden"] ?? true}
		>
			<title>Share</title>
			<path
				d="m17,11.855c-.616-.538-3.15-2.626-7-2.626s-6.384,2.088-7,2.626"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
			<polyline
				points="15.104 6.719 17 11.855 11.715 13.281"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
		</svg>
	);
}

export default IconShareOut;
