import type React from "react";

/** Filled inbox / thread list — account menu **My feedback** (Nucleo-style 18×18). */
function IconFeedbackInbox({
	size,
	...props
}: React.SVGProps<SVGSVGElement> & { size?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 18 18"
			{...(size ? { width: size, height: size } : {})}
			{...props}
			aria-hidden={props["aria-hidden"] ?? true}
		>
			<title>My feedback</title>
			<path
				d="M13.25,2H4.75c-1.517,0-2.75,1.233-2.75,2.75V13.25c0,1.517,1.233,2.75,2.75,2.75H13.25c1.517,0,2.75-1.233,2.75-2.75V4.75c0-1.517-1.233-2.75-2.75-2.75ZM4.75,3.5H13.25c.689,0,1.25,.561,1.25,1.25v4.75h-2.75c-.414,0-.75,.336-.75,.75v1.5c0,.138-.112,.25-.25,.25h-3.5c-.138,0-.25-.112-.25-.25v-1.5c0-.414-.336-.75-.75-.75H3.5V4.75c0-.689,.561-1.25,1.25-1.25Z"
				fill="currentColor"
			/>
			<path
				d="M12.25,8.5H5.75c-.414,0-.75-.336-.75-.75s.336-.75,.75-.75h6.5c.414,0,.75,.336,.75,.75s-.336,.75-.75,.75Z"
				fill="currentColor"
			/>
			<path
				d="M12.25,6H5.75c-.414,0-.75-.336-.75-.75s.336-.75,.75-.75h6.5c.414,0,.75,.336,.75,.75s-.336,.75-.75,.75Z"
				fill="currentColor"
			/>
		</svg>
	);
}

export default IconFeedbackInbox;
