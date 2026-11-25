import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { learningApi } from "@/api/features/learning.api";
import { useLearningRoadmap } from "@/api/features/learning-roadmap.api";
import { usePermissions } from "@/hooks/usePermissions";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LearningInsightsPanel } from "./components/LearningInsightsPanel";
import { LearningRecordsPanel } from "./components/LearningRecordsPanel";
import { LearningRoadmapPanel, LearningRoadmapSummary } from "./components/LearningRoadmapPanel";
import { LearningActivityCalendar } from "./components/LearningActivityCalendar";
import { GoalsHabitsPanel } from "./components/habits/GoalsHabitsPanel";
import { LearningReportsPanel } from "./components/reports/LearningReportsPanel";

export function MyLearningPage() {
  const { activeRole, user, canLearn } = usePermissions();
  const [params, setParams] = useSearchParams();
  const { hash, key: navigationKey } = useLocation();
  const [lastTab, setLastTab] = useState("overview");
  const requestedTab = params.get("tab");
  const tab = canLearn && (requestedTab === "goals" || requestedTab === "reports") ? requestedTab : lastTab;
  const opensInsights = canLearn && hash === "#learning-insights-heading";
  useEffect(() => {
    if (opensInsights) setLastTab("overview");
  }, [opensInsights, navigationKey]);
  useEffect(() => {
    if (!opensInsights || tab !== "overview") return;
    const heading = document.getElementById("learning-insights-heading");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
  }, [opensInsights, navigationKey, tab]);
  function setTab(next: string) {
    const urlTab = next === "goals" || next === "reports" ? next : null;
    if (!urlTab) setLastTab(next);
    if (urlTab !== requestedTab || opensInsights) {
      setParams(current => {
        const updated = new URLSearchParams(current);
        if (urlTab) updated.set("tab", urlTab);
        else updated.delete("tab");
        return updated;
      }, { replace: true });
    }
  }
  const canUseRoadmap = canLearn && user.permissions.includes("COURSE_READ");
  const roadmap = useLearningRoadmap(user.email, canUseRoadmap);
  const records = useQuery({
    queryKey: ["personal-learning", user.email],
    queryFn: learningApi.mine,
    retry: false,
  });
  const enrolled = roadmap.data?.enrolledCourses;
  const stats = [
    ["Enrolled", enrolled?.length ?? records.data?.enrolledCourses.length],
    ["In progress", enrolled?.filter(course => course.status === "IN_PROGRESS").length ?? records.data?.inProgressCourses],
    ["Completed", enrolled?.filter(course => course.status === "COMPLETED").length ?? records.data?.completedCourses],
  ] as const;
  return <MainLayout pathName={{ "my-learning": "My Learning", learning: "My Learning", enrollments: "My Learning", fams: "FAMS & LMS" }}>
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">My Learning</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your enrolled courses and learning records.</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map(([label, count]) => (
          <div key={label} className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
            <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
            <dd className="mt-2 text-xl font-semibold tabular-nums">{count ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <TabsList variant="line" aria-label="My Learning" className="h-auto w-full flex-wrap justify-start gap-x-2 gap-y-2 border-b pb-2">
          <TabsTrigger value="overview" className="flex-none">Overview</TabsTrigger>
          {canUseRoadmap && <TabsTrigger value="roadmap" className="flex-none">My Roadmap</TabsTrigger>}
          {canLearn && <TabsTrigger value="goals" className="flex-none">Goals &amp; Habits</TabsTrigger>}
          <TabsTrigger value="history" className="flex-none">Learning History</TabsTrigger>
          {canLearn && <TabsTrigger value="reports" className="flex-none">Reports</TabsTrigger>}
        </TabsList>
        <TabsContent value="overview" className="space-y-5">
          {canUseRoadmap && <LearningRoadmapSummary roadmap={roadmap.data} account={user.email}
            loading={roadmap.isPending} onView={() => setTab("roadmap")} />}
          <section className="space-y-3" aria-labelledby="my-enrolled-courses">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="my-enrolled-courses" className="font-semibold">My enrolled courses</h2>
              {activeRole === "STUDENT" && <Link className="text-sm text-primary hover:underline" to="/courses">Explore catalog</Link>}
            </div>
            <LearningRecordsPanel hideMetrics courseProgress={enrolled} />
          </section>
          <LearningInsightsPanel key={user.email} account={user.email} />
        </TabsContent>
        {canUseRoadmap && <TabsContent value="roadmap">
          <LearningRoadmapPanel key={user.email} account={user.email} roadmap={roadmap.data}
            loading={roadmap.isPending} error={roadmap.isError} reload={() => void roadmap.refetch()} />
        </TabsContent>}
        {canLearn && <TabsContent value="goals">
          <GoalsHabitsPanel key={user.email} account={user.email} roadmapHours={roadmap.data?.goal?.hoursPerWeek} />
        </TabsContent>}
        <TabsContent value="history"><LearningActivityCalendar activityData={null} /></TabsContent>
        {canLearn && <TabsContent value="reports">
          <LearningReportsPanel key={user.email} account={user.email} />
        </TabsContent>}
      </Tabs>
    </div>
  </MainLayout>;
}
export default MyLearningPage;
