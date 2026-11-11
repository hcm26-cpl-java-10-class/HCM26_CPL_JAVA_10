import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CLASS_TONE_CLASSES, getClassStatusMeta } from "@/utils/class.utils";

/** Class statuses are defined by the master system; unknown ones are shown humanized in a neutral badge. */
export function ClassStatusBadge({ status, className }: { status?: string | null; className?: string }) {
    const meta = getClassStatusMeta(status);

    return (
        <Badge
            variant="secondary"
            className={cn("rounded-full px-3 py-0.5 text-xs font-medium", CLASS_TONE_CLASSES[meta.tone], className)}
            title={status ? `Status: ${status}` : undefined}
        >
            {meta.label}
        </Badge>
    );
}
