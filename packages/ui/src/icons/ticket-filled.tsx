import type React from "react";

/**
 * Solid ticket silhouette — pair with `ticket` outline for “inactive vs active”
 * (e.g. home chrome when the patron is already on `/diary`).
 */
function IconTicketFilled({
	size = "20px",
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
	return (
		<svg
			aria-label="Ticket"
			xmlns="http://www.w3.org/2000/svg"
			x="0px"
			y="0px"
			width={size}
			height={size}
			viewBox="0 0 20 20"
			{...props}
		>
			{/* Same silhouette as `ticket.tsx`, filled — perforations punched with canvas color. */}
			<path
				d="m10,16h4c1.6569,0,3-1.3431,3-3v-1c-1.1046,0-2-.8954-2-2,0-1.1046.8954-2,2-2v-1c0-1.6569-1.3431-3-3-3h-4s-4,0-4,0c-1.6569,0-3,1.3431-3,3v1c1.1046,0,2,.8954,2,2s-.8954,2-2,2v1c0,1.6569,1.3431,3,3,3,0,0,4,0,4,0Z"
				fill="currentColor"
			/>
			<circle cx="9" cy="7" r="1" fill="var(--background)" strokeWidth="0" />
			<circle cx="9" cy="10" r="1" fill="var(--background)" strokeWidth="0" />
			<circle cx="9" cy="13" r="1" fill="var(--background)" strokeWidth="0" />
		</svg>
	);
}

export default IconTicketFilled;
