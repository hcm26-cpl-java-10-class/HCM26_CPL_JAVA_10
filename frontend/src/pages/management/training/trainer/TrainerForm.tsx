import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { trainerApi, type Trainer, type TrainerInput } from "@/api/features/trainer.api";
import { describeApiError } from "@/utils/api-error.utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/common/NativeSelect";

const MAX_CODE_LENGTH = 20;
const MAX_FULL_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 100;
const MAX_SPECIALIZATION_LENGTH = 200;

// Escaped hyphen for HTML pattern v-flag compatibility; matches backend Trainer.CODE_REGEX.
const TRAINER_CODE_HTML_PATTERN = "[A-Za-z0-9][A-Za-z0-9_\\-]{0,19}";
const TRAINER_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/;
// Matches backend Trainer.EMAIL_REGEX: requires a domain with at least one dot (rejects e.g. review@localhost).
const WORK_EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function TrainerForm({ trainer, close, saved }: { trainer?: Trainer; close: () => void; saved: () => Promise<void> }) {
    const [form, setForm] = useState<TrainerInput>({
        trainerCode: trainer?.trainerCode ?? "",
        fullName: trainer?.fullName ?? "",
        email: trainer?.email ?? "",
        specialization: trainer?.specialization ?? "",
        status: trainer?.status ?? "ACTIVE",
        teachingTopicIds: trainer?.teachingTopics.map(t => t.id) ?? [],
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const topics = useQuery({ queryKey: ["trainers", "topics"], queryFn: trainerApi.topics, retry: false });
    const available = [
        ...(topics.data ?? []),
        ...(trainer?.teachingTopics.filter(t => !topics.data?.some(o => o.id === t.id)) ?? []),
    ];

    const overLimitMessages = {
        trainerCode: form.trainerCode.trim().length > MAX_CODE_LENGTH
            ? `Code exceeds the ${MAX_CODE_LENGTH}-character limit (${form.trainerCode.trim().length}/${MAX_CODE_LENGTH}). Shorten it before saving.`
            : "",
        fullName: form.fullName.trim().length > MAX_FULL_NAME_LENGTH
            ? `Full Name exceeds the ${MAX_FULL_NAME_LENGTH}-character limit (${form.fullName.trim().length}/${MAX_FULL_NAME_LENGTH}). Shorten it before saving.`
            : "",
        email: form.email.trim().length > MAX_EMAIL_LENGTH
            ? `Work Email exceeds the ${MAX_EMAIL_LENGTH}-character limit (${form.email.trim().length}/${MAX_EMAIL_LENGTH}). Shorten it before saving.`
            : "",
        specialization: form.specialization.trim().length > MAX_SPECIALIZATION_LENGTH
            ? `Specialization exceeds the ${MAX_SPECIALIZATION_LENGTH}-character limit (${form.specialization.trim().length}/${MAX_SPECIALIZATION_LENGTH}). Shorten it before saving.`
            : "",
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (busy || !topics.data) return;

        const input = {
            ...form,
            trainerCode: form.trainerCode.trim(),
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            specialization: form.specialization.trim(),
        };

        const validationErrors: string[] = [];
        if (!input.trainerCode) {
            validationErrors.push("Code is required.");
        } else if (input.trainerCode.length > MAX_CODE_LENGTH) {
            validationErrors.push(`Code must not exceed ${MAX_CODE_LENGTH} characters.`);
        } else if (!TRAINER_CODE_REGEX.test(input.trainerCode)) {
            validationErrors.push("Code must start with a letter or digit and use only letters, digits, '_' or '-'.");
        }
        if (!input.fullName) {
            validationErrors.push("Full Name is required.");
        } else if (input.fullName.length > MAX_FULL_NAME_LENGTH) {
            validationErrors.push(`Full Name must not exceed ${MAX_FULL_NAME_LENGTH} characters.`);
        }
        if (!input.email) {
            validationErrors.push("Work Email is required.");
        } else if (input.email.length > MAX_EMAIL_LENGTH) {
            validationErrors.push(`Work Email must not exceed ${MAX_EMAIL_LENGTH} characters.`);
        } else if (!WORK_EMAIL_REGEX.test(input.email)) {
            validationErrors.push("Work Email must be a valid email address (e.g. trainer@example.com).");
        }
        if (input.specialization.length > MAX_SPECIALIZATION_LENGTH) {
            validationErrors.push(`Specialization must not exceed ${MAX_SPECIALIZATION_LENGTH} characters.`);
        }

        if (validationErrors.length > 0) {
            setError(validationErrors.join(" "));
            return;
        }

        setBusy(true);
        setError("");
        try {
            if (trainer) await trainerApi.update(trainer.id, input);
            else await trainerApi.create(input);
            await saved();
            close();
        } catch (err) {
            const info = describeApiError(err);
            setError([
                info.message,
                ...Object.entries(info.fieldErrors).map(([field, errors]) => `${field}: ${errors.join(", ")}`),
            ].join(" "));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto p-5">
                <DialogHeader>
                    <DialogTitle>{trainer ? "Edit Trainer" : "Add Trainer"}</DialogTitle>
                    <DialogDescription className="text-xs">
                        Enter trainer profile information and assign eligible subjects.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={e => void submit(e)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="trainer-trainerCode">Code *</Label>
                                <span className={`text-[11px] ${overLimitMessages.trainerCode ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                    {form.trainerCode.length}/{MAX_CODE_LENGTH}
                                </span>
                            </div>
                            <Input
                                id="trainer-trainerCode"
                                type="text"
                                maxLength={form.trainerCode.length > MAX_CODE_LENGTH ? undefined : MAX_CODE_LENGTH}
                                pattern={TRAINER_CODE_HTML_PATTERN}
                                title="Start with a letter or number; use only letters, numbers, underscores or hyphens (max 20 characters)"
                                aria-invalid={Boolean(overLimitMessages.trainerCode)}
                                required
                                disabled={busy}
                                placeholder="e.g. TR_01"
                                value={form.trainerCode}
                                onChange={e => setForm({ ...form, trainerCode: e.target.value })}
                            />
                            {overLimitMessages.trainerCode && (
                                <p role="alert" className="text-xs text-destructive">{overLimitMessages.trainerCode}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="trainer-fullName">Full Name *</Label>
                                <span className={`text-[11px] ${overLimitMessages.fullName ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                    {form.fullName.length}/{MAX_FULL_NAME_LENGTH}
                                </span>
                            </div>
                            <Input
                                id="trainer-fullName"
                                type="text"
                                maxLength={form.fullName.length > MAX_FULL_NAME_LENGTH ? undefined : MAX_FULL_NAME_LENGTH}
                                aria-invalid={Boolean(overLimitMessages.fullName)}
                                required
                                disabled={busy}
                                placeholder="e.g. Nguyễn Văn A"
                                value={form.fullName}
                                onChange={e => setForm({ ...form, fullName: e.target.value })}
                            />
                            {overLimitMessages.fullName && (
                                <p role="alert" className="text-xs text-destructive">{overLimitMessages.fullName}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="trainer-email">Work Email *</Label>
                                <span className={`text-[11px] ${overLimitMessages.email ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                    {form.email.length}/{MAX_EMAIL_LENGTH}
                                </span>
                            </div>
                            <Input
                                id="trainer-email"
                                type="email"
                                maxLength={form.email.length > MAX_EMAIL_LENGTH ? undefined : MAX_EMAIL_LENGTH}
                                aria-invalid={Boolean(overLimitMessages.email)}
                                required
                                disabled={busy}
                                placeholder="trainer@example.com"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                            />
                            {overLimitMessages.email && (
                                <p role="alert" className="text-xs text-destructive">{overLimitMessages.email}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="trainer-status">Status</Label>
                            <NativeSelect
                                id="trainer-status"
                                disabled={busy}
                                value={form.status}
                                onChange={e => setForm({ ...form, status: e.target.value as Trainer["status"] })}
                            >
                                <option>ACTIVE</option>
                                <option>INACTIVE</option>
                            </NativeSelect>
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                            <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="trainer-specialization">Specialization</Label>
                                <span className={`text-[11px] ${overLimitMessages.specialization ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                    {form.specialization.length}/{MAX_SPECIALIZATION_LENGTH}
                                </span>
                            </div>
                            <Input
                                id="trainer-specialization"
                                type="text"
                                maxLength={form.specialization.length > MAX_SPECIALIZATION_LENGTH ? undefined : MAX_SPECIALIZATION_LENGTH}
                                aria-invalid={Boolean(overLimitMessages.specialization)}
                                disabled={busy}
                                placeholder="e.g. Java Core, Spring Boot, SQL"
                                value={form.specialization}
                                onChange={e => setForm({ ...form, specialization: e.target.value })}
                            />
                            {overLimitMessages.specialization && (
                                <p role="alert" className="text-xs text-destructive">{overLimitMessages.specialization}</p>
                            )}
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                            <div className="flex items-center justify-between gap-2">
                                <Label id="trainer-topics-label">Subjects</Label>
                                <span className="text-xs text-muted-foreground">
                                    {form.teachingTopicIds.length} selected
                                </span>
                            </div>
                            <div
                                role="group"
                                aria-labelledby="trainer-topics-label"
                                className="max-h-36 overflow-y-auto rounded-md border border-input bg-background p-1.5 space-y-1"
                            >
                                {topics.isPending ? (
                                    <p className="px-2 py-3 text-xs text-muted-foreground">Loading subjects…</p>
                                ) : available.length === 0 ? (
                                    <p className="px-2 py-3 text-xs text-muted-foreground">No active subjects available.</p>
                                ) : (
                                    available.map(t => {
                                        const checked = form.teachingTopicIds.includes(t.id);
                                        const toggle = () => {
                                            setForm(prev => ({
                                                ...prev,
                                                teachingTopicIds: checked
                                                    ? prev.teachingTopicIds.filter(id => id !== t.id)
                                                    : [...prev.teachingTopicIds, t.id],
                                            }));
                                        };
                                        return (
                                            <label
                                                key={t.id}
                                                className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                                                    busy || topics.isError
                                                        ? "cursor-not-allowed opacity-60"
                                                        : "cursor-pointer hover:bg-muted/60"
                                                } ${checked ? "bg-primary/10 text-foreground font-medium" : "text-foreground/90"}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-input accent-primary shrink-0"
                                                    checked={checked}
                                                    disabled={busy || topics.isError}
                                                    onChange={toggle}
                                                />
                                                <span className="truncate">
                                                    {t.code}@{t.version} — {t.name}{!t.active ? " (inactive, saved)" : ""}
                                                </span>
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Click any subject to select or unselect multiple subjects.
                            </p>
                            {topics.isError && (
                                <p role="alert" className="text-xs text-destructive">
                                    {describeApiError(topics.error).message}
                                </p>
                            )}
                        </div>
                    </div>

                    {error && (
                        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            {error}
                        </p>
                    )}

                    <DialogFooter className="border-t pt-3 gap-2">
                        <Button type="button" variant="outline" onClick={close} disabled={busy}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={busy || !topics.data}>
                            {busy ? "Saving…" : "Save Trainer"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
