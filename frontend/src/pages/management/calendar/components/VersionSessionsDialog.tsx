import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { sessionApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import type { CalendarVersionResponse, SessionDTO } from "@/types";
import {
  CalendarDays,
  Clock,
  Sparkles,
  ExternalLink,
  Search,
  BookOpen,
} from "lucide-react";

interface VersionSessionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarName?: string;
  version: CalendarVersionResponse | null;
}

export function VersionSessionsDialog({
  open,
  onOpenChange,
  calendarName,
  version,
}: VersionSessionsDialogProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: pageData, isLoading, isError, refetch } = useQuery({
    queryKey: ["version-sessions", version?.id],
    enabled: open && !!version?.id,
    queryFn: async () => {
      if (!version?.id) return null;
      return sessionApi.getPage(
        { page: 0, size: 200, sort: ["startTime,asc"] },
        undefined,
        { calendarVersionId: version.id }
      );
    },
  });

  if (!version) return null;

  const sessions: SessionDTO[] = pageData?.content || [];

  const filteredSessions = sessions.filter((s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.title?.toLowerCase().includes(q) ||
      s.topicName?.toLowerCase().includes(q) ||
      s.trainerName?.toLowerCase().includes(q) ||
      s.room?.toLowerCase().includes(q) ||
      s.classCode?.toLowerCase().includes(q)
    );
  });

  const startDate = sessions.length > 0 ? sessions[0].startTime?.split("T")[0] : null;
  const endDate =
    sessions.length > 0
      ? sessions[sessions.length - 1].startTime?.split("T")[0]
      : null;

  const formatDateTime = (dtStr?: string) => {
    if (!dtStr) return "—";
    const d = new Date(dtStr);
    if (Number.isNaN(d.getTime())) return dtStr;
    const dateFormatted = d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timeFormatted = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return { dateFormatted, timeFormatted };
  };

  const handleGoToBulkGenerate = () => {
    onOpenChange(false);
    navigate(
      `/sessions/bulk-generate?calendarId=${version.calendarId}&versionId=${version.id}`
    );
  };

  const handleGoToFullSchedules = () => {
    onOpenChange(false);
    navigate(`/sessions`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Sessions in Version v{version.versionNumber}
                </DialogTitle>
                <DialogDescription className="text-sm mt-0.5">
                  {calendarName || "Calendar"} &bull; {version.name || "No title"}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={
                  version.status === "ACTIVE"
                    ? "default"
                    : version.status === "DRAFT"
                    ? "secondary"
                    : "outline"
                }
                className="px-2.5 py-0.5"
              >
                {version.status}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Version ID: {version.id}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Summary Metric Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2 p-3 bg-muted/40 rounded-xl border text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Total Sessions</div>
            <div className="text-base font-semibold mt-0.5">
              {sessions.length} sessions
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Start Date</div>
            <div className="text-base font-semibold mt-0.5">
              {startDate || "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">End Date</div>
            <div className="text-base font-semibold mt-0.5">
              {endDate || "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Class Code</div>
            <div className="text-base font-semibold mt-0.5">
              {sessions[0]?.classCode || "HCM26-FSJ-01"}
            </div>
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="flex items-center justify-between gap-3 my-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by topic, trainer, room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {version.status === "DRAFT" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGoToBulkGenerate}
              className="gap-1.5"
            >
              <Sparkles className="size-3.5 text-primary" />
              {sessions.length === 0 ? "Bulk Generate Sessions" : "Generate More Sessions"}
            </Button>
          )}
        </div>

        {/* Sessions Content */}
        <div className="flex-1 overflow-y-auto border rounded-xl min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
              <Clock className="size-6 animate-spin text-primary" />
              <p className="text-sm">Loading sessions for this version...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-destructive">
              <p className="text-sm font-medium">Failed to load sessions for this version.</p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center p-6">
              <div className="p-3 bg-muted rounded-full text-muted-foreground">
                <BookOpen className="size-8" />
              </div>
              <div>
                <h4 className="font-semibold text-base">
                  {sessions.length === 0
                    ? "No sessions in this version yet"
                    : "No matching sessions found"}
                </h4>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {sessions.length === 0
                    ? version.status === "DRAFT"
                      ? "You can generate sessions in bulk using the automated generator engine."
                      : "This version has no sessions recorded."
                    : "Try adjusting your search criteria."}
                </p>
              </div>
              {sessions.length === 0 && version.status === "DRAFT" && (
                <Button onClick={handleGoToBulkGenerate} className="gap-2 mt-2">
                  <Sparkles className="size-4" />
                  Generate Sessions Now
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="w-40">Date</TableHead>
                  <TableHead className="w-32">Time</TableHead>
                  <TableHead>Topic & Title</TableHead>
                  <TableHead className="w-36">Trainer</TableHead>
                  <TableHead className="w-28">Room</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session, index) => {
                  const startParsed = formatDateTime(session.startTime);
                  const endParsed = formatDateTime(session.endTime);

                  return (
                    <TableRow key={session.id || index}>
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {typeof startParsed === "object"
                          ? startParsed.dateFormatted
                          : startParsed}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {typeof startParsed === "object" && typeof endParsed === "object"
                          ? `${startParsed.timeFormatted} - ${endParsed.timeFormatted}`
                          : session.startTime}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs sm:text-sm">
                          {session.title || "Session"}
                        </div>
                        {session.topicName && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {session.topicName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {session.trainerName || `Trainer #${session.trainerId}`}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {session.room || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            session.status === "SCHEDULED"
                              ? "outline"
                              : session.status === "COMPLETED"
                              ? "default"
                              : "destructive"
                          }
                          className="text-[10px] px-2 py-0.5 uppercase tracking-wider"
                        >
                          {session.status || "SCHEDULED"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Showing {filteredSessions.length} of {sessions.length} sessions
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGoToFullSchedules}
              className="gap-1.5"
            >
              <ExternalLink className="size-3.5" />
              Open in Schedule Management
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
