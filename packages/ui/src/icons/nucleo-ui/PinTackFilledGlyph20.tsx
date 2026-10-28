import type { SVGProps } from "react";

export type PinTackFilledGlyph20Props = SVGProps<SVGSVGElement>;

export function PinTackFilledGlyph20(props: PinTackFilledGlyph20Props) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={20}
			height={20}
			viewBox="0 0 20 20"
			{...props}
		>
			<line
				x1="10"
				y1="17"
				x2="10"
				y2="13"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
			<path
				d="m10,13h6c-.0526-.5187-.2012-1.346-.6667-2.25-.4304-.8359-.962-1.4079-1.3333-1.75v-3c0-1.6569-1.3431-3-3-3h-1s-1,0-1,0c-1.6569,0-3,1.3431-3,3v3c-.3713.3421-.903.9141-1.3333,1.75-.4655.904-.6141,1.7313-.6667,2.25h6Z"
				fill="currentColor"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			/>
		</svg>
	);
}
