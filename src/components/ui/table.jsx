import { cn } from "../../lib/utils.js";

export function Table({ className, ...props }) { return <div data-slot="table-container" className="relative w-full overflow-auto"><table data-slot="table" className={cn("w-full caption-bottom text-sm tracking-tight", className)} {...props} /></div>; }
export function TableHeader({ className, ...props }) { return <thead data-slot="table-header" className={cn("[&_tr]:text-muted-foreground", className)} {...props} />; }
export function TableBody({ className, ...props }) { return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />; }
export function TableFooter({ className, ...props }) { return <tfoot data-slot="table-footer" className={cn("bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />; }
export function TableRow({ className, ...props }) { return <tr data-slot="table-row" className={cn("transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)} {...props} />; }
export function TableHead({ className, ...props }) { return <th data-slot="table-head" className={cn("h-9 px-3 text-left align-middle text-[11px] font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", className)} {...props} />; }
export function TableCell({ className, ...props }) { return <td data-slot="table-cell" className={cn("px-3 py-2 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />; }
export function TableCaption({ className, ...props }) { return <caption data-slot="table-caption" className={cn("mt-3 text-sm text-muted-foreground", className)} {...props} />; }
