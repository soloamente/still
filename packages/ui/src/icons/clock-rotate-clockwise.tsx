import type React from "react";

function IconClockRotateClockwise({
	size = "20px",
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
	return (
		<svg
			aria-label="Clock Rotate Clockwise"
			xmlns="http://www.w3.org/2000/svg"
			x="0px"
			y="0px"
			width={size}
			height={size}
			viewBox="0 0 20 20"
			{...props}
		>
			<polyline
				points="10 7 10 10 12 12"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
				data-color="color-2"
			/>
			<polygon
				points="4.367 16.956 3.771 13.202 7.516 13.855 4.367 16.956"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
				fill="currentColor"
			/>
			<path
				d="m5,14.899c1.271,1.297,3.041,2.101,5,2.101,3.866,0,7-3.134,7-7s-3.134-7-7-7c-2.792,0-5.203,1.635-6.326,4"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
		</svg>
	);
}

export default IconClockRotateClockwise;
