import type React from "react";

/** Small filled X — radial toolkit hub cancel hint. */
function IconXmarkFill12({
	size = "12px",
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 12 12"
			{...props}
			aria-hidden={props["aria-hidden"] ?? true}
		>
			<title>Close</title>
			<path
				d="m2.25,10.5c-.192,0-.384-.073-.53-.22-.293-.293-.293-.768,0-1.061L9.22,1.72c.293-.293.768-.293,1.061,0s.293.768,0,1.061l-7.5,7.5c-.146.146-.338.22-.53.22Z"
				fill="currentColor"
			/>
			<path
				d="m9.75,10.5c-.192,0-.384-.073-.53-.22L1.72,2.78c-.293-.293-.293-.768,0-1.061s.768-.293,1.061,0l7.5,7.5c.293.293.293.768,0,1.061-.146.146-.338.22-.53.22Z"
				fill="currentColor"
			/>
		</svg>
	);
}

export default IconXmarkFill12;
