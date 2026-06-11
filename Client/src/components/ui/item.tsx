import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Shared shell of alert list rows (home feed, analytics history): card chrome
// with a data-driven accent edge (set borderInlineStartColor inline).
const itemVariants = cva("w-full rounded-lg border border-s-4 bg-card p-3", {
  variants: {
    interactive: {
      true: "text-start transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
      false: "",
    },
    selected: {
      true: "ring-2 ring-primary",
      false: "",
    },
  },
  defaultVariants: {
    interactive: false,
    selected: false,
  },
})

function Item({
  className,
  interactive = false,
  selected = false,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof itemVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div"

  return (
    <Comp
      data-slot="item"
      className={cn(itemVariants({ interactive, selected }), className)}
      {...props}
    />
  )
}

export { Item, itemVariants }
