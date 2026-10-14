import type { StudySession } from "@/types/features/schedule";
import { darken, getSessionColor, withAlpha } from "@/utils/schedule.utils";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

interface SessionChipProps {
  session: StudySession;
  showTime?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Compact calendar chip used in the month view (Google Calendar style). */
export function SessionChip({ session, showTime = true, onClick, className }: SessionChipProps) {
  const color = getSessionColor(session);
  const textColor = darken(color, 70);

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${session.title} (${session.course})`}
      className={cn(
        "block w-full truncate rounded-[4px] px-1.5 py-px text-left text-[11px] font-medium leading-4",
        "transition-opacity hover:opacity-80 focus-visible:opacity-80 focus-visible:outline-none",
        session.status === "CANCELLED" && "line-through opacity-60",
        className,
      )}
      style={{ backgroundColor: withAlpha(color, 0.18), color: textColor }}
    >
      {showTime && (
        <span className="mr-1 font-normal opacity-70">{dayjs(session.start).format("HH:mm")}</span>
      )}
      <span className="truncate">{session.title}</span>
    </button>
  );
}
