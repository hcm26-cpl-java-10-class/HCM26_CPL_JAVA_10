import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { classSetupApi, classSetupKey, type AssignmentInput, type MainAssignment } from "@/api/features/class-setup.api";
import { clsApi } from "@/api/features/cls.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/common/NativeSelect";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { ClassModal } from "./ClassModal";
import { classReadinessKey } from "@/hooks/useClassInsights";

const errorMessage = (error: unknown) => {
    const e = error as { response?: { data?: { message?: string } }; message?: string };
    return e?.response?.data?.message || e?.message || "The request failed. No successful save was confirmed.";
};
export function ClassSetupForm({ classId }: { classId: number }) {
    const { hasPermission } = usePermissions();
    const client = useQueryClient();
    const canRead = ["CLASS_READ", "PROGRAM_READ", "ASSIGNMENT_READ"].every(hasPermission);
    const query = useQuery({ queryKey: classSetupKey(classId), queryFn: () => classSetupApi.get(classId), enabled: canRead, retry: false });
    const programs = useQuery({ queryKey: ["class-setup", "active-programs"], queryFn: classSetupApi.activePrograms, enabled: canRead, retry: false });
    const trainers = useQuery({ queryKey: ["class-setup", "verified-trainers"], queryFn: classSetupApi.verifiedTrainers, enabled: canRead, retry: false, staleTime: 0 });
    const profile = useQuery({ queryKey: ["classes", "setup-profile", classId], queryFn: async () => (await clsApi.getClassById(classId)).data, enabled: canRead, retry: false });
    const readiness = useQuery({ queryKey: classReadinessKey(classId), queryFn: () => clsApi.getReadiness(classId), enabled: canRead, retry: false });
    const [programId, setProgramId] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [subjectId, setSubjectId] = useState("");
    const [trainerId, setTrainerId] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [editingProfile, setEditingProfile] = useState(false);
    const [notice, setNotice] = useState("");
    const [validation, setValidation] = useState("");
    const data = query.data;
    useEffect(() => {
        if (!data) return;
        setProgramId(data.programLink ? String(data.programLink.programId) : "");
        setEditingId(null); setSubjectId(""); setTrainerId(""); setFrom(data.startDate); setTo(data.endDate);
        setValidation("");
    }, [data]);
    const refresh = async () => {
        // Broad class invalidation also updates profile/calendar consumers, but readiness is explicitly refreshed.
        await client.invalidateQueries({ queryKey: ["classes"] });
        await client.invalidateQueries({ queryKey: classReadinessKey(classId) });
        await query.refetch();
    };
    const link = useMutation({ mutationFn: () => classSetupApi.link(classId, Number(programId)),
        onSuccess: async () => { setNotice("Program link saved. Readiness refreshed from the backend."); await refresh(); },
    });
    const assignment = useMutation({ mutationFn: (input: AssignmentInput) => editingId == null
        ? classSetupApi.createAssignment(classId, input) : classSetupApi.updateAssignment(classId, editingId, input),
        onSuccess: async () => { setNotice("MAIN assignment saved. Readiness refreshed from the backend."); await refresh(); },
    });
    if (!canRead) return <ApiErrorState error={undefined} kind="forbidden" resource="Class Setup (CLASS_READ, PROGRAM_READ and ASSIGNMENT_READ required)" />;
    if (query.isPending) return <p role="status">Loading Class Setup…</p>;
    if (query.isError) return <ApiErrorState error={query.error} resource="Class Setup" onRetry={() => void query.refetch()} />;
    if (!data) return null;
    const selected = programs.data?.find(p => p.id === Number(programId));
    const matches = selected && [selected.code, selected.name].some(value => value.trim().toLowerCase() === data.savedProgram?.trim().toLowerCase());
    const eligible = data.subjects.filter(subject => subject.eligible);
    const busy = link.isPending || assignment.isPending;
    const canAssign = hasPermission(editingId == null ? "ASSIGNMENT_CREATE" : "ASSIGNMENT_UPDATE");
    const linkValid = !!data.programLink && data.programLink.active && data.programLink.status === "ACTIVE" && data.programLink.matchesClassProgram;
    const selectedTrainer = trainers.data?.find(t => t.id === Number(trainerId));
    const matchesMaster = !!selectedTrainer && [selectedTrainer.name, selectedTrainer.email]
        .some(value => value?.trim().toLowerCase() === data.masterTrainer?.trim().toLowerCase());
    const submitAssignment = (event: FormEvent) => {
        event.preventDefault(); setNotice(""); setValidation("");
        if (!from || from > data.startDate || (to && (to < data.endDate || to < from))) {
            setValidation("MAIN assignment must cover the entire class date range. Effective To may be blank for an open-ended assignment."); return;
        }
        if (!eligible.some(s => s.id === Number(subjectId)) || !trainers.data?.some(t => t.id === Number(trainerId))) {
            setValidation("Select an eligible Program Subject and a verified active trainer."); return;
        }
        assignment.mutate({ classId, programSubjectId: Number(subjectId), trainerId: Number(trainerId), role: "MAIN", effectiveFrom: from, effectiveTo: to || null });
    };
    const edit = (item: MainAssignment) => {
        setEditingId(item.id); setSubjectId(String(item.programSubjectId)); setTrainerId(String(item.trainerId));
        setFrom(item.effectiveFrom); setTo(item.effectiveTo || ""); setNotice(""); setValidation(""); assignment.reset();
    };
    return <div className="space-y-6">
        <div className="space-y-1 text-sm">
            <p><strong>{data.classCode}</strong> · Internal Class ID {data.classId}</p>
            <p>Class dates: {data.startDate} – {data.endDate}. Saved Program: <strong>{data.savedProgram}</strong>. Master Trainer: <strong>{data.masterTrainer || "Not entered"}</strong>.</p>
            <p className="text-muted-foreground">This workflow uses the internal class and never substitutes a Shared Class ID. Selecting a program or trainer does not change Class Info.</p>
            {profile.data && hasPermission("CLASS_UPDATE") && <Button type="button" variant="outline" size="sm" onClick={() => setEditingProfile(true)} disabled={busy}>Review Class Info</Button>}
            {profile.isError && <p role="alert">Class Info could not be loaded. {errorMessage(profile.error)}</p>}
        </div>
        {notice && <p role="status">{notice}</p>}
        <section aria-label="Saved Class Readiness" className="space-y-2 rounded-md border p-3 text-sm">
            <h3 className="font-semibold">Readiness from saved data</h3>
            {readiness.isPending ? <p role="status">Loading readiness…</p> : readiness.isError
                ? <ApiErrorState error={readiness.error} resource="Class Readiness" onRetry={() => void readiness.refetch()} />
                : readiness.data && <><p>{readiness.data.ready}/{readiness.data.checks.length} checks READY; {readiness.data.unknown} UNKNOWN; {readiness.data.blocked || 0} BLOCKED.</p>
                    <ul>{readiness.data.checks.map(c => <li key={c.key}>{c.label}: {c.status} — {c.reason}</li>)}</ul></>}
        </section>
        <form className="space-y-3 rounded-md border p-4" onSubmit={event => { event.preventDefault(); setNotice(""); link.mutate(); }}>
            <h3 className="font-semibold">Training Program link</h3>
            <p className="text-sm">Linked program: {data.programLink ? `${data.programLink.code} · version ${data.programLink.version} · ${data.programLink.status}` : "None"}</p>
            {programs.isError && <ApiErrorState error={programs.error} resource="Training Programs" onRetry={() => void programs.refetch()} />}
            <Label htmlFor={`setup-program-${classId}`}>ACTIVE Training Program</Label>
            <NativeSelect id={`setup-program-${classId}`} value={programId} onChange={e => { setProgramId(e.target.value); link.reset(); }} disabled={!hasPermission("CLASS_UPDATE") || busy || !programs.data} required>
                <option value="">Select an active program</option>
                {programs.data?.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name} · v{p.version}</option>)}
            </NativeSelect>
            {programs.data?.length === 0 && <p role="alert">No ACTIVE programs are available. Configure a real program and its subjects in Training Programs.</p>}
            {selected && !matches && <p role="alert">Saved Program “{data.savedProgram}” does not match “{selected.code}”. Review the curriculum and explicitly correct Class Info first. No data has been changed.</p>}
            {data.programLink && !linkValid && <p role="alert">The saved program link is inactive or no longer matches Class Info. Review it before assigning a trainer.</p>}
            {link.isError && <p role="alert">{errorMessage(link.error)}</p>}
            <Button type="submit" disabled={!hasPermission("CLASS_UPDATE") || !selected || !matches || busy}>Save Program Link</Button>
        </form>
        <section className="space-y-3 rounded-md border p-4" aria-label="Program Subjects and assignments">
            <h3 className="font-semibold">Program Subjects</h3>
            {data.subjects.length ? <ul className="list-disc pl-5 text-sm">{data.subjects.map(s => <li key={s.id}>{s.code} — {s.name}{!s.eligible && " (inactive; cannot assign)"}</li>)}</ul>
                : <p className="text-sm">No linked program subjects. Save a valid program link first.</p>}
            <h3 className="font-semibold">MAIN Teaching Assignment</h3>
            {trainers.isPending ? <p role="status">Verifying Master Trainer directory…</p>
                : trainers.isError ? <div role="alert" className="space-y-2"><p>BLOCKED: Real Master Trainer directory could not be verified. {errorMessage(trainers.error)}</p><Button variant="outline" type="button" onClick={() => void trainers.refetch()}>Retry Trainer Directory</Button></div>
                : trainers.data?.length === 0 && <p role="alert">BLOCKED: The real directory returned no eligible active trainers.</p>}
            <p className="text-sm text-muted-foreground">Trainer must match Master Trainer in Class Info by directory name or email. MAIN dates must cover {data.startDate} through {data.endDate}. Saving uses server-side validation again.</p>
            {selectedTrainer && !matchesMaster && <p role="alert">Selected trainer does not match saved Master Trainer. Review Class Info explicitly; it will not be changed automatically.</p>}
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitAssignment}>
                <div className="space-y-1"><Label htmlFor={`setup-subject-${classId}`}>Program Subject</Label>
                    <NativeSelect id={`setup-subject-${classId}`} value={subjectId} onChange={e => setSubjectId(e.target.value)} required disabled={!linkValid || !canAssign || busy}>
                        <option value="">Select a program subject</option>{eligible.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                    </NativeSelect></div>
                <div className="space-y-1"><Label htmlFor={`setup-trainer-${classId}`}>Verified Trainer</Label>
                    <NativeSelect id={`setup-trainer-${classId}`} value={trainerId} onChange={e => setTrainerId(e.target.value)} required disabled={!canAssign || busy || trainers.isError || !trainers.data?.length}>
                        <option value="">Select a verified trainer</option>{trainers.data?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
                    </NativeSelect></div>
                <div className="space-y-1"><Label htmlFor={`setup-from-${classId}`}>Effective From</Label><Input id={`setup-from-${classId}`} type="date" value={from} onChange={e => setFrom(e.target.value)} required disabled={!canAssign || busy} /></div>
                <div className="space-y-1"><Label htmlFor={`setup-to-${classId}`}>Effective To (blank = open-ended)</Label><Input id={`setup-to-${classId}`} type="date" value={to} onChange={e => setTo(e.target.value)} disabled={!canAssign || busy} /></div>
                <p className="text-sm">Role: MAIN{editingId != null && ` · Editing assignment ${editingId}`}</p>
                <div className="flex gap-2"><Button type="submit" disabled={!canAssign || !linkValid || !subjectId || !trainerId || !matchesMaster || trainers.isError || !trainers.data?.length || busy}>{editingId == null ? "Create MAIN Assignment" : "Update MAIN Assignment"}</Button>
                    {editingId != null && <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditingId(null); setSubjectId(""); setTrainerId(""); setFrom(data.startDate); setTo(data.endDate); assignment.reset(); }}>Cancel Edit</Button>}</div>
            </form>
            {(validation || assignment.isError) && <p role="alert">{validation || errorMessage(assignment.error)}</p>}
            <ul className="space-y-2 text-sm" aria-label="Saved assignments">{data.assignments.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <span>{a.subjectCode} · {a.role} · Trainer ID {a.trainerId} · {a.effectiveFrom} – {a.effectiveTo || "Open-ended"}</span>
                {a.role === "MAIN" && hasPermission("ASSIGNMENT_UPDATE") && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => edit(a)}>Edit assignment {a.id}</Button>}
            </li>)}</ul>
        </section>
        {editingProfile && profile.data && <ClassModal open onOpenChange={setEditingProfile} classItem={profile.data} onSuccess={() => void refresh()} />}
    </div>;
}
