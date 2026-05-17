import type React from "react";

function IconBell({
	size = "20px",
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
	return (
		<svg
			aria-label="Bell"
			xmlns="http://www.w3.org/2000/svg"
			x="0px"
			y="0px"
			width={size}
			height={size}
			viewBox="0 0 20 20"
			{...props}
		>
			<path
				d="m17,13.5c-1.1046,0-2-.8954-2-2v-3.5c0-2.7614-2.2386-5-5-5h0,0,0c-2.7614,0-5,2.2386-5,5v3.5c0,1.1046-.8954,2-2,2h14Z"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
			<path
				d="m7.5504,16c.2317,1.1411,1.2401,2,2.4496,2s2.2179-.8589,2.4496-2h-4.8992Z"
				fill="currentColor"
				strokeWidth="0"
				data-color="color-2"
			/>
		</svg>
	);
}

export default IconBell;
