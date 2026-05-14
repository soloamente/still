import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@still/ui/lib/utils";
import * as React from "react";

/**
 * Generic text input. Sized so iOS Safari doesn't auto-zoom (16px font),
 * with 8px radius matching the Aker default. Use `<InputAffix>` to put
 * icons or labels inside the input padding without breaking focus.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md border border-input bg-muted/40 px-3.5 py-2 text-base text-foreground outline-none transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-ring focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/25",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // 16px on mobile, smaller on desktop where focus is precise.
        "md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Inline affix wrapper. Per Aker guidance, icon prefixes/suffixes sit
 * absolutely on top of the input padding so the entire field is
 * clickable for focus.
 */
function InputAffix({
  children,
  className,
  position = "start",
}: {
  children: React.ReactNode;
  className?: string;
  position?: "start" | "end";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
        position === "start" ? "left-3.5" : "right-3.5",
        className,
      )}
    >
      {children}
    </span>
  );
}

export { Input, InputAffix };
