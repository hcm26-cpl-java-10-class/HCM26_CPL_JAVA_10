import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { usePendingInvitations } from "@/hooks/usePendingInvitations";
import type { InvitationDTO } from "@/types";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const MAX_DROPDOWN_ITEMS = 5;

const TOASTED_IDS_STORAGE_KEY = "student_invitation_toasted_ids";

function readToastedIds(): number[] {
    try {
        const raw = window.localStorage.getItem(TOASTED_IDS_STORAGE_KEY);
        if (!raw) return [];

        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter((id): id is number => typeof id === "number");
    } catch {
        return [];
    }
}

function writeToastedIds(ids: number[]) {
    try {
        window.localStorage.setItem(TOASTED_IDS_STORAGE_KEY, JSON.stringify(ids));
    } catch {
    }
}

function formatExpiry(value?: string | null): string | null {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return date.toLocaleString();
}

export function InvitationBell() {
    const navigate = useNavigate();
    const { pending, count } = usePendingInvitations();

    const previousCountRef = useRef<number | null>(null);

    useEffect(() => {
        const previous = previousCountRef.current;

        if (previous !== null && count > previous && pending.length > 0) {
            const toastedIds = readToastedIds();
            const newInvitations = pending.filter(
                (invitation) => invitation.id != null && !toastedIds.includes(invitation.id),
            );

            if (newInvitations.length > 0) {
                toast.info(
                    newInvitations.length === 1
                        ? "Bạn có lời mời thi mới"
                        : `Bạn có ${newInvitations.length} lời mời thi mới`,
                );

                const newIds = newInvitations
                    .map((invitation) => invitation.id)
                    .filter((id): id is number => id != null);

                writeToastedIds([...toastedIds, ...newIds]);
            }
        }

        previousCountRef.current = count;
    }, [count, pending]);

    const visibleInvitations = pending.slice(0, MAX_DROPDOWN_ITEMS);
    const label = count > 0 ? `Notification (${count})` : "Notification";

    const goToInvitations = () => navigate("/invitations");

    return (
        <DropdownMenu>
            <TooltipWrapper content={label}>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="relative text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        aria-label={label}
                    >
                        <Bell className="size-4" />
                        {count > 0 && (
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center",
                                    "rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white",
                                )}
                            >
                                {count > 9 ? "9+" : count}
                            </span>
                        )}
                    </Button>
                </DropdownMenuTrigger>
            </TooltipWrapper>

            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Notification
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {visibleInvitations.length === 0 ? (
                    <DropdownMenuItem disabled>Chưa có thông báo nào</DropdownMenuItem>
                ) : (
                    visibleInvitations.map((invitation: InvitationDTO, index) => {
                        const expiry = formatExpiry(invitation.expiresAt);

                        return (
                            <DropdownMenuItem
                                key={invitation.id ?? `invitation-${index}`}
                                onClick={goToInvitations}
                                className="flex flex-col items-start gap-0.5"
                            >
                                <span className="w-full truncate font-medium">
                                    {invitation.examTitle ?? `Đề thi #${invitation.examId}`}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {expiry ? `Hạn phản hồi: ${expiry}` : "Không giới hạn hạn phản hồi"}
                                </span>
                            </DropdownMenuItem>
                        );
                    })
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={goToInvitations} className="justify-center font-medium">
                    Xem tất cả
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default InvitationBell;
