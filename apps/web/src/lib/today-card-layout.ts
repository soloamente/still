import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";

/** Today supporting-card tile — flat `bg-background` on the lobby `bg-card` (no border/shadow). */
export const TODAY_SUPPORTING_CARD_CLASSNAME =
	"flex min-h-[11rem] min-w-0 flex-col gap-3 rounded-3xl bg-background p-5";

/** Card heading — quiet eyebrow above the headline. */
export const TODAY_CARD_HEADING_CLASSNAME =
	"font-medium text-muted-foreground text-sm";

/** Bottom-pinned card action pill. */
export const TODAY_CARD_ACTION_CLASSNAME = cn(
	buttonVariants({ variant: "secondary", size: "pill" }),
	"mt-auto self-start",
);
