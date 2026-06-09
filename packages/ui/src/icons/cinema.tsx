import type React from "react";

/** Film dice — browse / search “Movies / Films” affordance (Nucleo-style 18×18). */
function IconCinema({
	size = "18px",
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
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
			<title>Cinema</title>
			<path
				d="M16.25,17h-7.25c-.414,0-.75-.336-.75-.75s.336-.75,.75-.75h7.25c.414,0,.75,.336,.75,.75s-.336,.75-.75,.75Z"
				fill="currentColor"
			/>
			<path
				d="M9,1C4.589,1,1,4.589,1,9s3.589,8,8,8,8-3.589,8-8S13.411,1,9,1Zm-3.5,9.5c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5,.672,1.5,1.5-.672,1.5-1.5,1.5Zm3.5,3.5c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5,.672,1.5,1.5-.672,1.5-1.5,1.5Zm0-7c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5,.672,1.5,1.5-.672,1.5-1.5,1.5Zm3.5,3.5c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5,.672,1.5,1.5-.672,1.5-1.5,1.5Z"
				fill="currentColor"
			/>
		</svg>
	);
}

export default IconCinema;
