import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A native <select> that looks like the other form controls (it is keyboard and screen-reader friendly out of the box). */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
    return (
        <select
            className={cn(
                "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow]",
                "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                "dark:bg-input/30 dark:[&>option]:bg-background",
                className,
            )}
            {...props}
        />
    );
}
