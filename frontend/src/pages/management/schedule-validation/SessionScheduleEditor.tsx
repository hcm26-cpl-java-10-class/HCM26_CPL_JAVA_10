import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { sessionApi } from "@/api/features/demo/session.api";
import { scheduleValidationApi, type ScheduleCandidate, type ScheduleValidationResult } from "@/api/features/schedule-check.api";
import { ScheduleCandidateForm } from "./ScheduleCandidateForm";
import { ScheduleIssues } from "./ScheduleIssues";

export function SessionScheduleEditor() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const preselectedClassId = searchParams.get("classId");
    const preselectedSubjectId = searchParams.get("subjectId") ?? searchParams.get("topicId");
    const permissions = usePermissions();
    const cache = useQueryClient();
    const resources = useQuery({ queryKey: ["schedule-validation", "resources"], queryFn: scheduleValidationApi.resources, retry: false });
    const session = useQuery({ queryKey: ["session", id], queryFn: () => sessionApi.getById(id!), enabled: !!id, retry: false });
    const [form, setForm] = useState<ScheduleCandidate>({ title: "", startTime: "", endTime: "" });
    const [result, setResult] = useState<ScheduleValidationResult>();
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [createdId, setCreatedId] = useState<string>();
    useEffect(() => {
        if (!session.data || !resources.data) return;
        const s = session.data;
        const refs = resources.data.references;
        const a = refs.assignments.find(a => a.id === s.teachingAssignmentId)
            ?? refs.assignments.find(a => a.classId === s.classId && a.topicId === s.topicId && a.trainerId === s.trainerId && a.status === "ACTIVE");
        const room = refs.rooms.find(r => r.id === s.roomId)
            ?? refs.rooms.find(r => r.name.trim().toLowerCase() === s.location?.trim().toLowerCase());
        setForm({ id: Number(id), classId: s.classId, topicId: s.topicId, trainerId: s.trainerId,
            teachingAssignmentId: a?.id, roomId: room?.id, location: room?.name ?? s.location,
            meetingUrl: s.meetingUrl ?? "", title: s.title ?? "", startTime: s.startTime ?? "", endTime: s.endTime ?? "" });
    }, [session.data, resources.data, id]);
    useEffect(() => {
        if (id || !resources.data || (!preselectedClassId && !preselectedSubjectId)) return;
        const refs = resources.data.references;
        const targetClassId = preselectedClassId ? Number(preselectedClassId) : undefined;
        const targetTopicId = preselectedSubjectId ? Number(preselectedSubjectId) : undefined;
        const matchedAssignment = refs.assignments.find(
            a => a.status === "ACTIVE"
                && (!targetClassId || a.classId === targetClassId)
                && (!targetTopicId || a.topicId === targetTopicId),
        );
        setForm(current => {
            if (current.teachingAssignmentId || current.classId || current.topicId) return current;
            return {
                ...current,
                classId: matchedAssignment?.classId ?? targetClassId,
                topicId: matchedAssignment?.topicId ?? targetTopicId,
                trainerId: matchedAssignment?.trainerId,
                teachingAssignmentId: matchedAssignment?.id,
            };
        });
    }, [id, preselectedClassId, preselectedSubjectId, resources.data]);
    const editable = (!id || session.data?.status === "SCHEDULED") && permissions.hasPermission(id || createdId ? "SESSION_UPDATE" : "SESSION_CREATE");
    const ready = !!resources.data && (!id || !!session.data);
    const change = (value: ScheduleCandidate) => { setForm(value); setResult(undefined); setError(""); setSaved(false); };
    const request = async (save: boolean) => {
        setBusy(true); setError(""); setSaved(false); setResult(undefined);
        try {
            const candidate = { ...form, id: id ? Number(id) : createdId ? Number(createdId) : undefined };
            const checked = await scheduleValidationApi.validate([candidate]);
            setResult(checked);
            if (save && checked.valid) {
                // The save endpoint repeats validation under its database lock.
                const payload = { ...candidate, isActive: session.data?.isActive ?? true };
                const targetId = id ?? createdId;
                const updated = targetId ? await sessionApi.update(targetId, payload) : await sessionApi.create(payload);
                if (!id) setCreatedId(String(updated.id));
                setSaved(true);
                await cache.invalidateQueries({ queryKey: ["session"] });
            }
        } catch (err) {
            if (isAxiosError(err) && err.response?.status === 409 && Array.isArray(err.response.data?.issues)) setResult(err.response.data as ScheduleValidationResult);
            else setError(isAxiosError(err) ? err.response?.data?.message ?? "Unable to process your request. Please try again." : "Unable to process your request. Please try again.");
        } finally { setBusy(false); }
    };
    return <MainLayout><div className="mx-auto w-full max-w-4xl space-y-5">
        <h1 className="text-2xl font-semibold">{id ? `Session #${id}` : "Create session"}</h1>
        <div className="flex flex-wrap gap-5">
            {preselectedClassId && <Link className="text-blue-600 underline" to={`/class-setup?classId=${preselectedClassId}`}>← Kế hoạch môn học lớp</Link>}
            <Link className="text-blue-600 underline" to="/sessions">Session list</Link>
            <Link className="text-blue-600 underline" to="/schedule-validation">Validate multiple sessions</Link>
        </div>
        {(resources.isPending || (id && session.isPending)) && <p role="status">Loading scheduling information...</p>}
        {(resources.isError || session.isError) && <div role="alert"><p>Unable to load the session or scheduling information. Please try again.</p><Button onClick={() => { void resources.refetch(); if (id) void session.refetch(); }}>Retry</Button></div>}
        {ready && <>
            <p className="text-sm text-muted-foreground">All times are shown in {resources.data!.rules.timezone}. Scheduling requirements are checked again when you save.</p>
            {!editable && <p role="status">This session cannot be edited because of its status or your access permissions.</p>}
            <form className="space-y-5 rounded-lg border p-5" onSubmit={e => { e.preventDefault(); void request(true); }}>
                <ScheduleCandidateForm value={form} onChange={change} resources={resources.data!} disabled={busy || !editable} prefix="session" />
                {editable && <div className="flex gap-3"><Button type="button" variant="outline" disabled={busy} onClick={() => void request(false)}>Validate</Button><Button disabled={busy || saved}>{busy ? "Processing..." : "Validate and save"}</Button></div>}
            </form>
        </>}
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {saved && <p role="status" className="text-green-700">Session saved successfully.</p>}
        {result && <ScheduleIssues result={result} />}
    </div></MainLayout>;
}
