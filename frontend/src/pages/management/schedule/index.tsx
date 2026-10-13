import { scheduleApi } from "@/api/features/schedule.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import type { ScheduleRole, ScheduleView, SessionCategory, StudySession } from "@/types/features/schedule";
import { SESSION_CATEGORY_COLORS } from "@/utils/schedule.utils";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { MonthView } from "./components/MonthView";
import { ScheduleToolbar } from "./components/ScheduleToolbar";
import { SessionDetailsDialog } from "./components/SessionDetailsDialog";
import { WeekView } from "./components/WeekView";

const VIEW_STORAGE_KEY = "schedule.view";

const CATEGORY_LEGEND: SessionCategory[] = ["LESSON", "REVIEW", "EXAM", "PROJECT", "MENTORING"];

const readStoredView = (): ScheduleView => {
  const stored = localStorage.getItem(VIEW_STORAGE_KEY);
  return stored === "week" ? "week" : "month";
};

export default function SchedulePage() {
  const { activeRole } = usePermissions();

  const [view, setView] = useState<ScheduleView>(readStoredView);
  const [anchor, setAnchor] = useState<dayjs.Dayjs>(() => dayjs());
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);
  const [roleFilter, setRoleFilter] = useState<"ALL" | ScheduleRole>(() =>
    activeRole === "STUDENT" || activeRole === "TEACHER" ? activeRole : "ALL",
  );
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | SessionCategory>("ALL");

  const anchorMonthKey = anchor.format("YYYY-MM");

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const from = anchor.startOf("month").subtract(7, "day");
        const to = anchor.endOf("month").add(7, "day");
        const data = await scheduleApi.getSessions({
          from: from.toISOString(),
          to: to.toISOString(),
          role: roleFilter === "ALL" ? undefined : roleFilter,
        });

        if (!cancelled) setSessions(data);
      } catch (error) {
        console.error("Failed to load schedule:", error);
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [anchorMonthKey, roleFilter]);

  const visibleSessions = useMemo(
    () => sessions.filter((session) => categoryFilter === "ALL" || session.category === categoryFilter),
    [sessions, categoryFilter],
  );

  const handleViewChange = (nextView: ScheduleView) => setView(nextView);

  const handlePrev = () => {
    if (view === "week") setAnchor((prev) => prev.subtract(1, "week"));
    else setAnchor((prev) => prev.subtract(1, "month"));
  };

  const handleNext = () => {
    if (view === "week") setAnchor((prev) => prev.add(1, "week"));
    else setAnchor((prev) => prev.add(1, "month"));
  };

  return (
    <MainLayout pathName={{ "study-schedule": "Study Schedule" }}>
      <div className="flex h-full min-h-[520px] flex-col">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Study Schedule</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Study sessions for Students and Teachers. Switch between month, week and list views.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {CATEGORY_LEGEND.map((category) => (
              <span key={category} className="flex items-center gap-1.5 text and weekforeground">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: SESSION_CATEGORY_COLORS[category] }}
                />
                {category.charAt(0) + category.slice(1).toLowerCase()}
              </span>
            ))}
          </div>
        </header>

        {/* Calendar card */}
        <div className="mt-4 flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <ScheduleToolbar
            view={view}
            onViewChange={handleViewChange}
            anchor={anchor}
            onToday={() => setAnchor(dayjs())}
            onPrev={handlePrev}
            onNext={handleNext}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
          />

          {isLoading && sessions.length === 0 ? (
            <div className="flex flex-1 flex-col gap-3 p-4">
              <Skeleton className="h-10 w-72" />
              <Skeleton className="flex-1" />
            </div>
          ) : (
            <>
              {view === "month" && (
                <MonthView anchor={anchor} sessions={visibleSessions} onSessionClick={setSelectedSession} />
              )}
              {view === "week" && (
                <WeekView anchor={anchor} sessions={visibleSessions} onSessionClick={setSelectedSession} />
              )}
            </>
          )}
        </div>
      </div>

      <SessionDetailsDialog session={selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)} />
    </MainLayout>
  );
}
