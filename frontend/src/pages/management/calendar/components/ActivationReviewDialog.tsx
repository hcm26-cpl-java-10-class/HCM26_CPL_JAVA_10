import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    CalendarCheck2,
    CheckCircle2,
    Clock3,
    Loader2,
    MapPin,
    RefreshCw,
    ShieldCheck,
    TriangleAlert,
    UserRound,
    WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { calendarVersionApi } from "@/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type {
    CalendarActivationConflictError,
    CalendarConflict,
    CalendarConflictType,
    CalendarSummary,
    CalendarVersionResponse,
    ConflictCheckResult,
    ScheduleApiError,
    SessionDTO,
} from "@/types";

interface ActivationReviewDialogProps {
    open: boolean;
    calendar: CalendarSummary | null;
    version: CalendarVersionResponse | null;
    canActivateVersion: boolean;
    onOpenChange: (open: boolean) => void;
    onViewSessions: (version: CalendarVersionResponse) => void;
    onGenerateSessions: (version: CalendarVersionResponse) => void;
    onActivated: (version: CalendarVersionResponse) => Promise<void> | void;
}

const conflictLabels: Record<CalendarConflictType, string> = {
    TRAINER_CONFLICT: "Trainer conflict",
    ROOM_CONFLICT: "Room conflict",
};

const reasonLabels: Record<string, string> = {
    SHARED_CLASS_SESSION: "Shared class session",
    ROOM_PARTITIONED: "Partitioned room",
    ACKNOWLEDGED_PENDING_RESOLUTION: "Acknowledged pending resolution",
};

const formatDateTime = (value?: string): string => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value.replace("T", " ") : date.toLocaleString();
};

const requestErrorMessage = (error: unknown, fallback: string): string => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
        return error.response?.data?.message ?? fallback;
    }
    return error instanceof Error ? error.message : fallback;
};

const hasValidationErrors = (
    errors: Record<string, string[]> | null | undefined,
): boolean => Boolean(errors && Object.values(errors).some((messages) => messages.length > 0));

function SessionSummary({ session }: { session: SessionDTO }) {
    return (
        <div className="min-w-0 space-y-2 rounded-lg border bg-card p-3">
            <div>
                <p className="truncate font-medium" title={session.title}>
                    {session.title || "Untitled session"}
                </p>
                <p className="text-xs text-muted-foreground">
                    {session.classCode || "Unknown class"}
                    {session.id != null ? ` · Session #${session.id}` : ""}
                </p>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-start gap-1.5">
                    <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                        {formatDateTime(session.startTime)} – {formatDateTime(session.endTime)}
                    </span>
                </p>
                <p className="flex items-center gap-1.5">
                    <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{session.trainerName || `Trainer #${session.trainerId}`}</span>
                </p>
                <p className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{session.room || "No room"}</span>
                </p>
            </div>
        </div>
    );
}

function ConflictTypeBadges({ conflict }: { conflict: CalendarConflict }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {conflict.conflictTypes.map((type) => {
                const isBlocking = conflict.blockingConflictTypes.includes(type);
                const isWaived = conflict.waivedConflictTypes.includes(type);
                return (
                    <Badge
                        key={type}
                        variant={isBlocking ? "destructive" : "outline"}
                        className={isWaived ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : undefined}
                    >
                        {conflictLabels[type] ?? type}
                        {isWaived ? " · approved override" : isBlocking ? " · blocking" : ""}
                    </Badge>
                );
            })}
        </div>
    );
}

