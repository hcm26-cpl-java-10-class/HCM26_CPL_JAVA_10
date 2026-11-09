import { AlertTriangle, Loader2 } from "lucide-react";
import { useId, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { sessionApi } from "@/api/features/demo/session.api";
import { NativeSelect } from "@/components/common/NativeSelect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAssignableTrainers, useExternalRooms } from "@/hooks/useExternalLookups";
import { useClasses } from "@/hooks/useClasses";
import type { SessionCancelDTO, SessionDTO, SessionDuplicateDTO, SessionRescheduleDTO } from "@/types";
import { describeApiError } from "@/utils/api-error.utils";
import { classTitle } from "@/utils/class.utils";
import {
    formatDate,
    formatTime,
    formatWeekday,
    joinLocalDateTime,
    splitLocalDateTime,
    validateSlot,
    type SlotErrors,
} from "@/utils/session.utils";
import type { SessionAction, SessionActionController } from "./session-actions";
import {
    buildCreatePayload,
    buildInitialValues,
    buildUpdatePayload,
    CANCEL_REASON_MAX,
    LOCATION_MAX,
    mapServerFieldErrors,
    TITLE_MAX,
    validateSessionForm,
    type SessionFormErrors,
    type SessionFormField,
    type SessionFormMode,
    type SessionFormValues,
} from "./session-form";
import { useSessionMutation } from "./useSessionMutation";

/* ───────────────────────────── shared building blocks ───────────────────────────── */

function idOf(session: SessionDTO): number {
    if (session.id == null) {
        throw new Error("The session has no id");
    }
    return session.id;
}

const describedBy = (id: string, error?: string) => ({
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
});

function FormField({
    id,
    label,
    required,
    error,
    hint,
    children,
}: {
    id: string;
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id}>
                {label}
                {required ? (
                    <span aria-hidden className="text-destructive">
                        *
                    </span>
                ) : null}
            </Label>
            {children}
            {error ? (
                <p id={`${id}-error`} className="text-xs text-destructive">
                    {error}
                </p>
            ) : hint ? (
                <p className="text-xs text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}

function ErrorBanner({ title, message }: { title: string; message: string | null }) {
    if (!message) return null;

    return (
        <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
}

function DialogFrame({
    title,
    description,
    pending,
    onClose,
    children,
}: {
    title: string;
    description: ReactNode;
    pending: boolean;
    onClose: () => void;
    children: ReactNode;
}) {
    return (
        <Dialog
            open
            onOpenChange={(next) => {
                // a request in flight must not be orphaned by closing the dialog
                if (!next && !pending) onClose();
            }}
        >
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}

function SubmitButton({ pending, idleLabel, pendingLabel, variant }: { pending: boolean; idleLabel: string; pendingLabel: string; variant?: "default" | "destructive" }) {
    return (
        <Button type="submit" variant={variant} disabled={pending}>
            {pending ? (
                <>
                    <Loader2 className="animate-spin" /> {pendingLabel}
                </>
            ) : (
                idleLabel
            )}
        </Button>
    );
}

type SlotField = "date" | "start" | "end";

function SlotFields({
    idPrefix,
    values,
    errors,
    onChange,
    dateLabel = "Date",
}: {
    idPrefix: string;
    values: Record<SlotField, string>;
    errors: SlotErrors;
    onChange: (field: SlotField, value: string) => void;
    dateLabel?: string;
}) {
    const bind = (field: SlotField) => ({
        id: `${idPrefix}-${field}`,
        value: values[field],
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(field, event.target.value),
        ...describedBy(`${idPrefix}-${field}`, errors[field]),
    });

    return (
        <div className="grid gap-4 sm:grid-cols-3">
            <FormField id={`${idPrefix}-date`} label={dateLabel} required error={errors.date}>
                <Input type="date" {...bind("date")} />
            </FormField>
            <FormField id={`${idPrefix}-start`} label="Start time" required error={errors.start}>
                <Input type="time" {...bind("start")} />
            </FormField>
            <FormField id={`${idPrefix}-end`} label="End time" required error={errors.end}>
                <Input type="time" {...bind("end")} />
            </FormField>
        </div>
    );
}

function RoomField({
    id,
    value,
    onChange,
    error,
    hint,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    hint?: string;
}) {
    const rooms = useExternalRooms();
    const listId = `${id}-rooms`;

    return (
        <FormField id={id} label="Room" error={error} hint={hint}>
            <Input
                id={id}
                list={listId}
                value={value}
                maxLength={LOCATION_MAX}
                placeholder="e.g. Room 101"
                onChange={(event) => onChange(event.target.value)}
                {...describedBy(id, error)}
            />
            <datalist id={listId}>
                {(rooms.data ?? []).map((room) => (
                    <option key={room.id} value={room.name ?? ""} />
                ))}
            </datalist>
        </FormField>
    );
}

interface SlotValues extends Record<SlotField, string> {
    location: string;
}

function toSlotValues(session: SessionDTO): SlotValues {
    const start = splitLocalDateTime(session.startTime);
    const end = splitLocalDateTime(session.endTime);

    return { date: start.date, start: start.time, end: end.time, location: session.location ?? "" };
}

function describeSlot(session: SessionDTO): string {
    const date = `${formatDate(session.startTime)} (${formatWeekday(session.startTime)})`;
    const room = session.location ? ` · ${session.location}` : "";
    return `${date} ${formatTime(session.startTime)} – ${formatTime(session.endTime)}${room}`;
}

/* ───────────────────────────── create / edit ───────────────────────────── */

type FormAction = Extract<SessionAction, { type: "create" | "edit" }>;

function SessionFormDialog({ action, onClose }: { action: FormAction; onClose: () => void }) {
    const id = useId();
    const mode: SessionFormMode = action.type;
    const session = action.type === "edit" ? action.session : undefined;
    const lockedClassId = action.type === "create" ? action.classId : undefined;
    const classIsPickable = mode === "create" && lockedClassId == null;

    const [initial] = useState(() => buildInitialValues(session, lockedClassId));
    const [values, setValues] = useState<SessionFormValues>(initial);
    const [errors, setErrors] = useState<SessionFormErrors>({});
    const [formError, setFormError] = useState<string | null>(null);

    const trainers = useAssignableTrainers();
    const classes = useClasses({ enabled: classIsPickable });
    const currentClass = useClasses({ classId: values.classId, enabled: !!values.classId });

    const mutation = useSessionMutation<SessionDTO>({
        mutationFn: (payload) => (session ? sessionApi.update(String(idOf(session)), payload) : sessionApi.create(payload)),
        successMessage: (saved) => (mode === "create" ? `Session "${saved.title}" created` : `Session "${saved.title}" updated`),
        onSuccess: onClose,
    });

    const setField = (field: SessionFormField, value: string) => {
        setValues((previous) => ({ ...previous, [field]: value }));
        setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
    };

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (mutation.isPending) return;

        const found = validateSessionForm(values, mode);
        setErrors(found);
        setFormError(null);
        if (Object.keys(found).length > 0) return;

        mutation.mutate(mode === "create" ? buildCreatePayload(values) : buildUpdatePayload(values, initial), {
            onError: (error) => {
                const info = describeApiError(error);
                setErrors(mapServerFieldErrors(info.fieldErrors));
                setFormError(info.message);
            },
        });
    };

    const classText = currentClass.data
        ? `${classTitle(currentClass.data)}${currentClass.data.code && currentClass.data.name ? ` · ${currentClass.data.name}` : ""}`
        : values.classId
          ? `Class #${values.classId}`
          : "";

    const trainerOptions = (() => {
        const options = (trainers.data ?? [])
            .map((trainer) => ({
                id: trainer.id,
                label: `${trainer.name || `Trainer #${trainer.id}`}${trainer.email ? ` (${trainer.email})` : ""}`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        const currentId = session?.trainerId;
        if (currentId != null && !options.some((option) => option.id === currentId)) {
            // keep the saved trainer selectable (and visible) even when they are no longer active
            options.unshift({ id: currentId, label: `Trainer #${currentId}${trainers.data ? " (not active)" : ""}` });
        }

        return options;
    })();

    const sortedClasses = [...(classes.data ?? [])].sort((a, b) =>
        classTitle(a).localeCompare(classTitle(b), undefined, { numeric: true }),
    );

    return (
        <DialogFrame
            title={mode === "create" ? "Create session" : "Edit session"}
            description={
                mode === "create"
                    ? "Class and topic are fixed once the session is created."
                    : "Class and topic cannot be changed. To move the session to another day use Reschedule."
            }
            pending={mutation.isPending}
            onClose={onClose}
        >
            <form onSubmit={submit} noValidate className="grid gap-4">
                <ErrorBanner title="Could not save the session" message={formError} />

                <FormField
                    id={`${id}-class`}
                    label="Class"
                    required={classIsPickable}
                    error={errors.classId}
                    hint={lockedClassId != null ? "The class is fixed by the page you started from." : undefined}
                >
                    {classIsPickable ? (
                        <NativeSelect
                            id={`${id}-class`}
                            value={values.classId}
                            onChange={(event) => setField("classId", event.target.value)}
                            {...describedBy(`${id}-class`, errors.classId)}
                        >
                            <option value="">{classes.isPending ? "Loading classes…" : "Select a class"}</option>
                            {sortedClasses.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {classTitle(item)}
                                    {item.code && item.name ? ` · ${item.name}` : ""}
                                </option>
                            ))}
                        </NativeSelect>
                    ) : (
                        <Input id={`${id}-class`} value={classText} readOnly />
                    )}
                    {classIsPickable && classes.isError ? (
                        <p className="text-xs text-destructive">
                            {describeApiError(classes.error).message}{" "}
                            <button type="button" className="underline" onClick={() => void classes.refetch()}>
                                Retry
                            </button>
                        </p>
                    ) : null}
                </FormField>

                <FormField id={`${id}-title`} label="Session title" required error={errors.title}>
                    <Input
                        id={`${id}-title`}
                        value={values.title}
                        maxLength={TITLE_MAX}
                        placeholder="e.g. Introduction to Spring Boot"
                        onChange={(event) => setField("title", event.target.value)}
                        {...describedBy(`${id}-title`, errors.title)}
                    />
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        id={`${id}-topic`}
                        label="Topic ID"
                        required={mode === "create"}
                        error={errors.topicId}
                        hint={mode === "create" ? "Topics are managed separately, so enter the numeric Topic ID." : undefined}
                    >
                        <Input
                            id={`${id}-topic`}
                            inputMode="numeric"
                            value={values.topicId}
                            readOnly={mode === "edit"}
                            onChange={(event) => setField("topicId", event.target.value)}
                            {...describedBy(`${id}-topic`, errors.topicId)}
                        />
                    </FormField>

                    <FormField id={`${id}-trainer`} label="Trainer" required error={errors.trainerId}>
                        <NativeSelect
                            id={`${id}-trainer`}
                            value={values.trainerId}
                            onChange={(event) => setField("trainerId", event.target.value)}
                            {...describedBy(`${id}-trainer`, errors.trainerId)}
                        >
                            <option value="">{trainers.isPending ? "Loading trainers…" : "Select a trainer"}</option>
                            {trainerOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </NativeSelect>
                        {trainers.isError ? (
                            <p className="text-xs text-destructive">
                                {describeApiError(trainers.error).message}{" "}
                                <button type="button" className="underline" onClick={() => void trainers.refetch()}>
                                    Retry
                                </button>
                            </p>
                        ) : null}
                    </FormField>
                </div>

                <SlotFields
                    idPrefix={id}
                    values={values}
                    errors={errors}
                    onChange={(field, value) => setField(field, value)}
                />

                <RoomField
                    id={`${id}-room`}
                    value={values.location}
                    onChange={(value) => setField("location", value)}
                    error={errors.location}
                />

                <FormField id={`${id}-note`} label="Note">
                    <Textarea
                        id={`${id}-note`}
                        value={values.note}
                        onChange={(event) => setField("note", event.target.value)}
                    />
                </FormField>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                        Close
                    </Button>
                    <SubmitButton
                        pending={mutation.isPending}
                        idleLabel={mode === "create" ? "Create session" : "Save changes"}
                        pendingLabel="Saving…"
                    />
                </DialogFooter>
            </form>
        </DialogFrame>
    );
}

/* ───────────────────────── reschedule / duplicate ───────────────────────── */

type SlotAction = Extract<SessionAction, { type: "reschedule" | "duplicate" }>;

function SlotDialog({ action, onClose }: { action: SlotAction; onClose: () => void }) {
    const id = useId();
    const { session } = action;
    const isDuplicate = action.type === "duplicate";

    const [initial] = useState<SlotValues>(() => {
        const slot = toSlotValues(session);
        // a copy needs a conscious new date: keeping the source date would collide with the source itself
        return isDuplicate ? { ...slot, date: "" } : slot;
    });
    const [values, setValues] = useState<SlotValues>(initial);
    const [errors, setErrors] = useState<SlotErrors>({});
    const [formError, setFormError] = useState<string | null>(null);

    const mutation = useSessionMutation<SessionRescheduleDTO | SessionDuplicateDTO>({
        mutationFn: (payload) =>
            isDuplicate
                ? sessionApi.duplicateSession(idOf(session), payload)
                : sessionApi.rescheduleSession(idOf(session), payload),
        successMessage: (saved) =>
            isDuplicate ? `Session duplicated as new session #${saved.id}` : `Session "${saved.title}" rescheduled`,
        onSuccess: onClose,
    });

    const setField = (field: keyof SlotValues, value: string) => {
        setValues((previous) => ({ ...previous, [field]: value }));
        if (field !== "location") {
            setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
        }
    };

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (mutation.isPending) return;

        const found = validateSlot(values);
        setErrors(found);
        setFormError(null);
        if (Object.keys(found).length > 0) return;

        const unchanged =
            !isDuplicate &&
            values.date === initial.date &&
            values.start === initial.start &&
            values.end === initial.end &&
            values.location.trim() === initial.location.trim();
        if (unchanged) {
            setFormError("The new slot is the same as the current one. Change the date, the times or the room first.");
            return;
        }

        mutation.mutate(
            {
                startTime: joinLocalDateTime(values.date, values.start),
                endTime: joinLocalDateTime(values.date, values.end),
                // always sent: an empty room is a deliberate "no room", not "keep the old one"
                location: values.location.trim(),
            },
            {
                onError: (error) => {
                    const info = describeApiError(error);
                    const mapped = mapServerFieldErrors(info.fieldErrors);
                    setErrors({ date: mapped.date, start: mapped.start, end: mapped.end });
                    setFormError(info.message);
                },
            },
        );
    };

    return (
        <DialogFrame
            title={isDuplicate ? "Duplicate session" : "Reschedule session"}
            description={
                isDuplicate
                    ? "Creates a new scheduled session with the same class, topic, trainer, title and note. The original is not changed."
                    : "Moves this session to a new slot. Class, topic, trainer and title stay the same."
            }
            pending={mutation.isPending}
            onClose={onClose}
        >
            <form onSubmit={submit} noValidate className="grid gap-4">
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <p className="font-medium">{session.title}</p>
                    <p className="text-muted-foreground">
                        {isDuplicate ? "Copying from" : "Current slot"}: {describeSlot(session)}
                    </p>
                </div>

                <ErrorBanner title={isDuplicate ? "Could not duplicate the session" : "Could not reschedule the session"} message={formError} />

                <SlotFields
                    idPrefix={id}
                    values={values}
                    errors={errors}
                    onChange={(field, value) => setField(field, value)}
                    dateLabel="New date"
                />

                <RoomField
                    id={`${id}-room`}
                    value={values.location}
                    onChange={(value) => setField("location", value)}
                    hint="Leave empty for no room."
                />

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                        Close
                    </Button>
                    <SubmitButton
                        pending={mutation.isPending}
                        idleLabel={isDuplicate ? "Duplicate session" : "Reschedule"}
                        pendingLabel={isDuplicate ? "Duplicating…" : "Rescheduling…"}
                    />
                </DialogFooter>
            </form>
        </DialogFrame>
    );
}

/* ───────────────────────────── complete / cancel ───────────────────────────── */

function CompleteDialog({ session, onClose }: { session: SessionDTO; onClose: () => void }) {
    const [formError, setFormError] = useState<string | null>(null);

    const mutation = useSessionMutation<void>({
        mutationFn: () => sessionApi.completeSession(idOf(session)),
        successMessage: `Session "${session.title}" marked as completed`,
        onSuccess: onClose,
    });

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (mutation.isPending) return;

        setFormError(null);
        mutation.mutate(undefined, { onError: (error) => setFormError(describeApiError(error).message) });
    };

    return (
        <DialogFrame
            title="Mark session as completed"
            description={`"${session.title}" · ${describeSlot(session)}`}
            pending={mutation.isPending}
            onClose={onClose}
        >
            <form onSubmit={submit} className="grid gap-4">
                <p className="text-sm text-muted-foreground">
                    A completed session can no longer be edited, rescheduled or cancelled. This cannot be undone.
                </p>
                <ErrorBanner title="Could not complete the session" message={formError} />
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                        Close
                    </Button>
                    <SubmitButton pending={mutation.isPending} idleLabel="Mark as completed" pendingLabel="Saving…" />
                </DialogFooter>
            </form>
        </DialogFrame>
    );
}

function CancelDialog({ session, onClose }: { session: SessionDTO; onClose: () => void }) {
    const id = useId();
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string | undefined>();
    const [formError, setFormError] = useState<string | null>(null);

    const mutation = useSessionMutation<SessionCancelDTO>({
        mutationFn: (payload) => sessionApi.cancelSession(idOf(session), payload),
        successMessage: `Session "${session.title}" cancelled`,
        onSuccess: onClose,
    });

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (mutation.isPending) return;

        const trimmed = reason.trim();
        setFormError(null);

        if (!trimmed) {
            setError("A cancel reason is required");
            return;
        }
        if (trimmed.length > CANCEL_REASON_MAX) {
            setError(`The reason must not exceed ${CANCEL_REASON_MAX} characters`);
            return;
        }

        setError(undefined);
        mutation.mutate(
            { cancelReason: trimmed },
            {
                onError: (requestError) => {
                    const info = describeApiError(requestError);
                    setError(info.fieldErrors.cancelReason?.[0]);
                    setFormError(info.message);
                },
            },
        );
    };

    return (
        <DialogFrame
            title="Cancel session"
            description={`"${session.title}" · ${describeSlot(session)}`}
            pending={mutation.isPending}
            onClose={onClose}
        >
            <form onSubmit={submit} noValidate className="grid gap-4">
                <ErrorBanner title="Could not cancel the session" message={formError} />
                <FormField
                    id={`${id}-reason`}
                    label="Reason"
                    required
                    error={error}
                    hint={`${reason.trim().length}/${CANCEL_REASON_MAX} · The session stays in the list as cancelled and frees its slot.`}
                >
                    <Textarea
                        id={`${id}-reason`}
                        value={reason}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setError(undefined);
                        }}
                        {...describedBy(`${id}-reason`, error)}
                    />
                </FormField>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                        Keep session
                    </Button>
                    <SubmitButton pending={mutation.isPending} idleLabel="Cancel session" pendingLabel="Cancelling…" variant="destructive" />
                </DialogFooter>
            </form>
        </DialogFrame>
    );
}

/* ───────────────────────────── entry point ───────────────────────────── */

/** Renders whichever session dialog the controller has open. Mount it once per page that lists sessions. */
export function SessionDialogs({ controller }: { controller: SessionActionController }) {
    const { action, close } = controller;

    if (!action) return null;

    switch (action.type) {
        case "create":
            return <SessionFormDialog key="create" action={action} onClose={close} />;
        case "edit":
            return <SessionFormDialog key={`edit-${action.session.id}`} action={action} onClose={close} />;
        case "reschedule":
        case "duplicate":
            return <SlotDialog key={`${action.type}-${action.session.id}`} action={action} onClose={close} />;
        case "complete":
            return <CompleteDialog key={`complete-${action.session.id}`} session={action.session} onClose={close} />;
        case "cancel":
            return <CancelDialog key={`cancel-${action.session.id}`} session={action.session} onClose={close} />;
    }
}
