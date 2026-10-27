import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { classSetupApi, type AssignmentSessionStatus } from "@/api/features/class-setup.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatScheduleDateTime, safeMeetingUrl } from "../assignment-detail";

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 404) return "This teaching assignment no longer exists.";
    if (error.response?.status === 403) return "You do not have permission to view this assignment.";
    if ([502, 503, 504].includes(error.response?.status ?? 0)) return "The shared profile service is unavailable. Please try again.";
    if (!error.response) return "Unable to connect to the server. Please check your connection.";
  }
  return "Unable to load data. Please try again.";
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0 space-y-1">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="break-words text-sm font-medium">{children}</dd>
  </div>;
}

export function AssignmentDetailDialog({ assignmentId, onClose }: { assignmentId: number; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [status, setStatus] = useState<AssignmentSessionStatus | "all">("all");
  const [sort, setSort] = useState("startTime,asc");
  const detail = useQuery({
    queryKey: ["teaching-assignment-detail", assignmentId],
    queryFn: ({ signal }) => classSetupApi.getAssignment(assignmentId, signal), retry: 1,
  });
  const sessions = useQuery({
    queryKey: ["teaching-assignment-sessions", assignmentId, { page, size, status, sort }],
    queryFn: ({ signal }) => classSetupApi.getAssignmentSessions(assignmentId,
      { page, size, sort, status: status === "all" ? undefined : status }, signal), retry: 1,
  });
  const assignment = detail.data;
  const data = sessions.data;
  const total = data?.totalElements ?? 0;
  const pages = data?.totalPages ?? 0;

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>Assignment details</DialogTitle>
        <DialogDescription>View the class subject, assigned trainer, effective dates and linked teaching sessions.</DialogDescription>
      </DialogHeader>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={detail.isFetching || sessions.isFetching} onClick={() => { void detail.refetch(); void sessions.refetch(); }}>
          <RefreshCw className={detail.isFetching || sessions.isFetching ? "size-4 animate-spin" : "size-4"} />Refresh details
        </Button>
      </div>
      <section aria-label="Assignment information" aria-busy={detail.isFetching}>
        {detail.isPending ? <p role="status" className="flex items-center justify-center gap-2 py-8 text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading assignment details...</p>
          : detail.isError ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to load assignment details</AlertTitle><AlertDescription>{errorMessage(detail.error)} <Button variant="outline" size="sm" onClick={() => void detail.refetch()}>Retry details</Button></AlertDescription></Alert>
          : assignment && <dl className="grid gap-5 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="Class">{assignment.className || assignment.classCode || `Class #${assignment.classId}`}<span className="block font-normal text-muted-foreground">{assignment.classCode}</span></DetailField>
            <DetailField label="Subject">{assignment.subjectName}<span className="block font-normal text-muted-foreground">{assignment.subjectCode}{assignment.subjectVersion ? ` · v${assignment.subjectVersion}` : ""}</span></DetailField>
            <DetailField label="Training program">{assignment.programName || "Not available"}<span className="block font-normal text-muted-foreground">{assignment.programCode}{assignment.programVersion ? ` · v${assignment.programVersion}` : ""}</span></DetailField>
            <DetailField label="Trainer">{assignment.trainerName || `Trainer #${assignment.trainerId}`}<span className="block font-normal text-muted-foreground">{assignment.trainerEmail || "Profile information not available"}</span></DetailField>
            <DetailField label="Role"><Badge variant={assignment.role === "MAIN" ? "default" : "outline"}>{assignment.role === "MAIN" ? "Main trainer" : "Assistant trainer"}</Badge></DetailField>
            <DetailField label="Effective period">{assignment.effectiveFrom.split("-").reverse().join("/")} → {assignment.effectiveTo ? assignment.effectiveTo.split("-").reverse().join("/") : "No end date"}</DetailField>
          </dl>}
      </section>
      <section className="space-y-4" aria-label="Linked sessions" aria-busy={sessions.isFetching}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-semibold">Linked sessions {data && !sessions.isError && <Badge variant="secondary">{total}</Badge>}</h2><p className="mt-1 text-sm text-muted-foreground">Includes completed, cancelled and archived sessions.</p></div>
          <div className="flex flex-wrap gap-3">
            <div className="w-40 space-y-1"><Label htmlFor="detail-session-status">Session status</Label>
              <Select value={status} onValueChange={(value) => { setStatus(value as typeof status); setPage(0); }}>
                <SelectTrigger id="detail-session-status" className="w-full"><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="all">All statuses</SelectItem><SelectItem value="SCHEDULED">Scheduled</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-44 space-y-1"><Label htmlFor="detail-session-sort">Sort order</Label>
              <Select value={sort} onValueChange={(value) => { setSort(value); setPage(0); }}>
                <SelectTrigger id="detail-session-sort" className="w-full"><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="startTime,asc">Earliest first</SelectItem><SelectItem value="startTime,desc">Latest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {sessions.isPending ? <p role="status" className="flex items-center justify-center gap-2 py-8 text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading linked sessions...</p>
          : sessions.isError ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to load linked sessions</AlertTitle><AlertDescription>{errorMessage(sessions.error)} <Button variant="outline" size="sm" onClick={() => void sessions.refetch()}>Retry sessions</Button></AlertDescription></Alert>
          : !data?.content.length ? <div role="status" className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">{total > 0 ? "This page has no sessions" : status === "all" ? "No sessions linked yet" : "No sessions match this status"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{total > 0 ? "Return to the first page to view the current sessions." : "Linked sessions will appear here when they are scheduled."}</p>
            {page > 0 && <Button className="mt-3" variant="outline" size="sm" onClick={() => setPage(0)}>Go to first page</Button>}
          </div>
          : <Table><TableHeader><TableRow><TableHead>Session</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Location / meeting</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{data.content.map((session) => {
              const meetingUrl = safeMeetingUrl(session.meetingUrl);
              return <TableRow key={session.id}>
                <TableCell className="max-w-64 whitespace-normal font-medium">{session.title}{!session.active && <Badge variant="outline" className="ml-2">Archived</Badge>}</TableCell>
                <TableCell className="whitespace-nowrap">{formatScheduleDateTime(session.startTime)}</TableCell>
                <TableCell className="whitespace-nowrap">{formatScheduleDateTime(session.endTime)}</TableCell>
                <TableCell className="max-w-64 whitespace-normal"><p>{session.location || (session.roomId ? `Room #${session.roomId}` : "Not specified")}</p>
                  {meetingUrl && <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-4">Join meeting<ExternalLink className="size-3" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}
                </TableCell>
                <TableCell><Badge variant={session.status === "SCHEDULED" ? "default" : session.status === "COMPLETED" ? "secondary" : "outline"}>{session.status === "SCHEDULED" ? "Scheduled" : session.status === "COMPLETED" ? "Completed" : "Cancelled"}</Badge></TableCell>
              </TableRow>;
            })}</TableBody></Table>}
        {!sessions.isPending && !sessions.isError && data && <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p role="status" className="text-sm text-muted-foreground">{data.content.length ? `${page * size + 1}–${page * size + data.content.length}` : "0"} / {total} sessions</p>
          <div className="flex flex-wrap items-center gap-2"><Label htmlFor="detail-session-size">Rows</Label>
            <Select value={String(size)} onValueChange={(value) => { setSize(Number(value)); setPage(0); }}><SelectTrigger id="detail-session-size" className="w-20"><SelectValue /></SelectTrigger><SelectContent>{[10, 20, 50].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select>
            <Button variant="outline" size="icon" aria-label="Previous sessions page" disabled={page === 0 || sessions.isFetching} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="size-4" /></Button>
            <span className="text-sm">Page {page + 1} / {Math.max(1, pages)}</span>
            <Button variant="outline" size="icon" aria-label="Next sessions page" disabled={page + 1 >= pages || sessions.isFetching} onClick={() => setPage((current) => current + 1)}><ChevronRight className="size-4" /></Button>
          </div>
        </div>}
      </section>
      <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
