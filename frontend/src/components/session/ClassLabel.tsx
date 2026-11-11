import { Link } from "react-router-dom";
import { useClasses } from "@/hooks/useClasses";
import { cn } from "@/lib/utils";
import { classTitle } from "@/utils/class.utils";

interface ClassLabelProps {
    classId?: number | null;
    /** Renders the label as a link to the class details page. */
    asLink?: boolean;
    /** Also show the class name after its code. */
    showName?: boolean;
    className?: string;
}

/** Resolve internal session class IDs through TrainingClass; never use shared-directory identities. */
export function ClassLabel({ classId, asLink = false, showName = false, className }: ClassLabelProps) {
    const query = useClasses({ classId: classId ?? "", enabled: classId != null });

    if (classId == null) {
        return <span className="text-muted-foreground">—</span>;
    }

    const title = query.data ? classTitle(query.data) : `Class #${classId}`;
    const name = showName && query.data?.code && query.data.name ? ` · ${query.data.name}` : "";

    if (!asLink) {
        return <span className={className}>{`${title}${name}`}</span>;
    }

    return (
        <Link to={`/classes/${classId}`} className={cn("font-medium text-blue-800 hover:underline dark:text-blue-300", className)}>
            {`${title}${name}`}
        </Link>
    );
}
