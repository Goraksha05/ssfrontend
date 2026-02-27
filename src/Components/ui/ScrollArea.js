import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

// Utility to join classNames safely
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar
      orientation="vertical"
      className="flex select-none touch-none p-0.5 bg-transparent transition-colors duration-[160ms] ease-out hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <ScrollAreaPrimitive.Thumb className="flex-1 bg-gray-400 rounded-full" />
    </ScrollAreaPrimitive.Scrollbar>
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
