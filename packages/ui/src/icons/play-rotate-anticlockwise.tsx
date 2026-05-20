import type React from "react";

/** Play + anticlockwise arc — “watch again” on film/TV detail hero actions. */
function IconPlayRotateAnticlockwise({
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
			<title>Watch again</title>
			<path
				d="m15.0003,14.8986c-1.2705,1.2968-3.0415,2.1014-5.0003,2.1014-3.866,0-7-3.134-7-7s3.134-7,7-7c2.7923,0,5.2028,1.635,6.3263,3.9999"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
			<polygon
				points="15.633 16.9565 16.2293 13.2018 12.4842 13.8555 15.633 16.9565"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
				fill="currentColor"
			/>
			<polygon
				points="9 7.75 12 10 9 12.25 9 7.75"
				fill="currentColor"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
		</svg>
	);
}

export default IconPlayRotateAnticlockwise;
