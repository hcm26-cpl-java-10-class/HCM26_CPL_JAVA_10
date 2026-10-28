import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { classSetupApi } from "@/api/features/class-setup.api";
import { studySessionApi, type StudySessionRow, type StudySessionWrite } from "@/api/features/study-session.api";

const selectStyle = "h-10 w-full rounded-md border bg-background px-3 text-sm";
function errorText(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data;
    if (body?.issues?.length) return body.issues.map((issue: { message: string }) => issue.message).join(" ");
    if (body?.errors && Object.keys(body.errors).length) return Object.values(body.errors).flat().join(" ");
    return body?.message || "Unable to connect to the server. Please try again.";
  }
  return "Unable to complete the request.";
}
export default function StudySessionPage() {
  const { hasPermission } = usePermissions();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [editor, setEditor] = useState<StudySessionRow | "new" | null>(null);
  const [action, setAction] = useState<{ row: StudySessionRow; mode: "cancel" | "complete" } | null>(null);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["study-sessions", page, applied], queryFn: ({ signal }) => studySessionApi.list({ page, search: applied }, signal) });
  function refresh() {
    for (const prefix of ["study-sessions", "teaching-assignments", "teaching-assignment-sessions", "teaching-assignment-detail", "teaching-assignment-edit-context", "teaching-assignment-lifecycle", "teaching-assignment-impact", "teaching-assignment-end-impact", "calendar"]) {
      void client.invalidateQueries({ queryKey: [prefix] });
    }
  }
  return <MainLayout><div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><CalendarDays />Study Sessions</h1><p className="mt-1 text-muted-foreground">Schedule lessons using the class curriculum and effective teaching assignments.</p></div>
      <div className="flex gap-2"><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="size-4" />Refresh</Button>{hasPermission("STUDY_SESSION_CREATE") && <Button onClick={() => setEditor("new")}><Plus className="size-4" />New session</Button>}</div></div>
    <Card><CardContent className="space-y-4 pt-6">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setApplied(search.trim()); setPage(0); }}><Input aria-label="Search study sessions" placeholder="Search title, room or lecturer" value={search} onChange={(event) => setSearch(event.target.value)} /><Button type="submit">Search</Button></form>
      {query.isPending ? <p role="status" className="flex gap-2 py-6"><LoaderCircle className="size-4 animate-spin" />Loading sessions...</p> : query.isError ? <Failure error={query.error} /> : <>
        <Table><TableHeader><TableRow><TableHead>Session</TableHead><TableHead>Date / time</TableHead><TableHead>Trainer</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
          {query.data.content.map((row) => <TableRow key={row.id}><TableCell><p className="font-medium">{row.title}</p><p className="text-xs text-muted-foreground">{row.subjectName} · {row.classId ? `Class #${row.classId}` : "Legacy session"}</p></TableCell><TableCell>{row.sessionDate}<p className="text-xs text-muted-foreground">{row.startTime} – {row.endTime}</p></TableCell><TableCell>{row.lecturer}</TableCell><TableCell><Badge variant="secondary">{row.status}</Badge></TableCell><TableCell>{row.status === "SCHEDULED" && hasPermission("STUDY_SESSION_UPDATE") && <div className="flex flex-wrap gap-1"><Button variant="ghost" size="sm" onClick={() => setEditor(row)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => setAction({ row, mode: "cancel" })}>Cancel</Button><Button variant="ghost" size="sm" onClick={() => setAction({ row, mode: "complete" })}>Complete</Button></div>}</TableCell></TableRow>)}
          {!query.data.content.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No study sessions found.</TableCell></TableRow>}
        </TableBody></Table>
        <div className="flex items-center justify-end gap-3"><span className="text-sm">{query.data.totalElements} sessions · Page {page + 1} / {Math.max(1, query.data.totalPages)}</span><Button variant="outline" size="icon" aria-label="Previous session page" disabled={page === 0 || query.isFetching} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Next session page" disabled={page + 1 >= query.data.totalPages || query.isFetching} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button></div>
      </>}
    </CardContent></Card>
    {editor && <SessionEditor row={editor === "new" ? null : editor} close={() => setEditor(null)} saved={() => { refresh(); setEditor(null); }} />}
    {action && <SessionAction {...action} close={() => setAction(null)} saved={() => { refresh(); setAction(null); }} />}
  </div></MainLayout>;
}
function Failure({ error }: { error: unknown }) { return <Alert variant="destructive"><AlertTitle>Request failed</AlertTitle><AlertDescription>{errorText(error)}</AlertDescription></Alert>; }

