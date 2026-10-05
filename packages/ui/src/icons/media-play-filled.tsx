import type React from "react";

/** Nucleo Micro — filled play triangle (no circle). */
function IconMediaPlayFilled({
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
			<title>Play</title>
			<path
				d="m5,5.4826v9.0348c0,1.122,1.198,1.8376,2.1859,1.3056l8.3894-4.5174c1.0398-.5599,1.0398-2.0513,0-2.6112L7.1859,4.177c-.9879-.532-2.1859.1836-2.1859,1.3056Z"
				fill="currentColor"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
		</svg>
	);
}

export default IconMediaPlayFilled;
