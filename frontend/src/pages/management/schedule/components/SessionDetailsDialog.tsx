import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { StudySession } from "@/types/features/schedule";
import { formatLongDate, formatSessionTime, getSessionColor, withAlpha } from "@/utils/schedule.utils";
import dayjs from "dayjs";
import { BookOpen, Clock, GraduationCap, MapPin, UserRound } from "lucide-react";

interface SessionDetailsDialogProps {
  session: StudySession | null;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABELS: Record<StudySession["status"], string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function SessionDetailsDialog({ session, onOpenChange }: SessionDetailsDialogProps) {
  if (!session) return null;

  const color = getSessionColor(session);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <div
          className="flex items-start justify-between gap-4 px-6 py-5"
          style={{ backgroundColor: withAlpha(color, 0.14) }}
        >
          <div className="min-w-0">
            <DialogHeader>
              <DialogTitle className="truncate text-lg font-semibold">{session.title}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {formatSessionTime(session)} · {session.course}
              </DialogDescription>
            </DialogHeader>
          </div>
          <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        </div>

        <div className="grid gap-4 px-6 py-5 text-sm">
          <div className="flex items-center gap-3">
            <Clock className="size-4 shrink-0 text-muted-foreground" />
            <span>{formatLongDate(dayjs(session.start))}</span>
          </div>

          <div className="flex items-center gap-3">
            <BookOpen className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">{session.course}</span>
          </div>

          <div className="flex items-center gap-3">
            <UserRound className="size-4 shrink-0 text-muted-foreground" />
            <span>{session.teacher}</span>
          </div>

          <div className="flex items-center gap-3">
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            <span>{session.location}</span>
          </div>

          <div className="flex items-center gap-3">
            <GraduationCap className="size-4 shrink-0 text-muted-foreground" />
            <span>{session.role === "STUDENT" ? "Student schedule" : "Teacher schedule"}</span>
          </div>

          {session.description && (
            <p className="rounded-lg bg-muted p-3 text-muted-foreground">{session.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                session.status === "CANCELLED" && "text-destructive",
                session.status === "COMPLETED" && "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {STATUS_LABELS[session.status]}
            </Badge>
            <Badge variant="outline">{session.category.toLowerCase()}</Badge>
            <Badge variant="outline">{session.role}</Badge>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
