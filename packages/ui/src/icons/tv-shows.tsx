import type React from "react";

/** TV with antenna — browse / search “TV shows” affordance (Nucleo-style 18×18). */
function IconTvShows({
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
			<title>TV shows</title>
			<path
				d="m9,4.5c-.1919,0-.3838-.0732-.5303-.2197l-2.25-2.25c-.293-.293-.293-.7676,0-1.0605s.7676-.293,1.0605,0l1.7197,1.7197L11.4697.2197c.293-.293.7676-.293,1.0605,0s.293.7676,0,1.0605l-3,3c-.1465.1465-.3384.2197-.5303.2197Z"
				fill="currentColor"
				strokeWidth="0"
			/>
			<path
				d="m14.25,3H3.75c-1.5166,0-2.75,1.2334-2.75,2.75v6.5c0,1.5166,1.2334,2.75,2.75,2.75h10.5c1.5166,0,2.75-1.2334,2.75-2.75v-6.5c0-1.5166-1.2334-2.75-2.75-2.75Zm-3.25,8.5c0,.2761-.2238.5-.5.5h-6c-.2761,0-.5-.2239-.5-.5v-5c0-.2761.2239-.5.5-.5h6c.2762,0,.5.2239.5.5v5Zm2-.5c-.5522,0-1-.4478-1-1s.4478-1,1-1,1,.4478,1,1-.4477,1-1,1Zm0-3c-.5522,0-1-.4478-1-1s.4478-1,1-1,1,.4478,1,1-.4477,1-1,1Z"
				fill="currentColor"
				strokeWidth="0"
			/>
		</svg>
	);
}

export default IconTvShows;
