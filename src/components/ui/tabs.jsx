"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "../../lib/utils.js";

export function Tabs({ className, ...props }) { return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-2", className)} {...props} />; }
export function TabsList({ className, ...props }) { return <TabsPrimitive.List data-slot="tabs-list" className={cn("inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)} {...props} />; }
export function TabsTrigger({ className, ...props }) { return <TabsPrimitive.Trigger data-slot="tabs-trigger" className={cn("inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium tracking-tight outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm", className)} {...props} />; }
export function TabsContent({ className, ...props }) { return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} {...props} />; }
