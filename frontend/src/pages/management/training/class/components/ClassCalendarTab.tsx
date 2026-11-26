import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarRange } from "lucide-react";
import { classScheduleApi } from "@/api/features/classSchedule.api";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import type { ExternalClass } from "@/types";
import { retryUnlessClientError } from "@/utils/query.utils";
import { DEFAULT_SCHEDULE_CONFIG, type ScheduleCourse } from "@/pages/management/calendar/schedule.config";
import { getMondayOfIsoDate } from "@/pages/management/calendar/scheduleEngine";
import { WeeklyScheduleGrid } from "@/pages/management/calendar/components/WeeklyScheduleGrid";

/**
 * Strictly Read-only calendar tab inside Class Details (`/classes/:classId?tab=calendar`).
 * Reads the exact same `/api/classes/{classId}/schedule` data source and reuses the shared `WeeklyScheduleGrid`.
 * All schedule generation, editing, and saving live in the Sidebar `/calendar` workspace.
 */
export function ClassCalendarTab({ classItem }: { classItem: ExternalClass }) {
    const { hasPermission } = usePermissions();
    const canRead = hasPermission("SESSION_READ");
    const canReadClasses = hasPermission("CLASS_READ");

    const [weekMonday, setWeekMonday] = useState(() =>
        getMondayOfIsoDate(classItem.startDate || new Date().toISOString().slice(0, 10)),
    );

    const query = useQuery({
        queryKey: ["class-schedule", classItem.id],
        queryFn: () => classScheduleApi.getClassSchedule(classItem.id),
        enabled: canRead,
        retry: retryUnlessClientError,
    });

    const data = query.data;
    const config = data?.config ?? DEFAULT_SCHEDULE_CONFIG;

    const courses: ScheduleCourse[] = useMemo(
        () =>
            (data?.program?.courses ?? []).map((c) => ({
                id: c.id,
                code: c.code,
                name: c.name,
                version: c.version,
                durationHours: c.durationHours ?? 0,
                orderIndex: c.orderIndex,
                slotsNeeded: c.slotsNeeded,
            })),
        [data?.program?.courses],
    );

    useEffect(() => {
        const anchor = data?.entries?.[0]?.date ?? data?.classInfo?.startDate ?? classItem.startDate;
        if (anchor) {
            setWeekMonday(getMondayOfIsoDate(anchor));
        }
    }, [data?.entries, data?.classInfo?.startDate, classItem.startDate]);

    if (!canRead) {
        return <ApiErrorState error={undefined} kind="forbidden" resource="calendar" />;
    }

    if (query.isPending) {
        return (
            <div className="space-y-4 rounded-xl border p-5" role="status" aria-label="Loading class schedule">
                <Skeleton className="h-8 w-64" />
                <div className="grid gap-3 md:grid-cols-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
                <Skeleton className="h-56 w-full" />
            </div>
        );
    }

    if (query.isError) {
        return (
            <ApiErrorState
                error={query.error}
                resource="calendar"
                onRetry={() => void query.refetch()}
            />
        );
    }

    const entries = data?.entries ?? [];
    const hasSchedule = Boolean(data?.hasSchedule && entries.length > 0);

    if (!hasSchedule) {
        return (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 p-6 text-center">
                <CalendarDays className="mb-3 size-10 text-muted-foreground" />
                <h3 className="text-base font-semibold text-foreground">No schedule yet</h3>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    Class schedules are auto-generated from the Training Program and managed in the Calendar module from the sidebar.
                </p>
                {canReadClasses && (
                    <Button size="sm" className="mt-4 bg-blue-800 text-white hover:bg-blue-900" asChild>
                        <Link to={`/calendar?tab=schedule&classId=${classItem.id}`}>
                            <CalendarRange className="size-4" />
                            Go to Calendar to create schedule
                        </Link>
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="flex min-h-[420px] min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/20 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                        Read-only
                    </Badge>
                    <span className="text-muted-foreground">
                        Official schedule for class <strong>{data?.classInfo?.code || classItem.code || classItem.id}</strong>{" "}
                        ({entries.length} {entries.length === 1 ? "session" : "sessions"})
                        {data?.classInfo?.actualStartDate && (
                            <>
                                {" "}· Actual:{" "}
                                <strong>
                                    {data.classInfo.actualStartDate} → {data.classInfo.actualEndDate || "—"}
                                </strong>
                            </>
                        )}
                    </span>
                </div>
                {canReadClasses && (
                    <Button variant="outline" size="sm" asChild>
                        <Link to={`/calendar?tab=schedule&classId=${classItem.id}`}>
                            <CalendarRange className="size-4" />
                            Open in Calendar
                        </Link>
                    </Button>
                )}
            </div>

            <WeeklyScheduleGrid
                entries={entries}
                courses={courses}
                config={config}
                classStartDate={data?.classInfo?.startDate ?? classItem.startDate}
                weekMonday={weekMonday}
                onWeekMondayChange={setWeekMonday}
                editMode={false}
                showProgressInLegend={false}
            />
        </div>
    );
}