function ConflictPairCard({ conflict }: { conflict: CalendarConflict }) {
    const resolutionLabel = conflict.resolutionReason
        ? reasonLabels[conflict.resolutionReason] ?? conflict.resolutionReason
        : null;

    return (
        <article className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-2">
                    {conflict.blocking ? (
                        <TriangleAlert className="size-4 text-destructive" aria-hidden="true" />
                    ) : (
                        <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    )}
                    <p className="font-medium">
                        {conflict.blocking ? "Blocking conflict" : "Approved exception"}
                    </p>
                </div>
                <ConflictTypeBadges conflict={conflict} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <SessionSummary session={conflict.session} />
                <SessionSummary session={conflict.conflictingSession} />
            </div>

            {conflict.resolutionStatus && (
                <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                    <Badge variant="secondary">{conflict.resolutionStatus}</Badge>
                    {resolutionLabel && <span>{resolutionLabel}</span>}
                    {conflict.resolutionId != null && <span>Resolution #{conflict.resolutionId}</span>}
                </div>
            )}
        </article>
    );
}

function ValidationErrorList({ errors }: { errors: Record<string, string[]> }) {
    const entries = Object.entries(errors).flatMap(([field, messages]) =>
        messages.map((message, index) => ({ field, message, key: `${field}-${index}` })),
    );

    if (entries.length === 0) return null;

    return (
        <section className="space-y-2" aria-label="Session validation errors">
            <h3 className="font-medium">Invalid session data</h3>
            <div className="space-y-2">
                {entries.map(({ field, message, key }) => {
                    const sessionId = field.match(/^sessions\.(\d+)\./)?.[1];
                    return (
                        <div key={key} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                            <p className="text-sm font-medium text-destructive">
                                {sessionId ? `Session #${sessionId}` : field}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function ReviewSkeleton() {
    return (
        <div className="space-y-4" role="status" aria-live="polite">
            <span className="sr-only">Checking schedule conflicts…</span>
            <Skeleton className="h-20 w-full motion-reduce:animate-none" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 motion-reduce:animate-none" />
                ))}
            </div>
            <Skeleton className="h-40 w-full motion-reduce:animate-none" />
        </div>
    );
}

export function ActivationReviewDialog({
    open,
    calendar,
    version,
    canActivateVersion,
    onOpenChange,
    onViewSessions,
    onGenerateSessions,
    onActivated,
}: ActivationReviewDialogProps) {
    const queryClient = useQueryClient();
    const [confirming, setConfirming] = useState(false);
    const [activationEmpty, setActivationEmpty] = useState(false);
    const [activationErrors, setActivationErrors] = useState<Record<string, string[]>>({});
    const [activationMessage, setActivationMessage] = useState<string | null>(null);

    const conflictQueryKey = ["calendar-version-conflicts", version?.id] as const;
    const conflictQuery = useQuery({
        queryKey: conflictQueryKey,
        queryFn: () => calendarVersionApi.checkConflicts(version!.id!),
        enabled: open && version?.status === "DRAFT" && version.id != null,
        staleTime: 0,
        refetchOnWindowFocus: false,
        retry: false,
    });

    useEffect(() => {
        if (!open) {
            setConfirming(false);
            setActivationEmpty(false);
            setActivationErrors({});
            setActivationMessage(null);
        }
    }, [open]);

    const activateMutation = useMutation({
        mutationFn: () => calendarVersionApi.activate(calendar!.id, version!.id!),
        onSuccess: async (activatedVersion) => {
            toast.success(`Version v${activatedVersion.versionNumber} is now active.`);
            await onActivated(activatedVersion);
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            setConfirming(false);
            if (!axios.isAxiosError(error)) {
                setActivationMessage(requestErrorMessage(error, "Could not activate this calendar version."));
                return;
            }

            const status = error.response?.status;
            const data = error.response?.data as
                | CalendarActivationConflictError
                | ScheduleApiError
                | undefined;

            if (
                status === 409 &&
                data?.code === "CALENDAR_ACTIVATION_CONFLICT" &&
                "conflictCheck" in data
            ) {
                queryClient.setQueryData<ConflictCheckResult>(conflictQueryKey, data.conflictCheck);
                setActivationMessage("The schedule changed. Conflict results have been refreshed.");
                toast.error("Activation was blocked by new or unresolved conflicts.");
                return;
            }

            if (status === 422 && data?.code === "CALENDAR_VERSION_EMPTY") {
                setActivationEmpty(true);
                setActivationMessage(data.message);
                return;
            }

            if (status === 422 && data?.code === "CALENDAR_ACTIVATION_VALIDATION_FAILED") {
                setActivationErrors(data.fieldErrors ?? {});
                setActivationMessage(data.message);
                return;
            }

            if (status === 404 || (status === 409 && data?.code !== "CALENDAR_ACTIVATION_CONFLICT")) {
                toast.error(data?.message ?? "This calendar version is no longer available as a draft.");
                onOpenChange(false);
                void onActivated(version!);
                return;
            }

            setActivationMessage(data?.message ?? "Could not activate this calendar version. Please try again.");
        },
    });

    const result = conflictQuery.data;
    const effectiveValidationErrors = hasValidationErrors(activationErrors)
        ? activationErrors
        : (result?.validationErrors ?? {});
    const invalid = hasValidationErrors(effectiveValidationErrors);
    const ready = Boolean(result?.canActivate && !invalid && !activationEmpty);

    const metrics = useMemo(
        () => [
            { label: "Total conflicts", value: result?.conflictCount ?? 0 },
            { label: "Blocking", value: result?.blockingConflictCount ?? 0 },
            { label: "Approved", value: result?.approvedOverrideCount ?? 0 },
            { label: "Acknowledged", value: result?.acknowledgedCount ?? 0 },
        ],
        [result],
    );

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && activateMutation.isPending) return;
        onOpenChange(nextOpen);
    };

    const handleRecheck = async () => {
        setConfirming(false);
        setActivationErrors({});
        setActivationMessage(null);
        await conflictQuery.refetch();
    };

    const handleViewSessions = () => {
        if (!version) return;
        onOpenChange(false);
        onViewSessions(version);
    };

    const handleGenerateSessions = () => {
        if (!version) return;
        onOpenChange(false);
        onGenerateSessions(version);
    };

    if (!version || !calendar) return null;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="flex max-h-[90dvh] w-full flex-col overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl"
                showCloseButton={!activateMutation.isPending}
            >
                <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                            <CalendarCheck2 className="size-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <DialogTitle className="text-lg font-semibold">Review activation</DialogTitle>
                                <Badge variant="secondary">DRAFT</Badge>
                            </div>
                            <DialogDescription className="mt-1">
                                {calendar.name} · Version v{version.versionNumber}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    <div
                        key={confirming ? "confirming" : conflictQuery.status}
                        className="space-y-5 p-5 animate-in fade-in-0 duration-150 motion-reduce:animate-none sm:p-6"
                    >
                        {conflictQuery.isPending ? (
                            <ReviewSkeleton />
                        ) : conflictQuery.isError ? (
                            <Alert variant="destructive">
                                <AlertCircle aria-hidden="true" />
                                <AlertTitle>Could not check this draft</AlertTitle>
                                <AlertDescription>
                                    <p>{requestErrorMessage(conflictQuery.error, "Conflict check failed.")}</p>
                                    <Button size="sm" variant="outline" className="mt-2" onClick={() => void handleRecheck()}>
                                        <RefreshCw className="size-3.5" />
                                        Try again
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        ) : confirming ? (
                            <div className="mx-auto max-w-xl space-y-5 py-8 text-center">
                                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <CalendarCheck2 className="size-6" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold">Activate version v{version.versionNumber}?</h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {calendar.activeVersionNumber != null
                                            ? `The current active version v${calendar.activeVersionNumber} will become inactive.`
                                            : "This will become the first active version for this calendar."}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        The server will check conflicts again before making the change.
                                    </p>
                                </div>
                            </div>
                        ) : result ? (
                            <>
                                {activationMessage && (
                                    <Alert variant={activationEmpty || invalid || result.hasBlockingConflict ? "destructive" : "default"}>
                                        <AlertCircle aria-hidden="true" />
                                        <AlertTitle>Activation needs attention</AlertTitle>
                                        <AlertDescription>{activationMessage}</AlertDescription>
                                    </Alert>
                                )}

                                {activationEmpty ? (
                                    <div className="rounded-xl border border-dashed p-8 text-center">
                                        <WandSparkles className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                                        <h3 className="mt-3 font-semibold">No active sessions</h3>
                                        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                                            This draft needs at least one active, non-cancelled session before activation.
                                        </p>
                                        <Button className="mt-4" onClick={handleGenerateSessions}>
                                            <WandSparkles className="size-4" />
                                            Generate sessions
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <Alert variant={ready ? "default" : "destructive"} className={ready ? "border-emerald-500/30 bg-emerald-500/5" : undefined}>
                                            {ready ? <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
                                            <AlertTitle>
                                                {ready
                                                    ? result.hasConflict
                                                        ? "Ready with approved exceptions"
                                                        : "Ready to activate"
                                                    : invalid
                                                      ? "Invalid session data"
                                                      : "Activation is blocked"}
                                            </AlertTitle>
                                            <AlertDescription>
                                                {ready
                                                    ? result.hasConflict
                                                        ? "All detected conflicts are covered by approved overrides."
                                                        : "No schedule conflicts or validation errors were found."
                                                    : invalid
                                                      ? "Correct the session data below, then run the check again."
                                                      : `${result.blockingConflictCount} conflict(s) must be resolved before activation.`}
                                            </AlertDescription>
                                        </Alert>

                                        {result.hasConflict && (
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                {metrics.map((metric) => (
                                                    <div key={metric.label} className="rounded-lg border bg-card p-3">
                                                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                                                        <p className="mt-1 text-xl font-semibold">{metric.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <ValidationErrorList errors={effectiveValidationErrors} />

                                        {result.conflicts.length > 0 && (
                                            <section className="space-y-3" aria-label="Schedule conflicts">
                                                <div className="flex items-center justify-between gap-3">
                                                    <h3 className="font-medium">Conflict details</h3>
                                                    <span className="text-xs text-muted-foreground">
                                                        {result.conflicts.length} pair(s)
                                                    </span>
                                                </div>
                                                {result.conflicts.map((conflict) => (
                                                    <ConflictPairCard key={conflict.conflictKey} conflict={conflict} />
                                                ))}
                                            </section>
                                        )}
                                    </>
                                )}
                            </>
                        ) : null}
                    </div>
                </div>

                <DialogFooter className="m-0 shrink-0 rounded-none px-5 py-4 sm:px-6">
                    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void handleRecheck()}
                            disabled={conflictQuery.isFetching || activateMutation.isPending || confirming}
                        >
                            <RefreshCw className={conflictQuery.isFetching ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} />
                            Recheck
                        </Button>

                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            {confirming ? (
                                <>
                                    <Button variant="outline" onClick={() => setConfirming(false)} disabled={activateMutation.isPending}>
                                        Back
                                    </Button>
                                    <Button onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}>
                                        {activateMutation.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
                                        {activateMutation.isPending ? "Activating…" : "Confirm activation"}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button variant="outline" onClick={handleViewSessions} disabled={activateMutation.isPending}>
                                        View sessions
                                    </Button>
                                    {canActivateVersion && (
                                        <Button
                                            onClick={() => setConfirming(true)}
                                            disabled={!ready || conflictQuery.isFetching}
                                        >
                                            Activate version
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
