import type React from "react";

/** Outline quotes — header shortcut when not on `/quotes` (Nucleo-style 18×18). */
function IconQuotes({
	size = "18px",
	strokeWidth = 1.5,
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string; strokeWidth?: number }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			x="0px"
			y="0px"
			width={size}
			height={size}
			viewBox="0 0 18 18"
			{...props}
			aria-hidden={props["aria-hidden"] ?? true}
		>
			<title>Quotes</title>
			<path
				d="M9,1.75C4.996,1.75,1.75,4.996,1.75,9c0,1.319,.358,2.552,.973,3.617,.43,.806-.053,2.712-.973,3.633,1.25,.068,2.897-.497,3.633-.973,.489,.282,1.264,.656,2.279,.848,.433,.082,.881,.125,1.338,.125,4.004,0,7.25-3.246,7.25-7.25S13.004,1.75,9,1.75Z"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={strokeWidth}
			/>
			<path
				d="M5.75,9.25h2v1.5h-2v-1.5c0-1.793,.598-2.582,1.674-3"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={strokeWidth}
			/>
			<path
				d="M10.25,9.25h2v1.5h-2v-1.5c0-1.793,.598-2.582,1.674-3"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={strokeWidth}
			/>
		</svg>
	);
}

export default IconQuotes;
