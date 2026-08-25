import type React from "react";

/**
 * Filled circle with X — toast error leading mark (Nucleo-style path).
 * Uses `currentColor`; callers set red via `text-destructive` (no pill well).
 */
function IconCircleXmarkFill({
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
			<title>Error</title>
			<path
				d="m15.657,4.343c-3.119-3.119-8.195-3.119-11.314,0s-3.119,8.194,0,11.313c1.56,1.56,3.608,2.339,5.657,2.339s4.098-.78,5.657-2.339c3.119-3.119,3.119-8.194,0-11.313Zm-1.95,7.95c.391.391.391,1.023,0,1.414-.195.195-.451.293-.707.293s-.512-.098-.707-.293l-2.293-2.293-2.293,2.293c-.195.195-.451.293-.707.293s-.512-.098-.707-.293c-.391-.391-.391-1.023,0-1.414l2.293-2.293-2.293-2.293c-.391-.391-.391-1.023,0-1.414s1.023-.391,1.414,0l2.293,2.293,2.293-2.293c.391-.391,1.023-.391,1.414,0s.391,1.023,0,1.414l-2.293,2.293,2.293,2.293Z"
				strokeWidth={0}
				fill="currentColor"
			/>
		</svg>
	);
}

export default IconCircleXmarkFill;