function SessionEditor({ row, close, saved }: { row: StudySessionRow | null; close: () => void; saved: () => void }) {
  const [classId, setClassId] = useState(row?.classId?.toString() || "");
  const [subjectId, setSubjectId] = useState(row?.programSubjectId?.toString() || "");
  const [assignmentId, setAssignmentId] = useState(row?.teachingAssignmentId?.toString() || "");
  const [date, setDate] = useState(row?.sessionDate || "");
  const [start, setStart] = useState(row?.startTime.slice(0, 5) || "09:00");
  const [end, setEnd] = useState(row?.endTime.slice(0, 5) || "11:00");
  const [title, setTitle] = useState(row?.title || "");
  const [roomId, setRoomId] = useState(row?.roomId?.toString() || "");
  const [url, setUrl] = useState(row?.meetingUrl || "");
  const [type, setType] = useState<StudySessionRow["type"]>(row?.type || "LECTURE");
  const options = useQuery({ queryKey: ["teaching-assignment-options"], queryFn: ({ signal }) => classSetupApi.getAssignmentOptions(signal) });
  const context = useQuery({ queryKey: ["study-session-subjects", classId], queryFn: () => classSetupApi.getProgramSubjects(Number(classId)), enabled: Boolean(classId) });
  const available = useQuery({ queryKey: ["available-assignments", classId, subjectId, date, start, end], enabled: Boolean(classId && subjectId && date && start && end && end > start),
    queryFn: ({ signal }) => classSetupApi.getAvailableAssignments(Number(classId), { programSubjectId: Number(subjectId), from: `${date}T${start}:00`, to: `${date}T${end}:00` }, signal) });
  const assignment = available.data?.find((item) => item.id === Number(assignmentId));
  const mutation = useMutation({ mutationFn: async () => {
    if (!assignment) throw new Error("Select an effective teaching assignment.");
    const payload: StudySessionWrite = { classId: assignment.classId, subjectId: assignment.subjectId, programSubjectId: assignment.programSubjectId, teachingAssignmentId: assignment.id,
      trainerId: assignment.trainerId, title, sessionDate: date, startTime: `${start}:00`, endTime: `${end}:00`, roomId: roomId ? Number(roomId) : null,
      room: null, meetingUrl: url || "", lecturer: assignment.trainerName || `Trainer ${assignment.trainerId}`, type, isActive: row?.isActive ?? true };
    return row ? studySessionApi.update(row.id, payload) : studySessionApi.create(payload);
  }, retry: false, onSuccess: () => { toast.success("Study session saved."); saved(); } });
  const busy = mutation.isPending;
  const field = (label: string, element: React.ReactNode) => <div className="space-y-2"><Label>{label}</Label>{element}</div>;
  function submit(event: FormEvent) { event.preventDefault(); if (!busy && assignment && !available.isFetching && !available.isError) mutation.mutate(); }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) close(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" showCloseButton={!busy} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>{row ? "Edit study session" : "New study session"}</DialogTitle><DialogDescription>Choose a class subject and a teaching assignment valid for the full session. The server checks again when saving.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={submit}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      {field("Class", <select aria-label="Class" className={selectStyle} required value={classId} onChange={(event) => { setClassId(event.target.value); setSubjectId(""); setAssignmentId(""); }}><option value="">Select class</option>{options.data?.classes.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select>)}
      {field("Class subject", <select aria-label="Class subject" className={selectStyle} required disabled={!classId || context.isFetching} value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setAssignmentId(""); }}><option value="">Select subject</option>{context.data?.subjects.map((item) => <option key={item.programSubjectId} value={item.programSubjectId}>{item.subjectCode} · {item.subjectName}</option>)}</select>)}
      {field("Session date", <Input aria-label="Session date" type="date" required value={date} onChange={(event) => { setDate(event.target.value); setAssignmentId(""); }} />)}
      {field("Session title", <Input aria-label="Session title" required minLength={5} maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} />)}
      {field("Start time", <Input aria-label="Start time" type="time" required value={start} onChange={(event) => { setStart(event.target.value); setAssignmentId(""); }} />)}
      {field("End time", <Input aria-label="End time" type="time" required value={end} onChange={(event) => { setEnd(event.target.value); setAssignmentId(""); }} />)}
      <div className="space-y-2 sm:col-span-2"><Label>Teaching assignment</Label><select aria-label="Teaching assignment" className={selectStyle} required disabled={!date || available.isFetching} value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}><option value="">{available.isFetching ? "Loading assignments..." : "Select an effective assignment"}</option>{available.data?.map((item) => <option key={item.id} value={item.id}>{item.trainerName || `Trainer ${item.trainerId}`} · {item.role} · {item.effectiveFrom} – {item.effectiveTo || "No end date"}</option>)}</select>{available.isSuccess && !available.data.length && <p role="status" className="text-sm text-muted-foreground">No effective assignment. Create one or choose another date.</p>}</div>
      {field("Room ID (optional for online sessions)", <Input aria-label="Room ID" type="number" min={1} step={1} value={roomId} onChange={(event) => setRoomId(event.target.value)} />)}
      {field("Meeting URL", <Input aria-label="Meeting URL" type="url" required={!roomId} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />)}
      {field("Session type", <select aria-label="Session type" className={selectStyle} value={type} onChange={(event) => setType(event.target.value as StudySessionRow["type"])}><option value="LECTURE">Lecture</option><option value="LAB">Lab</option><option value="EXAM">Exam</option></select>)}
    </fieldset>
      {(options.isError || context.isError || available.isError || mutation.isError) && <Failure error={mutation.error || available.error || context.error || options.error} />}
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={close}>Close</Button><Button type="submit" disabled={busy || !assignment || available.isFetching || available.isError}>{busy && <LoaderCircle className="size-4 animate-spin" />}Save session</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
function SessionAction({ row, mode, close, saved }: { row: StudySessionRow; mode: "cancel" | "complete"; close: () => void; saved: () => void }) {
  const [text, setText] = useState("");
  const mutation = useMutation({ mutationFn: () => mode === "cancel" ? studySessionApi.cancel(row.id, text.trim()) : studySessionApi.complete(row.id, text), retry: false, onSuccess: saved });
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) close(); }}><DialogContent showCloseButton={!mutation.isPending} onEscapeKeyDown={(event) => { if (mutation.isPending) event.preventDefault(); }} onPointerDownOutside={(event) => { if (mutation.isPending) event.preventDefault(); }}><DialogHeader><DialogTitle>{mode === "cancel" ? "Cancel session" : "Complete session"}</DialogTitle><DialogDescription>{row.title}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}><Label htmlFor="session-action-text">{mode === "cancel" ? "Cancellation reason" : "Completion notes (optional)"}</Label><Input id="session-action-text" required={mode === "cancel"} maxLength={mode === "cancel" ? 500 : 1000} value={text} disabled={mutation.isPending} onChange={(event) => setText(event.target.value)} />{mutation.isError && <Failure error={mutation.error} />}<DialogFooter><Button type="button" variant="outline" disabled={mutation.isPending} onClick={close}>Close</Button><Button type="submit" disabled={mutation.isPending || (mode === "cancel" && !text.trim())}>Confirm</Button></DialogFooter></form></DialogContent></Dialog>;
}
