import { openCreateListDrawer } from "@/components/list/create-list-drawer";
import type { CreateListSheetProps } from "@/components/list/create-list-form";
import {
	APP_MOBILE_VAUL_MQ,
	shouldUseAppMobileVaul,
} from "@/lib/app-mobile-vaul";

/** @deprecated Use {@link APP_MOBILE_VAUL_MQ} */
export const CREATE_LIST_MOBILE_MQ = APP_MOBILE_VAUL_MQ;

type RequestCreateListArgs = Pick<
	CreateListSheetProps,
	"media" | "movieId" | "movieTitle" | "onCreated"
>;

/** @deprecated Use {@link shouldUseAppMobileVaul} */
export const shouldOpenCreateListDrawer = shouldUseAppMobileVaul;

/** Route to the global Vaul drawer on mobile, or invoke the desktop dialog opener. */
export function requestCreateList(
	args: RequestCreateListArgs,
	openDesktopDialog: () => void,
) {
	if (shouldUseAppMobileVaul()) {
		openCreateListDrawer(args);
		return;
	}
	openDesktopDialog();
}
