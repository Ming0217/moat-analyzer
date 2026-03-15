import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, forwardedRef) => {
  const innerRef = React.useRef<HTMLDivElement>(null)

  // Merge the forwarded ref with our local ref
  const ref = React.useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node
      if (typeof forwardedRef === "function") forwardedRef(node)
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [forwardedRef],
  )

  // Radix/floating-ui positions via translate(X.Xpx, Y.Ypx) with fractional
  // values, causing sub-pixel text blur. Snap to whole pixels after each update.
  React.useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const dpr = window.devicePixelRatio || 1
    const snapValue = (v: string) =>
      `${Math.round(parseFloat(v) * dpr) / dpr}px`
    const snap = () => {
      const t = el.style.transform
      if (!t) return
      // Handle both translate(x, y) and translate3d(x, y, z)
      el.style.transform = t
        .replace(
          /translate\(([^,]+),\s*([^)]+)\)/,
          (_, x, y) => `translate(${snapValue(x)}, ${snapValue(y)})`,
        )
        .replace(
          /translate3d\(([^,]+),\s*([^,]+),\s*([^)]+)\)/,
          (_, x, y, z) => `translate3d(${snapValue(x)}, ${snapValue(y)}, ${z})`,
        )
    }
    const mo = new MutationObserver(snap)
    mo.observe(el, { attributes: true, attributeFilter: ["style"] })
    snap()
    return () => mo.disconnect()
  }, [])

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
