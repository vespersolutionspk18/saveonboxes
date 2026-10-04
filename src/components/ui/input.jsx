import { cn } from "../../lib/utils.js";

export function Input({ className, type = "text", ...props }) {
  return <input data-slot="input" type={type} className={cn("flex h-9 w-full min-w-0 rounded-md border-0 bg-transparent px-3 py-1 text-sm tracking-tight shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />;
}
