import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@still/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Aker design system favors pill-shaped buttons (80px / 160px radius), ghost
 * outlines on dark backgrounds, and a single accent color (Desert Orange).
 * Default size keeps the previously-shipped 32px chip; "pill"/"pill-lg" sizes
 * implement the 160px pill geometry called out in DESIGN.md.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap select-none outline-none transition-[background-color,border-color,color,transform,opacity] duration-[var(--aker-duration)] ease-[var(--aker-ease)] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Soft Stone filled, per Aker "primary action" guidance.
        default:
          "bg-primary text-primary-foreground hover:bg-primary/85 aria-expanded:bg-primary",
        // Desert Orange — used sparingly for the headline CTA per Aker accent rules.
        accent:
          "bg-accent text-accent-foreground hover:bg-accent/90 aria-expanded:bg-accent",
        outline:
          "border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        // Aker "Ghost Button (Light Text)" — transparent w/ white border + text.
        "ghost-light":
          "border-pure-white/70 text-pure-white bg-transparent hover:bg-pure-white/10 hover:border-pure-white aria-expanded:bg-pure-white/10",
        // Aker "Ghost Button (Dark Text)" — transparent w/ black border + text.
        "ghost-dark":
          "border-absolute-black/80 text-absolute-black bg-transparent hover:bg-absolute-black/10 hover:border-absolute-black aria-expanded:bg-absolute-black/10",
        // Aker "Translucent Dark Button" — semi-white over imagery.
        translucent:
          "bg-pure-white/20 text-absolute-black backdrop-blur-md hover:bg-pure-white/30",
        destructive:
          "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25 focus-visible:ring-destructive/30",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-2 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-7 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-10 gap-2 px-4 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl: "h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        // Pill geometries (80px / 160px) — the Aker hallmark.
        pill: "h-10 gap-2 rounded-[var(--radius-pill)] px-5 text-sm",
        "pill-lg":
          "h-12 gap-2 rounded-[var(--radius-pill-lg)] px-6 py-[19px] text-sm",
        icon: "size-9",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-sm",
        "icon-lg": "size-10",
        "icon-pill": "size-10 rounded-[var(--radius-pill)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
