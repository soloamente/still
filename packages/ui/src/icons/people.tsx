import type React from "react";

/** Two patrons — browse / search “People” affordance (Nucleo-style 20×20). */
function IconPeople({
	size = "20px",
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			x="0px"
			y="0px"
			width={size}
			height={size}
			viewBox="0 0 20 20"
			{...props}
			aria-hidden={props["aria-hidden"] ?? true}
		>
			<title>People</title>
			<circle cx="5.75" cy="4" r="2" fill="currentColor" strokeWidth="0" />
			<path
				d="m8.25,12H3.25l.444-2.369c.177-.946,1.003-1.631,1.966-1.631h.18c.962,0,1.788.685,1.966,1.631l.444,2.369Z"
				fill="currentColor"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
			<polygon
				points="6.5 17 5 17 4.5 12.5 7 12.5 6.5 17"
				fill="currentColor"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
			<circle cx="14.25" cy="4" r="2" fill="currentColor" strokeWidth="0" />
			<path
				d="m16.75,14h-5l.533-4.264c.124-.992.967-1.736,1.967-1.736h0c1,0,1.843.744,1.967,1.736l.533,4.264Z"
				fill="currentColor"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
			<polygon
				points="15 17 13.5 17 13 12.5 15.5 12.5 15 17"
				fill="currentColor"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
		</svg>
	);
}

export default IconPeople;
