import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowLeft, CheckCheck, LoaderCircle, PenSquare } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { sessionApi } from "@/api/features/demo/session.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import type { SessionDTO } from "@/types";

function errorMessage(error: unknown, fallback: string): string {
    if (!isAxiosError<{ message?: unknown; errors?: Record<string, unknown> }>(error)) return fallback;
    const body = error.response?.data;
    const messages = [
        typeof body?.message === "string" ? body.message : "",
        ...Object.values(body?.errors ?? {}).flat().filter((value): value is string => typeof value === "string"),
    ].filter(Boolean);
    return [...new Set(messages)].join(" ") || fallback;
}

const detailFields: { name: keyof SessionDTO; label: string }[] = [
    { name: "id", label: "Session ID" },
    { name: "title", label: "Session Title" },
    { name: "classId", label: "Class ID" },
    { name: "topicId", label: "Topic ID" },
    { name: "trainerId", label: "Trainer ID" },
    { name: "teachingAssignmentId", label: "Teaching Assignment ID" },
    { name: "startTime", label: "Start Time" },
    { name: "endTime", label: "End Time" },
    { name: "roomId", label: "Room ID" },
    { name: "location", label: "Location / Room" },
    { name: "meetingUrl", label: "Meeting URL" },
    { name: "note", label: "Note" },
    { name: "cancelReason", label: "Cancel Reason" },
    { name: "isActive", label: "Active" },
    { name: "createdAt", label: "Created At" },
    { name: "updatedAt", label: "Updated At" },
    { name: "createdBy", label: "Created By" },
    { name: "updatedBy", label: "Updated By" },
];

export function SessionDetailPage() {
    const { id } = useParams<{ id: string }>();
    return <SessionDetailContent key={id} id={id} />;
}

function SessionDetailContent({ id }: { id?: string }) {
    const { hasPermission } = usePermissions();
    const client = useQueryClient();
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState("");
    const submitting = useRef(false);
    const detailKey = ["session", "detail", id];
    const query = useQuery({
        queryKey: detailKey,
        queryFn: () => sessionApi.getById(id!),
        enabled: !!id,
        retry: false,
    });
    const canComplete = hasPermission("SESSION_UPDATE") && query.data?.status === "SCHEDULED";
    const completion = useMutation({
        mutationFn: (variables: { id: string; note: string }) => sessionApi.completeSession(variables.id, { note: variables.note }),
        retry: false,
        onSuccess: (session, variables) => {
            client.setQueryData(["session", "detail", variables.id], session);
            setOpen(false);
            toast.success("Session completed successfully.");
            // Both the generic list and the detail/editor queries use this prefix.
            void client.invalidateQueries({ queryKey: ["session"] }).catch(() => {
                toast.error("Session completed, but refreshing the session list failed. Please reload.");
            });
        },
        onError: (error) => {
            toast.error(errorMessage(error, "Unable to complete this session. Please try again."));
        },
        onSettled: () => { submitting.current = false; },
    });
    const busy = completion.isPending;

    function startCompletion() {
        if (!canComplete || busy || submitting.current) return;
        completion.reset();
        setNote(query.data?.note ?? "");
        setOpen(true);
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        if (!id || !canComplete || busy || submitting.current) return;
        submitting.current = true;
        completion.mutate({ id, note });
    }

    return <MainLayout pathName={{ sessions: "Class Schedules", detail: "Detail" }}>
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle>Session Detail</CardTitle>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline"><Link to="/sessions"><ArrowLeft className="size-4" />Back to list</Link></Button>
                    {canComplete && <>
                        <Button asChild variant="outline"><Link to={`/sessions/${id}/edit`}><PenSquare className="size-4" />Edit</Link></Button>
                        <Button disabled={busy} onClick={startCompletion}><CheckCheck className="size-4" />Complete</Button>
                    </>}
                </div>
            </CardHeader>
            <CardContent>
                {!id ? <p role="alert">Session ID is missing.</p> : query.isPending ? <p role="status">Loading session...</p> : query.isError ?
                    <Alert variant="destructive"><AlertDescription>{errorMessage(query.error, "Unable to load this session.")}</AlertDescription></Alert> : query.data && <>
                        <div className="mb-5 flex items-center gap-3"><span className="text-sm font-medium text-muted-foreground">Status</span><Badge variant="secondary">{query.data.status}</Badge></div>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            {detailFields.map(({ name, label }) => <div key={name} className={name === "note" ? "sm:col-span-2" : undefined}>
                                <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                                <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{typeof query.data[name] === "boolean" ? query.data[name] ? "Yes" : "No" : String(query.data[name] ?? "-")}</dd>
                            </div>)}
                        </dl>
                    </>}
            </CardContent>
        </Card>
        <Dialog open={open} onOpenChange={(value) => { if (!busy && !submitting.current) setOpen(value); }}>
            <DialogContent showCloseButton={!busy} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}>
                <DialogHeader><DialogTitle>Complete session</DialogTitle><DialogDescription>Mark {query.data?.title || "this session"} as completed and save the notes from the lesson.</DialogDescription></DialogHeader>
                <form className="space-y-4" onSubmit={submit} aria-busy={busy}>
                    <div className="space-y-2"><Label htmlFor="session-completion-note">Completion note (optional)</Label><Textarea id="session-completion-note" value={note} disabled={busy} rows={5} onChange={(event) => setNote(event.target.value)} /></div>
                    {completion.isError && <Alert variant="destructive"><AlertDescription>{errorMessage(completion.error, "Unable to complete this session. Please try again.")}</AlertDescription></Alert>}
                    <DialogFooter>
                        <Button type="button" variant="outline" disabled={busy} onClick={() => { if (!submitting.current) setOpen(false); }}>Cancel</Button>
                        <Button type="submit" disabled={busy || !canComplete}>{busy && <LoaderCircle className="size-4 animate-spin" />}{busy ? "Completing..." : "Confirm"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    </MainLayout>;
}
