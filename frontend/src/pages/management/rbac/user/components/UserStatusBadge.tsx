import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  USER_STATUS_BADGE_CLASS,
  USER_STATUS_DOT_CLASS,
  USER_STATUS_OPTIONS,
  type UserStatus,
} from "@/types";

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const label = USER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border-transparent px-3 py-1 text-sm font-medium", USER_STATUS_BADGE_CLASS[status])}
    >
      <span className={cn("h-2 w-2 rounded-full", USER_STATUS_DOT_CLASS[status])} />
      {label}
    </Badge>
  );
}
