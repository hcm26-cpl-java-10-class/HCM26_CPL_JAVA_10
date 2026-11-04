import { Badge } from "@/components/ui/badge";
import { getSessionStatusMeta } from "@/utils/session.utils";

export function SessionStatusBadge({ status, title }: { status?: string | null; title?: string }) {
    const meta = getSessionStatusMeta(status);

    return (
        <Badge variant="secondary" className={meta.badgeClass} title={title}>
            {meta.label}
        </Badge>
    );
}
