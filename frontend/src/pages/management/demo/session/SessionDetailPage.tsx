import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, CheckCircle2, Copy, Pencil, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { sessionApi } from "@/api/features/demo/session.api";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { DetailGroup, DetailItem } from "@/components/common/DetailGrid";
import { MainLayout } from "@/components/layout/MainLayout";
import { ClassLabel } from "@/components/session/ClassLabel";
import { useSessionActionController } from "@/components/session/session-actions";
import { SessionDialogs } from "@/components/session/SessionDialogs";
import { SessionStatusBadge } from "@/components/session/SessionStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useExternalTrainers } from "@/hooks/useExternalLookups";
import { usePermissions } from "@/hooks/usePermissions";
import { retryUnlessClientError } from "@/utils/query.utils";
import {
    formatDate,
    formatTime,
    formatWeekday,
    isOpenSession,
    SESSION_QUERY_KEY,
    trainerLabel,
} from "@/utils/session.utils";

const SESSIONS_PATH = "/sessions";

function DetailSkeleton() {
    return (
        <div role="status" aria-busy="true" aria-label="Loading session" className="space-y-4 p-5">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-5 w-40" />
            <div className="grid gap-4 pt-4 md:grid-cols-2">
                {Array.from({ length: 8 }, (_, index) => (
                    <Skeleton key={index} className="h-6 w-full" />
                ))}
            </div>
        </div>
    );
}

export default function SessionDetailPage() {
    const { sessionId } = useParams();
    const id = sessionId && /^[1-9]\d{0,14}$/.test(sessionId) ? sessionId : undefined;

    const { hasPermission } = usePermissions();
    const controller = useSessionActionController();

    const query = useQuery({
        queryKey: [...SESSION_QUERY_KEY, "detail", id],
        queryFn: () => sessionApi.getById(id as string),
        enabled: !!id,
        retry: retryUnlessClientError,
    });
    const session = query.data;
    const trainers = useExternalTrainers(!!session);

    const canUpdate = hasPermission("SESSION_UPDATE");
    const canCreate = hasPermission("SESSION_CREATE");
    const open = session ? isOpenSession(session) : false;
    const canModify = canUpdate && open;

    const classCalendar = session?.classId != null ? `/classes/${session.classId}?tab=calendar` : undefined;

    return (
        <MainLayout pathName={{ sessions: "Sessions", ...(id && session?.title ? { [id]: session.title } : {}) }}>
            <section className="w-full min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
                {!id ? (
                    <ApiErrorState
                        error={undefined}
                        kind="notFound"
                        resource="session"
                        backTo={{ to: SESSIONS_PATH, label: "Back to Sessions" }}
                    />
                ) : query.isPending ? (
                    <DetailSkeleton />
                ) : query.isError ? (
                    <ApiErrorState
                        error={query.error}
                        resource="session"
                        onRetry={() => void query.refetch()}
                        backTo={{ to: SESSIONS_PATH, label: "Back to Sessions" }}
                    />
                ) : session ? (
                    <>
                        <header className="flex flex-col gap-4 border-b p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 space-y-2">
                                <Link
                                    to={classCalendar ?? SESSIONS_PATH}
                                    className="inline-flex items-center gap-1 text-sm text-blue-800 hover:underline dark:text-blue-300"
                                >
                                    <ArrowLeft className="size-4" />
                                    {classCalendar ? "Back to class calendar" : "Back to Sessions"}
                                </Link>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="break-words text-lg font-semibold">Session Details: {session.title}</h1>
                                    <SessionStatusBadge status={session.status} />
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {canModify && (
                                    <Button variant="outline" onClick={() => controller.open({ type: "edit", session })}>
                                        <Pencil /> Edit
                                    </Button>
                                )}
                                {canModify && (
                                    <Button variant="outline" onClick={() => controller.open({ type: "reschedule", session })}>
                                        <CalendarClock /> Reschedule
                                    </Button>
                                )}
                                {canCreate && (
                                    <Button variant="outline" onClick={() => controller.open({ type: "duplicate", session })}>
                                        <Copy /> Duplicate
                                    </Button>
                                )}
                                {canModify && (
                                    <Button variant="outline" onClick={() => controller.open({ type: "complete", session })}>
                                        <CheckCircle2 /> Mark as completed
                                    </Button>
                                )}
                                {canModify && (
                                    <Button
                                        variant="outline"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => controller.open({ type: "cancel", session })}
                                    >
                                        <XCircle /> Cancel session
                                    </Button>
                                )}
                            </div>
                        </header>

                        <div className="grid gap-x-10 p-4 sm:p-5 md:grid-cols-2">
                            <DetailGroup>
                                <DetailItem label="Class">
                                    <ClassLabel classId={session.classId} asLink showName />
                                </DetailItem>
                                <DetailItem label="Topic ID">{session.topicId ?? "—"}</DetailItem>
                                <DetailItem label="Trainer">{trainerLabel(trainers.data, session.trainerId)}</DetailItem>
                                <DetailItem label="Room">{session.location || "—"}</DetailItem>
                                <DetailItem label="Note">{session.note || "—"}</DetailItem>
                            </DetailGroup>
                            <DetailGroup>
                                <DetailItem label="Date">{formatDate(session.startTime)}</DetailItem>
                                <DetailItem label="Day of week">{formatWeekday(session.startTime)}</DetailItem>
                                <DetailItem label="Start">{formatTime(session.startTime)}</DetailItem>
                                <DetailItem label="End">{formatTime(session.endTime)}</DetailItem>
                                {session.status === "CANCELLED" && (
                                    <DetailItem label="Cancel reason">{session.cancelReason || "—"}</DetailItem>
                                )}
                                <DetailItem label="Last updated">
                                    {formatDate(session.updatedAt)} {formatTime(session.updatedAt)}
                                </DetailItem>
                            </DetailGroup>
                        </div>
                    </>
                ) : null}
            </section>

            <SessionDialogs controller={controller} />
        </MainLayout>
    );
}
