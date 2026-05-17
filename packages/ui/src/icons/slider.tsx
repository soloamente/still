import type React from "react";

function IconSlider({
	size = "18px",
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
	return (
		<svg
			aria-label="Slider Fill 18"
			xmlns="http://www.w3.org/2000/svg"
			x="0px"
			y="0px"
			width={size}
			height={size}
			viewBox="0 0 18 18"
			{...props}
		>
			<path
				d="m15.25,11.5h-5.8258c.0415.2451.0758.4932.0758.75s-.0343.5049-.0758.75h5.8258c.4141,0,.75-.3359.75-.75s-.3359-.75-.75-.75Z"
				fill="currentColor"
				strokeWidth="0"
				data-color="color-2"
			/>
			<path
				d="m5,15.25c-1.6541,0-3-1.3459-3-3s1.3459-3,3-3,3,1.3459,3,3-1.3459,3-3,3Z"
				strokeWidth="0"
				fill="currentColor"
			/>
			<path
				d="m8.5,5.75c0-.2568.0343-.5049.0758-.75H2.75c-.4141,0-.75.3359-.75.75s.3359.75.75.75h5.8258c-.0415-.2451-.0758-.4932-.0758-.75Z"
				fill="currentColor"
				strokeWidth="0"
				data-color="color-2"
			/>
			<path
				d="m13,8.75c-1.6541,0-3-1.3459-3-3s1.3459-3,3-3,3,1.3459,3,3-1.3459,3-3,3Z"
				strokeWidth="0"
				fill="currentColor"
			/>
		</svg>
	);
}

export default IconSlider;
