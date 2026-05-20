import type React from "react";

/** Filled pen — diary edit control on film/TV detail hero actions. */
function IconPen2Fill({
	size = "18px",
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 18 18"
			{...props}
			aria-hidden={props["aria-hidden"] ?? true}
		>
			<title>Pen</title>
			<path
				d="M11.414,2.848L3.605,10.657c-.863,.864-1.401,3.406-1.593,4.459-.044,.242,.034,.491,.208,.665,.142,.142,.333,.22,.53,.22,.044,0,.089-.004,.134-.012,1.053-.191,3.595-.729,4.459-1.593l7.809-7.809c1.03-1.031,1.03-2.707,0-3.738-.998-.998-2.74-.997-3.738,0Zm2.677,2.677l-.94,.94-1.617-1.617,.94-.94c.216-.216,.503-.334,.809-.334s.592,.119,.808,.334c.445,.446,.445,1.171,0,1.617Z"
				fill="currentColor"
			/>
		</svg>
	);
}

export default IconPen2Fill;
