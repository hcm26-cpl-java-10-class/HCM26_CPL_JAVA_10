import { scheduleValidationApi } from "@/api/features/schedule-validation.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { PermissionGate } from "@/components/PermissionGate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
    ScheduleConflictIssue,
    ScheduleValidationCandidate,
    ScheduleValidationResponse,
} from "@/types/features/schedule-validation";
import axios from "axios";
import {
    AlertCircle,
    CalendarClock,
    CheckCircle2,
    LoaderCircle,
    Plus,
    Trash2,
} from "lucide-react";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

type CandidateDraft = {
    candidateKey: string;
    sessionId: string;
    classId: string;
    trainerId: string;
    startAt: string;
    endAt: string;
    roomId: string;
    location: string;
    meetingUrl: string;
};

const ERROR_MESSAGES: Record<string, string> = {
    DUPLICATE_CANDIDATE_KEY: "Candidate keys must be unique in this request.",
    INVALID_TIME: "The end time must be later than the start time.",
    LOCATION_REQUIRED: "Choose a room or provide a meeting URL.",
    TRAINER_INACTIVE: "The trainer does not exist or is not active.",
    CLASS_NOT_FOUND: "The class could not be found.",
    CLASS_INACTIVE: "The class is not active.",
    OUTSIDE_CLASS_RANGE: "The session is outside the class date range.",
    CLASS_DATE_INVALID: "The class start or end date has an invalid format.",
    SESSION_NOT_FOUND: "The session to update could not be found.",
    SESSION_MISMATCH: "The session to update does not belong to this class.",
    SESSION_NOT_EDITABLE: "Only scheduled sessions can be validated for an update.",
    ROOM_NOT_FOUND: "The selected room could not be found.",
    CLASS_CONFLICT: "This class already has another session during this time.",
    TRAINER_CONFLICT: "This trainer is already scheduled during this time.",
    ROOM_CONFLICT: "This room is already booked during this time.",
    BATCH_CONFLICT: "This candidate overlaps another candidate in the same request.",
};

const FIELD_LABELS: Record<string, string> = {
    candidateKey: "Candidate key",
    sessionId: "Session",
    classId: "Class",
    trainerId: "Trainer",
    startAt: "Start time",
    endAt: "End time",
    roomId: "Room",
    location: "Location",
    meetingUrl: "Meeting URL",
};

function createCandidate(index: number): CandidateDraft {
    return {
        candidateKey: `candidate-${index}`,
        sessionId: "",
        classId: "",
        trainerId: "",
        startAt: "",
        endAt: "",
        roomId: "",
        location: "",
        meetingUrl: "",
    };
}

function toPayload(candidate: CandidateDraft): ScheduleValidationCandidate {
    return {
        candidateKey: candidate.candidateKey.trim(),
        ...(candidate.sessionId ? { sessionId: Number(candidate.sessionId) } : {}),
        classId: Number(candidate.classId),
        trainerId: Number(candidate.trainerId),
        startAt: candidate.startAt,
        endAt: candidate.endAt,
        ...(candidate.roomId ? { roomId: Number(candidate.roomId) } : {}),
        ...(candidate.location.trim() ? { location: candidate.location.trim() } : {}),
        ...(candidate.meetingUrl.trim() ? { meetingUrl: candidate.meetingUrl.trim() } : {}),
    };
}

function getRequestError(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: unknown } | undefined;
        if (typeof data?.message === "string" && data.message.trim()) {
            return data.message;
        }
        if (error.response?.status === 403) {
            return "You do not have permission to validate schedules.";
        }
        if (error.response?.status === 401) {
            return "Your session has expired. Please sign in again.";
        }
        if (!error.response) {
            return "Could not connect to the server. Check your connection and try again.";
        }
    }
    return "Schedule validation failed. Please review the request and try again.";
}

function getIssueMessage(issue: ScheduleConflictIssue): string {
    return ERROR_MESSAGES[issue.code] ?? issue.message ?? "The candidate could not be validated.";
}

function Field({
    id,
    label,
    required,
    children,
}: {
    id: string;
    label: string;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>
                {label}
                {required && <span className="ml-1 text-destructive">*</span>}
            </Label>
            {children}
        </div>
    );
}

