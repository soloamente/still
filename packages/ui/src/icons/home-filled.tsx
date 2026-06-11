import type React from "react";

/** Filled home — mobile tab bar and primary hub affordance (Nucleo-style 20×20). */
function IconHomeFilled({
	size = "20px",
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
	return (
		<svg
			aria-label="Home"
			xmlns="http://www.w3.org/2000/svg"
			x="0px"
			y="0px"
			width={size}
			height={size}
			viewBox="0 0 20 20"
			{...props}
		>
			<path
				d="m4.378,6.114l5.082-3.267c.329-.212.752-.212,1.082,0l5.082,3.267c.859.552,1.378,1.503,1.378,2.524v5.362c0,1.657-1.343,3-3,3H6c-1.657,0-3-1.343-3-3v-5.362c0-1.021.519-1.972,1.378-2.524Z"
				fill="currentColor"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
		</svg>
	);
}

export default IconHomeFilled;
