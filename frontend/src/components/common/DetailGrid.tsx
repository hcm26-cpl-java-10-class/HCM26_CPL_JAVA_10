import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Explicit placeholder for a field the backend does not provide: never an invented value, never a silent blank. */
export function NotAvailable() {
    return <span className="font-normal italic text-muted-foreground">Not available</span>;
}

/** A column of label / value rows, like the information grid of the training management screens. */
export function DetailGroup({ children, className }: { children: ReactNode; className?: string }) {
    return <dl className={cn("divide-y", className)}>{children}</dl>;
}

export function DetailItem({
    label,
    children,
    unavailable = false,
}: {
    label: string;
    children?: ReactNode;
    /** Renders the "Not available" placeholder instead of the children. */
    unavailable?: boolean;
}) {
    return (
        <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="break-words text-sm font-medium">{unavailable ? <NotAvailable /> : children}</dd>
        </div>
    );
}
