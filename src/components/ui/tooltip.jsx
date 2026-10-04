"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "../../lib/utils.js";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export function TooltipContent({ className, sideOffset = 4, ...props }) {
  return <TooltipPrimitive.Portal><TooltipPrimitive.Content data-slot="tooltip-content" sideOffset={sideOffset} className={cn("z-50 overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md", className)} {...props} /></TooltipPrimitive.Portal>;
}
