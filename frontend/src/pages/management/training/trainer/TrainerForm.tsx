import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { trainerApi, type Trainer, type TrainerInput } from "@/api/features/trainer.api";
import { describeApiError } from "@/utils/api-error.utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/common/NativeSelect";

export function TrainerForm({ trainer, close, saved }: { trainer?: Trainer; close: () => void; saved: () => Promise<void> }) {
    const [form, setForm] = useState<TrainerInput>({ trainerCode: trainer?.trainerCode ?? "", fullName: trainer?.fullName ?? "",
        email: trainer?.email ?? "", specialization: trainer?.specialization ?? "", status: trainer?.status ?? "ACTIVE",
        teachingTopicIds: trainer?.teachingTopics.map(t => t.id) ?? [] });
    const [busy, setBusy] = useState(false); const [error, setError] = useState("");
    const topics = useQuery({ queryKey: ["trainers", "topics"], queryFn: trainerApi.topics, retry: false });
    const available = [...(topics.data ?? []), ...(trainer?.teachingTopics.filter(t => !topics.data?.some(o => o.id === t.id)) ?? [])];
    const submit = async (event: FormEvent) => {
        event.preventDefault(); if (busy || !topics.data) return;
        setBusy(true); setError("");
        try {
            const input = { ...form, trainerCode: form.trainerCode.trim(), fullName: form.fullName.trim(), email: form.email.trim(), specialization: form.specialization.trim() };
            if (trainer) await trainerApi.update(trainer.id, input); else await trainerApi.create(input);
            await saved(); close();
        } catch (err) {
            const info = describeApiError(err); setError([info.message, ...Object.entries(info.fieldErrors).map(([field, errors]) => `${field}: ${errors.join(", ")}`)].join(" "));
        } finally { setBusy(false); }
    };
    return <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}><DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{trainer ? "Edit Trainer" : "Add Trainer"}</DialogTitle></DialogHeader>
        <form onSubmit={e => void submit(e)} className="space-y-4">
            {([ ["trainerCode", "Trainer ID", 50], ["fullName", "Full Name", 150], ["email", "Work Email", 254], ["specialization", "Specialization", 500] ] as const).map(([key, label, max]) =>
                <div className="space-y-1" key={key}><Label htmlFor={`trainer-${key}`}>{label}{key !== "specialization" ? " *" : ""}</Label>
                    <Input id={`trainer-${key}`} type={key === "email" ? "email" : "text"} maxLength={max} required={key !== "specialization"}
                        disabled={busy} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}
            <div className="space-y-1"><Label htmlFor="trainer-status">Status</Label><NativeSelect id="trainer-status" disabled={busy} value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as Trainer["status"] })}><option>ACTIVE</option><option>INACTIVE</option></NativeSelect></div>
            <div className="space-y-1"><Label htmlFor="trainer-topics">Teaching Topics</Label>
                <NativeSelect id="trainer-topics" multiple className="h-32" disabled={busy || topics.isPending || topics.isError}
                    value={form.teachingTopicIds.map(String)} onChange={e => setForm({ ...form, teachingTopicIds: Array.from(e.target.selectedOptions).map(o => Number(o.value)) })}>
                    {available.map(t => <option key={t.id} value={t.id}>{t.code}@{t.version} — {t.name}{!t.active ? " (inactive, saved)" : ""}</option>)}
                </NativeSelect><p className="text-xs text-muted-foreground">Select existing topics; use Ctrl/Cmd to select several.</p>
                {topics.isError && <p role="alert">{describeApiError(topics.error).message}</p>}</div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={close} disabled={busy}>Cancel</Button>
                <Button type="submit" disabled={busy || !topics.data}>{busy ? "Saving…" : "Save Trainer"}</Button></DialogFooter>
        </form></DialogContent></Dialog>;
}
