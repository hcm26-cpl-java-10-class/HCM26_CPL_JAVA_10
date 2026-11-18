import { CalendarClock, CheckCircle2, Copy, Eye, MoreHorizontal, Pencil, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/usePermissions";
import type { SessionDTO } from "@/types";
import { isOpenSession } from "@/utils/session.utils";
import type { SessionActionController } from "./session-actions";

interface SessionActionsMenuProps {
    session: SessionDTO;
    controller: SessionActionController;
}

/**
 * The per-row action menu shared by every place that lists sessions.
 * Entries follow the backend rules: edit / reschedule / complete / cancel need SESSION_UPDATE and a SCHEDULED
 * session, duplicate needs SESSION_CREATE (any status), viewing needs SESSION_READ.
 */
export function SessionActionsMenu({ session, controller }: SessionActionsMenuProps) {
    const { hasPermission } = usePermissions();

    const canRead = hasPermission("SESSION_READ");
    const canCreate = hasPermission("SESSION_CREATE");
    const canModify = hasPermission("SESSION_UPDATE") && isOpenSession(session);

    if (!canRead && !canCreate && !canModify) {
        return null;
    }

    const label = session.title || `session ${session.id}`;

    return (
        // modal={false}: the dialogs opened from these items must not fight the menu over focus and pointer events
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}>
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                {canRead && (
                    <DropdownMenuItem asChild>
                        <Link to={`/sessions/${session.id}`}>
                            <Eye /> View details
                        </Link>
                    </DropdownMenuItem>
                )}
                {canModify && (
                    <>
                        <DropdownMenuItem onSelect={() => controller.open({ type: "edit", session })}>
                            <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => controller.open({ type: "reschedule", session })}>
                            <CalendarClock /> Reschedule
                        </DropdownMenuItem>
                    </>
                )}
                {canCreate && (
                    <DropdownMenuItem onSelect={() => controller.open({ type: "duplicate", session })}>
                        <Copy /> Duplicate
                    </DropdownMenuItem>
                )}
                {canModify && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => controller.open({ type: "complete", session })}>
                            <CheckCircle2 /> Mark as completed
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => controller.open({ type: "cancel", session })}>
                            <XCircle /> Cancel session
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
