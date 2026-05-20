import type React from "react";

function IconHeart({
	size = "20px",
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
	return (
		<svg
			aria-label="Heart"
			xmlns="http://www.w3.org/2000/svg"
			x="0px"
			y="0px"
			width={size}
			height={size}
			viewBox="0 0 20 20"
			{...props}
		>
			<path
				d="m9.529,16.474c.297.155.644.155.941,0,1.57-.819,6.53-3.788,6.53-8.614.008-2.12-1.704-3.847-3.827-3.86-1.277.016-2.464.66-3.173,1.72-.71-1.06-1.897-1.704-3.173-1.72-2.123.013-3.835,1.739-3.827,3.86,0,4.827,4.96,7.795,6.53,8.614h0Z"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
		</svg>
	);
}

export default IconHeart;
