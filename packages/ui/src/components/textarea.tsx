import { cn } from "@still/ui/lib/utils";
import * as React from "react";

/**
 * Standard textarea with the same look as <Input>. Auto-grow is not
 * built in — wrap with a small auto-resize hook on the consumer side
 * when needed.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-md border border-input bg-muted/40 px-3.5 py-3 text-base text-foreground outline-none transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-ring focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/25",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        "resize-y md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
