import { Link } from "react-router-dom";
import { useExternalClass } from "@/hooks/useExternalLookups";
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

/** The human readable name of a class id. Falls back to "Class #id" while loading or when the master system is down. */
export function ClassLabel({ classId, asLink = false, showName = false, className }: ClassLabelProps) {
    const query = useExternalClass(classId != null ? String(classId) : undefined);

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
