import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { sessionApi } from "@/api/features/demo/session.api";
import { scheduleValidationApi, type ScheduleCandidate, type ScheduleValidationResult } from "@/api/features/schedule-check.api";
import { ScheduleCandidateForm } from "./ScheduleCandidateForm";
import { ScheduleIssues } from "./ScheduleIssues";
import { sessionEditorError, sessionFieldLabel } from "./session-editor-errors";

export function SessionScheduleEditor() {
    const { id } = useParams<{ id: string }>();
    const permissions = usePermissions();
    const cache = useQueryClient();
    const resources = useQuery({ queryKey: ["schedule-validation", "resources"], queryFn: scheduleValidationApi.resources, retry: false });
    const session = useQuery({ queryKey: ["session", id], queryFn: () => sessionApi.getById(id!), enabled: !!id, retry: false });
    const [form, setForm] = useState<ScheduleCandidate>({ title: "", startTime: "", endTime: "" });
    const [result, setResult] = useState<ScheduleValidationResult>();
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [createdId, setCreatedId] = useState<string>();
    useEffect(() => {
        if (!session.data || !resources.data) return;
        const s = session.data;
        // Reference assignments are not persisted links. Preserve the fetched identity, including a legacy null link.
        setForm({ id: Number(id), classId: s.classId, topicId: s.topicId, trainerId: s.trainerId,
            teachingAssignmentId: s.teachingAssignmentId ?? null, roomId: s.roomId, location: s.location,
            meetingUrl: s.meetingUrl ?? "", title: s.title ?? "", startTime: s.startTime ?? "", endTime: s.endTime ?? "" });
    }, [session.data, resources.data, id]);
    const editable = (!id || session.data?.status === "SCHEDULED") && permissions.hasPermission(id || createdId ? "SESSION_UPDATE" : "SESSION_CREATE");
    const ready = !!resources.data && (!id || !!session.data);
    const legacyAssignment = id && session.data && session.data.teachingAssignmentId == null ? {
        classId: session.data.classId, topicId: session.data.topicId, trainerId: session.data.trainerId,
    } : undefined;
    const change = (value: ScheduleCandidate) => {
        setForm(value); setResult(undefined); setError(""); setFieldErrors({}); setSaved(false);
    };
    const request = async (save: boolean) => {
        if (busy) return;
        setBusy(true); setError(""); setFieldErrors({}); setSaved(false); setResult(undefined);
        let operation: "save" | "validate" = "validate";
        try {
            const candidate = { ...form, id: id ? Number(id) : createdId ? Number(createdId) : undefined };
            const checked = await scheduleValidationApi.validate([candidate]);
            if (!save || !checked.valid) {
                setResult(checked);
                return;
            }
            operation = "save";
            // Only mutable SessionDTO fields are written; schedule-check identity is supplied by the URL on update.
            const payload = {
                classId: candidate.classId, topicId: candidate.topicId, trainerId: candidate.trainerId,
                teachingAssignmentId: candidate.teachingAssignmentId, roomId: candidate.roomId, location: candidate.location,
                meetingUrl: candidate.meetingUrl || (session.data?.meetingUrl == null ? session.data?.meetingUrl : ""),
                title: candidate.title, startTime: candidate.startTime, endTime: candidate.endTime,
                isActive: session.data?.isActive ?? true, note: session.data?.note,
            };
            const targetId = id ?? createdId;
            const updated = targetId ? await sessionApi.update(targetId, payload) : await sessionApi.create(payload);
            if (!id) setCreatedId(String(updated.id));
            setSaved(true);
            // A refresh failure must not turn a committed save into a save-failed message.
            void cache.invalidateQueries({ queryKey: ["session"] }).catch(() => undefined);
        } catch (err) {
            setResult(undefined);
            const details = sessionEditorError(err, operation);
            setError(details.message); setFieldErrors(details.fields);
            if (isAxiosError(err) && err.response?.status === 409 && Array.isArray(err.response.data?.issues)) {
                setResult({ ...err.response.data, valid: false } as ScheduleValidationResult);
            }
        } finally { setBusy(false); }
    };
    return <MainLayout><div className="mx-auto w-full max-w-4xl space-y-5">
        <h1 className="text-2xl font-semibold">{id ? `Session #${id}` : "Create session"}</h1>
        <div className="flex gap-5"><Link className="text-blue-600 underline" to="/sessions">Session list</Link><Link className="text-blue-600 underline" to="/schedule-validation">Validate multiple sessions</Link></div>
        {(resources.isPending || (id && session.isPending)) && <p role="status">Loading scheduling information...</p>}
        {(resources.isError || session.isError) && <div role="alert"><p>Unable to load the session or scheduling information. Please try again.</p><Button onClick={() => { void resources.refetch(); if (id) void session.refetch(); }}>Retry</Button></div>}
        {ready && <>
            <p className="text-sm text-muted-foreground">All times are shown in {resources.data!.rules.timezone}. Scheduling requirements are checked again when you save.</p>
            {!editable && <p role="status">This session cannot be edited because of its status or your access permissions.</p>}
            <form className="space-y-5 rounded-lg border p-5" onSubmit={e => { e.preventDefault(); void request(true); }}>
                <ScheduleCandidateForm value={form} onChange={change} resources={resources.data!} disabled={busy || !editable} prefix="session" legacyAssignment={legacyAssignment} />
                {editable && <div className="flex gap-3"><Button type="button" variant="outline" disabled={busy} onClick={() => void request(false)}>Validate</Button><Button disabled={busy || saved}>{busy ? "Processing..." : "Validate and save"}</Button></div>}
            </form>
        </>}
        {error && <div role="alert" className="space-y-2 rounded-lg border border-red-400 p-4 text-red-700">
            <p>{error}</p>
            {Object.keys(fieldErrors).length > 0 && <ul className="list-disc space-y-1 pl-5">
                {Object.entries(fieldErrors).flatMap(([field, messages]) => messages.map((message, index) =>
                    <li key={`${field}-${index}`}><strong>{sessionFieldLabel(field)}: </strong>{message}</li>))}
            </ul>}
        </div>}
        {saved && <p role="status" className="text-green-700">Session saved successfully.</p>}
        {result && <ScheduleIssues result={result} />}
    </div></MainLayout>;
}
