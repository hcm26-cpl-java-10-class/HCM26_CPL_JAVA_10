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
  CalendarCheck,
  CalendarRange,
  GraduationCap,
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

  const formatDateDisplay = (dtStr?: string) => {
    if (!dtStr) return "—";
    const d = new Date(dtStr);
    if (Number.isNaN(d.getTime())) return dtStr;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTimeDisplay = (dtStr?: string) => {
    if (!dtStr) return "—";
    const d = new Date(dtStr);
    if (Number.isNaN(d.getTime())) {
      return dtStr.includes("T") ? dtStr.split("T")[1]?.substring(0, 5) : dtStr;
    }
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const startDate = sessions.length > 0 ? formatDateDisplay(sessions[0].startTime) : null;
  const endDate =
    sessions.length > 0
      ? formatDateDisplay(sessions[sessions.length - 1].startTime)
      : null;

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
      <DialogContent className="sm:max-w-5xl md:max-w-5xl lg:max-w-5xl w-full max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <CalendarDays className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Sessions in Version v{version.versionNumber}
                </DialogTitle>
                <DialogDescription className="text-sm mt-0.5 text-muted-foreground">
                  {calendarName || "Calendar"} &bull; {version.name || "Draft Version"}
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
                className="px-3 py-1 font-semibold text-xs tracking-wide"
              >
                {version.status}
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                Version ID: {version.id}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Summary Metric Header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-2 text-sm">
          <div className="p-3.5 bg-card rounded-xl border shadow-2xs flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg dark:bg-blue-950 dark:text-blue-400">
              <CalendarCheck className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground truncate">Total Sessions</div>
              <div className="text-base font-bold text-foreground">
                {sessions.length} sessions
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-card rounded-xl border shadow-2xs flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg dark:bg-emerald-950 dark:text-emerald-400">
              <CalendarRange className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground truncate">Start Date</div>
              <div className="text-sm font-semibold text-foreground truncate" title={startDate || "—"}>
                {startDate || "—"}
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-card rounded-xl border shadow-2xs flex items-center gap-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg dark:bg-purple-950 dark:text-purple-400">
              <Clock className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground truncate">End Date</div>
              <div className="text-sm font-semibold text-foreground truncate" title={endDate || "—"}>
                {endDate || "—"}
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-card rounded-xl border shadow-2xs flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg dark:bg-amber-950 dark:text-amber-400">
              <GraduationCap className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground truncate">Class Code</div>
              <div className="text-sm font-semibold font-mono text-foreground truncate">
                {sessions[0]?.classCode || "HCM26-FSJ-01"}
              </div>
            </div>
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 my-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by topic, trainer, room, title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {version.status === "DRAFT" && (
            <Button
              size="sm"
              onClick={handleGoToBulkGenerate}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              <Sparkles className="size-3.5" />
              {sessions.length === 0 ? "Bulk Generate Sessions" : "Generate More Sessions"}
            </Button>
          )}
        </div>

        {/* Sessions Table Container */}
        <div className="flex-1 overflow-y-auto overflow-x-auto border rounded-xl min-h-[300px] bg-card">
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
              <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur z-10">
                <TableRow>
                  <TableHead className="w-14 text-center font-semibold">#</TableHead>
                  <TableHead className="w-36 font-semibold">Date</TableHead>
                  <TableHead className="w-32 font-semibold">Time Slot</TableHead>
                  <TableHead className="min-w-[220px] font-semibold">Topic & Session</TableHead>
                  <TableHead className="w-44 font-semibold">Trainer</TableHead>
                  <TableHead className="w-32 font-semibold">Room</TableHead>
                  <TableHead className="w-28 text-center font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session, index) => {
                  const dateStr = formatDateDisplay(session.startTime);
                  const startTime = formatTimeDisplay(session.startTime);
                  const endTime = formatTimeDisplay(session.endTime);

                  return (
                    <TableRow key={session.id || index} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-center font-mono text-xs text-muted-foreground font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {dateStr}
                      </TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap">
                        <span className="bg-muted px-2 py-0.5 rounded text-muted-foreground">
                          {startTime} - {endTime}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-xs sm:text-sm text-foreground">
                          {session.title || "Session"}
                        </div>
                        {session.topicName && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {session.topicName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <span className="font-medium text-foreground">
                          {session.trainerName || `Trainer #${session.trainerId}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        <span className="inline-block bg-muted/60 px-2 py-0.5 rounded border">
                          {session.room || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Badge
                          variant={
                            session.status === "SCHEDULED"
                              ? "outline"
                              : session.status === "COMPLETED"
                              ? "default"
                              : "destructive"
                          }
                          className="text-[10px] px-2.5 py-0.5 uppercase tracking-wider font-semibold"
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

        {/* Dialog Footer */}
        <DialogFooter className="mt-4 pt-2 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            Showing <strong className="text-foreground">{filteredSessions.length}</strong> of{" "}
            <strong className="text-foreground">{sessions.length}</strong> session(s)
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
