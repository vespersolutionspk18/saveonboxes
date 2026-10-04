import { cn } from "../../lib/utils.js";

export function Skeleton({ className, ...props }) { return <div data-slot="skeleton" aria-hidden="true" className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />; }