function CandidateIssues({
    issues,
    candidateKey,
}: {
    issues: ScheduleConflictIssue[];
    candidateKey: string;
}) {
    const candidateIssues = issues.filter((issue) => issue.candidateKey === candidateKey);
    if (candidateIssues.length === 0) return null;

    return (
        <div className="mt-5 space-y-2" aria-live="polite">
            {candidateIssues.map((issue, index) => (
                <div
                    key={`${issue.code}-${issue.field}-${index}`}
                    className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="font-medium text-destructive">
                            {issue.field ? `${FIELD_LABELS[issue.field] ?? issue.field}: ` : ""}
                            {getIssueMessage(issue)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {issue.code}
                            {issue.conflictSessionId != null && ` · Conflicting session #${issue.conflictSessionId}`}
                            {issue.conflictCandidateKey && ` · Conflicts with ${issue.conflictCandidateKey}`}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function ScheduleValidationContent() {
    const [versionId, setVersionId] = useState("");
    const [candidates, setCandidates] = useState<CandidateDraft[]>([createCandidate(1)]);
    const [result, setResult] = useState<ScheduleValidationResponse | null>(null);
    const [requestError, setRequestError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const nextCandidateNumber = useRef(2);

    const issuesByCandidate = useMemo(
        () => result?.issues.filter((issue) => !issue.candidateKey) ?? [],
        [result],
    );

    const updateCandidate = (index: number, field: keyof CandidateDraft, value: string) => {
        setCandidates((current) => current.map((candidate, candidateIndex) => (
            candidateIndex === index ? { ...candidate, [field]: value } : candidate
        )));
        setResult(null);
        setRequestError("");
    };

    const addCandidate = () => {
        if (candidates.length >= 100) return;
        setCandidates((current) => [...current, createCandidate(nextCandidateNumber.current++)]);
        setResult(null);
        setRequestError("");
    };

    const removeCandidate = (index: number) => {
        if (candidates.length <= 1) return;
        setCandidates((current) => current.filter((_, candidateIndex) => candidateIndex !== index));
        setResult(null);
        setRequestError("");
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const parsedVersionId = Number(versionId);
        if (!Number.isInteger(parsedVersionId) || parsedVersionId <= 0) {
            setRequestError("Enter a valid positive schedule version ID.");
            return;
        }

        setIsSubmitting(true);
        setResult(null);
        setRequestError("");
        try {
            const response = await scheduleValidationApi.validate(parsedVersionId, {
                sessions: candidates.map(toPayload),
            });
            setResult(response);
        } catch (error) {
            setRequestError(getRequestError(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <MainLayout pathName={{ "schedule-validation": "Schedule Validation" }}>
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <CalendarClock className="size-6 text-primary" aria-hidden="true" />
                            <h1 className="text-2xl font-semibold tracking-tight">Schedule validation</h1>
                        </div>
                        <p className="max-w-3xl text-sm text-muted-foreground">
                            Check proposed sessions for invalid dates and class, trainer, or room conflicts before saving.
                            This screen validates schedules only; it does not save sessions.
                        </p>
                    </div>
                    <Button asChild variant="outline">
                        <Link to="/sessions">Back to sessions</Link>
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <Card>
                        <CardHeader>
                            <CardTitle>Schedule version</CardTitle>
                            <CardDescription>
                                The current backend accepts this ID as request context; it does not yet resolve a version record.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="max-w-sm">
                                <Field id="versionId" label="Schedule version ID" required>
                                    <Input
                                        id="versionId"
                                        type="number"
                                        min={1}
                                        step={1}
                                        required
                                        value={versionId}
                                        onChange={(event) => {
                                            setVersionId(event.target.value);
                                            setResult(null);
                                            setRequestError("");
                                        }}
                                        placeholder="e.g. 1"
                                    />
                                </Field>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        {candidates.map((candidate, index) => {
                            const candidateId = `candidate-${index}`;
                            return (
                                <Card key={`${candidate.candidateKey}-${index}`}>
                                    <CardHeader className="border-b">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <CardTitle className="text-base">Session candidate {index + 1}</CardTitle>
                                                <CardDescription>Enter the class, trainer, time, and optional location details.</CardDescription>
                                            </div>
                                            {candidates.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeCandidate(index)}
                                                    aria-label={`Remove candidate ${index + 1}`}
                                                >
                                                    <Trash2 className="size-4" aria-hidden="true" />
                                                    Remove
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-5">
                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            <Field id={`${candidateId}-key`} label="Candidate key" required>
                                                <Input
                                                    id={`${candidateId}-key`}
                                                    required
                                                    maxLength={100}
                                                    value={candidate.candidateKey}
                                                    onChange={(event) => updateCandidate(index, "candidateKey", event.target.value)}
                                                    placeholder="candidate-1"
                                                />
                                            </Field>
                                            <Field id={`${candidateId}-session`} label="Session ID (for updates)">
                                                <Input
                                                    id={`${candidateId}-session`}
                                                    type="number"
                                                    min={1}
                                                    step={1}
                                                    value={candidate.sessionId}
                                                    onChange={(event) => updateCandidate(index, "sessionId", event.target.value)}
                                                    placeholder="Optional"
                                                />
                                            </Field>
                                            <Field id={`${candidateId}-class`} label="Class ID" required>
                                                <Input
                                                    id={`${candidateId}-class`}
                                                    type="number"
                                                    min={1}
                                                    step={1}
                                                    required
                                                    value={candidate.classId}
                                                    onChange={(event) => updateCandidate(index, "classId", event.target.value)}
                                                />
                                            </Field>
                                            <Field id={`${candidateId}-trainer`} label="Trainer ID" required>
                                                <Input
                                                    id={`${candidateId}-trainer`}
                                                    type="number"
                                                    min={1}
                                                    step={1}
                                                    required
                                                    value={candidate.trainerId}
                                                    onChange={(event) => updateCandidate(index, "trainerId", event.target.value)}
                                                />
                                            </Field>
                                            <Field id={`${candidateId}-start`} label="Start time" required>
                                                <Input
                                                    id={`${candidateId}-start`}
                                                    type="datetime-local"
                                                    required
                                                    value={candidate.startAt}
                                                    onChange={(event) => updateCandidate(index, "startAt", event.target.value)}
                                                />
                                            </Field>
                                            <Field id={`${candidateId}-end`} label="End time" required>
                                                <Input
                                                    id={`${candidateId}-end`}
                                                    type="datetime-local"
                                                    required
                                                    value={candidate.endAt}
                                                    onChange={(event) => updateCandidate(index, "endAt", event.target.value)}
                                                />
                                            </Field>
                                            <Field id={`${candidateId}-room`} label="Room ID">
                                                <Input
                                                    id={`${candidateId}-room`}
                                                    type="number"
                                                    min={1}
                                                    step={1}
                                                    value={candidate.roomId}
                                                    onChange={(event) => updateCandidate(index, "roomId", event.target.value)}
                                                    placeholder="Optional"
                                                />
                                            </Field>
                                            <Field id={`${candidateId}-location`} label="Location">
                                                <Input
                                                    id={`${candidateId}-location`}
                                                    maxLength={150}
                                                    value={candidate.location}
                                                    onChange={(event) => updateCandidate(index, "location", event.target.value)}
                                                    placeholder="Optional when a room or meeting URL is set"
                                                />
                                            </Field>
                                            <Field id={`${candidateId}-meeting`} label="Meeting URL">
                                                <Input
                                                    id={`${candidateId}-meeting`}
                                                    type="url"
                                                    maxLength={500}
                                                    value={candidate.meetingUrl}
                                                    onChange={(event) => updateCandidate(index, "meetingUrl", event.target.value)}
                                                    placeholder="https://..."
                                                />
                                            </Field>
                                        </div>
                                        {result && (
                                            <CandidateIssues issues={result.issues} candidateKey={candidate.candidateKey} />
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={addCandidate}
                            disabled={candidates.length >= 100 || isSubmitting}
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            Add another session
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <CalendarClock className="size-4" aria-hidden="true" />
                            )}
                            {isSubmitting ? "Checking schedule..." : "Validate schedule"}
                        </Button>
                    </div>
                </form>

                {requestError && (
                    <Alert variant="destructive">
                        <AlertCircle aria-hidden="true" />
                        <AlertTitle>Validation request failed</AlertTitle>
                        <AlertDescription>{requestError}</AlertDescription>
                    </Alert>
                )}

                {result?.valid && (
                    <Alert className="border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 aria-hidden="true" />
                        <AlertTitle>Schedule is valid</AlertTitle>
                        <AlertDescription>
                            No conflicts were found for version {result.versionId} across {candidates.length} {candidates.length === 1 ? "session" : "sessions"}.
                        </AlertDescription>
                    </Alert>
                )}

                {result && !result.valid && (
                    <Alert variant="destructive">
                        <AlertCircle aria-hidden="true" />
                        <AlertTitle>
                            Schedule needs attention — {result.issues.length} {result.issues.length === 1 ? "issue" : "issues"} found
                        </AlertTitle>
                        <AlertDescription className="space-y-2">
                            <p>Review the errors shown under each session candidate before continuing.</p>
                            {issuesByCandidate.map((issue, index) => (
                                <p key={`${issue.code}-${index}`}>
                                    {issue.field ? `${FIELD_LABELS[issue.field] ?? issue.field}: ` : ""}
                                    {getIssueMessage(issue)}
                                </p>
                            ))}
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        </MainLayout>
    );
}

export default function ScheduleValidationPage() {
    return (
        <PermissionGate
            permissions={["SESSION_CREATE", "SESSION_UPDATE"]}
            fallback={(
                <MainLayout pathName={{ "schedule-validation": "Schedule Validation" }}>
                    <Alert variant="destructive" className="mx-auto max-w-2xl">
                        <AlertCircle aria-hidden="true" />
                        <AlertTitle>Access denied</AlertTitle>
                        <AlertDescription>
                            You need the SESSION_CREATE or SESSION_UPDATE permission to validate schedules.
                        </AlertDescription>
                    </Alert>
                </MainLayout>
            )}
        >
            <ScheduleValidationContent />
        </PermissionGate>
    );
}
