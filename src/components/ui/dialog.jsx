"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.jsx";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, showCloseButton = true, ...props }) {
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
    <DialogPrimitive.Content data-slot="dialog-content" className={cn("fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-background p-5 shadow-xl outline-none", className)} {...props}>
      {children}
      {showCloseButton && <DialogPrimitive.Close asChild><Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Close"><X /></Button></DialogPrimitive.Close>}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>;
}
export function DialogHeader({ className, ...props }) { return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />; }
export function DialogFooter({ className, ...props }) { return <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />; }
export function DialogTitle({ className, ...props }) { return <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-base font-semibold tracking-tight", className)} {...props} />; }
export function DialogDescription({ className, ...props }) { return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />; }
