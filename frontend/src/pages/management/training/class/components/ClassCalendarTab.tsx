import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Info, ListChecks, Plus } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { sessionApi } from "@/api/features/demo/session.api";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { useSessionActionController } from "@/components/session/session-actions";
import { SessionActionsMenu } from "@/components/session/SessionActionsMenu";
import { SessionDialogs } from "@/components/session/SessionDialogs";
import { SessionStatusBadge } from "@/components/session/SessionStatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useExternalTrainers } from "@/hooks/useExternalLookups";
import { usePermissions } from "@/hooks/usePermissions";
import type { ExternalClass } from "@/types";
import { retryUnlessClientError } from "@/utils/query.utils";
import {
    compareSessions,
    formatDate,
    formatTime,
    formatWeekday,
    SESSION_QUERY_KEY,
    trainerLabel,
} from "@/utils/session.utils";

function SessionsSkeleton() {
    return (
        <div role="status" aria-busy="true" aria-label="Loading sessions" className="divide-y">
            {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="flex items-center gap-6 px-4 py-4">
                    <Skeleton className="h-5 w-8" />
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="ml-auto h-6 w-24 rounded-full" />
                </div>
            ))}
        </div>
    );
}

/**
 * Class Details > Calendar. Class -> sessions is the only verified link in this application: a session stores
 * the id of its class. The Subject level (Program -> Subject -> Teaching Assignment) has no API yet, so no session
 * can be proven to belong to a Subject and every one is listed as unresolved rather than guessed into a Subject.
 */
export function ClassCalendarTab({ classItem }: { classItem: ExternalClass }) {
    const { hasPermission } = usePermissions();
    const controller = useSessionActionController();
    const canRead = hasPermission("SESSION_READ");
    const canCreate = hasPermission("SESSION_CREATE");

    const sessionsQuery = useQuery({
        queryKey: [...SESSION_QUERY_KEY, "class", classItem.id],
        queryFn: () => sessionApi.getAllByClass(classItem.id),
        enabled: canRead,
        retry: retryUnlessClientError,
    });
    const hasSessions = (sessionsQuery.data?.length ?? 0) > 0;
    const trainers = useExternalTrainers(hasSessions);

    const sessions = useMemo(() => [...(sessionsQuery.data ?? [])].sort(compareSessions), [sessionsQuery.data]);
    const summary = useMemo(() => {
        const count = (status: string) => sessions.filter((session) => session.status === status).length;
        return `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} · ${count("SCHEDULED")} scheduled · ${count("COMPLETED")} completed · ${count("CANCELLED")} cancelled`;
    }, [sessions]);

    if (!canRead) {
        return <ApiErrorState error={undefined} kind="forbidden" resource="session" />;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold">Class schedule</h2>
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        {sessionsQuery.isPending ? "Loading sessions…" : sessionsQuery.isError ? "Could not load sessions" : summary}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                        <Link to={`/sessions?classId=${classItem.id}`}>
                            <ListChecks /> Open in Sessions
                        </Link>
                    </Button>
                    {canCreate && (
                        <Button onClick={() => controller.open({ type: "create", classId: classItem.id })}>
                            <Plus /> Add session
                        </Button>
                    )}
                </div>
            </div>

            <Alert>
                <Info />
                <AlertTitle>Subjects are not available yet</AlertTitle>
                <AlertDescription>
                    <p>
                        The current API has no Training Program → Subject → Teaching Assignment contract, so a session cannot be verified against a
                        Subject. Until it exists, every session of this class is listed below as <strong>unresolved</strong>; nothing is guessed or
                        assigned to a Subject. Calendar versions are not exposed either, so this shows the live sessions.
                    </p>
                </AlertDescription>
            </Alert>

            <section aria-labelledby="unresolved-sessions-title" className="overflow-hidden rounded-lg border">
                <header className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3">
                    <h3 id="unresolved-sessions-title" className="text-sm font-semibold">
                        Unresolved sessions
                    </h3>
                    <Badge variant="secondary">{sessions.length}</Badge>
                </header>

                {sessionsQuery.isPending ? (
                    <SessionsSkeleton />
                ) : sessionsQuery.isError ? (
                    <ApiErrorState error={sessionsQuery.error} resource="session list" onRetry={() => void sessionsQuery.refetch()} />
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-muted-foreground">
                        <CalendarDays className="size-8" aria-hidden />
                        <p className="text-sm">No sessions are scheduled for this class yet.</p>
                        {canCreate && (
                            <Button variant="outline" onClick={() => controller.open({ type: "create", classId: classItem.id })}>
                                <Plus /> Add the first session
                            </Button>
                        )}
                    </div>
                ) : (
                    <Table aria-label="Sessions of this class" className="min-w-[960px] [&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-14">No.</TableHead>
                                <TableHead>Session</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Day</TableHead>
                                <TableHead>Start</TableHead>
                                <TableHead>End</TableHead>
                                <TableHead>Trainer</TableHead>
                                <TableHead>Room</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-20 text-center">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sessions.map((session, index) => (
                                <TableRow key={session.id} className={session.status === "CANCELLED" ? "text-muted-foreground" : undefined}>
                                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                    <TableCell className="max-w-72 truncate">
                                        <Link
                                            to={`/sessions/${session.id}`}
                                            className="font-medium text-blue-800 hover:underline dark:text-blue-300"
                                        >
                                            {session.title}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{formatDate(session.startTime)}</TableCell>
                                    <TableCell>{formatWeekday(session.startTime)}</TableCell>
                                    <TableCell>{formatTime(session.startTime)}</TableCell>
                                    <TableCell>{formatTime(session.endTime)}</TableCell>
                                    <TableCell>{trainerLabel(trainers.data, session.trainerId)}</TableCell>
                                    <TableCell>{session.location || "—"}</TableCell>
                                    <TableCell>
                                        <SessionStatusBadge
                                            status={session.status}
                                            title={session.status === "CANCELLED" && session.cancelReason ? `Cancelled: ${session.cancelReason}` : undefined}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <SessionActionsMenu session={session} controller={controller} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </section>

            <SessionDialogs controller={controller} />
        </div>
    );
}
