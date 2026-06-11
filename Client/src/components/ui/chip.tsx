import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const chipVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      selected: {
        true: "border-primary bg-primary/10 text-foreground",
        false:
          "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
      },
      size: {
        default: "px-2.5 py-1 text-xs",
        xs: "px-2 py-0.5 text-2xs",
      },
    },
    defaultVariants: {
      selected: false,
      size: "default",
    },
  }
)

/** Toggleable filter pill, optionally led by a colored swatch dot. */
function Chip({
  className,
  selected = false,
  size = "default",
  swatch,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof chipVariants> & { swatch?: string }) {
  return (
    <button
      type="button"
      data-slot="chip"
      aria-pressed={selected ?? undefined}
      className={cn(chipVariants({ selected, size }), className)}
      {...props}
    >
      {swatch && (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: swatch }}
        />
      )}
      {children}
    </button>
  )
}

export { Chip, chipVariants }
