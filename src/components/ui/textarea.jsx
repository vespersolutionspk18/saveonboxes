import { cn } from "../../lib/utils.js";

export function Textarea({ className, ...props }) {
  return <textarea data-slot="textarea" className={cn("flex min-h-20 w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm tracking-tight shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />;
}
