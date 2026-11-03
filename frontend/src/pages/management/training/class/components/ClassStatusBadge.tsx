import { Badge } from "@/components/ui/badge";
import { CLASS_TONE_CLASSES, getClassStatusMeta } from "@/utils/class.utils";

/** Class statuses are defined by the master system; unknown ones are shown humanized in a neutral badge. */
export function ClassStatusBadge({ status }: { status?: string | null }) {
    const meta = getClassStatusMeta(status);

    return (
        <Badge variant="secondary" className={CLASS_TONE_CLASSES[meta.tone]} title={status ? `Status: ${status}` : undefined}>
            {meta.label}
        </Badge>
    );
}
