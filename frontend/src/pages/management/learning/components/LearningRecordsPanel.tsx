import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseCard } from "./CourseCard";
import { LearningActivityCalendar } from "./LearningActivityCalendar";
import { LearningStatisticsCard } from "./LearningStatisticsCard";
import { RecentCertificatesSidebar } from "./RecentCertificatesSidebar";
import { enrollmentToCourse } from "../learning-records.utils";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { learningApi } from "@/api/features/learning.api";
import type { RootState } from "@/store/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// A target ID is used only by User Detail. Personal callers always use /learning/me.
export function LearningRecordsPanel({ userId, compact = false }: { userId?: string; compact?: boolean }) {
  const { email } = useSelector((state: RootState) => state.auth);
  const query = useQuery({
    queryKey: userId ? ["admin-learning", email, userId] : ["personal-learning", email],
    queryFn: () => userId ? learningApi.forUser(userId) : learningApi.mine(),
  });
  if (query.isPending) return <p role="status" className="text-sm text-muted-foreground">Loading learning records...</p>;
  if (query.isError) return <div role="alert" className="space-y-3 text-sm text-destructive">
    <p>Learning records could not be loaded.</p>
    <Button variant="outline" onClick={() => void query.refetch()}>Retry</Button>
  </div>;
  const records = query.data;
  const metrics = [
    ["Enrolled courses", records.enrolledCourses.length],
    ["In-progress courses", records.inProgressCourses],
    ["Completed courses", records.completedCourses],
    ["Overall progress", records.overallProgress == null ? null : `${records.overallProgress}%`],
  ];
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map(([label, value]) => <Card key={String(label)} className="py-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-2 text-lg font-semibold text-blue-700 dark:text-blue-400">{value ?? "Not available"}</p>
        </CardContent>
      </Card>)}
    </div>
    {compact ? (records.enrolledCourses.length === 0 && <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">You have no course enrollments yet.</p>) : <Tabs defaultValue="enrolled" className="min-w-0">
      <TabsList variant="line" className="group-data-[orientation=horizontal]/tabs:h-auto w-full flex-wrap justify-start gap-x-3 gap-y-2 border-b pb-2">
        <TabsTrigger value="enrolled">Enrolled ({records.enrolledCourses.length})</TabsTrigger>
        <TabsTrigger value="in_progress">In Progress</TabsTrigger>
        <TabsTrigger value="completed">Completed</TabsTrigger>
        {!userId && <TabsTrigger value="saved">Saved</TabsTrigger>}
        <TabsTrigger value="certificates">Certificates &amp; Badges</TabsTrigger>
      </TabsList>
      <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <TabsContent value="enrolled" className="mt-0 space-y-4">
            {records.enrolledCourses.length === 0 ? <Card className="border-dashed shadow-xs"><CardContent className="p-8 text-center text-sm text-muted-foreground">
              {userId ? "This user has no course enrollments." : "You have no course enrollments yet."}
            </CardContent></Card> : records.enrolledCourses.map(course => <CourseCard key={course.id} course={enrollmentToCourse(course)} />)}
          </TabsContent>
          <TabsContent value="in_progress" className="mt-0"><Unavailable title="In-progress courses" text="Course progress tracking is not available. Enrollments are shown in the Enrolled tab." /></TabsContent>
          <TabsContent value="completed" className="mt-0"><Unavailable title="Completed courses" text="Course completion records are not available." /></TabsContent>
          {!userId && <TabsContent value="saved" className="mt-0"><Unavailable title="Saved courses" text="Saved course records are not available." /></TabsContent>}
          <TabsContent value="certificates" className="mt-0"><Unavailable title="Certificates & Badges" text="Certificate records are not available." /></TabsContent>
        </div>
        <aside className="min-w-0 space-y-6 lg:col-span-4" aria-label="Learning summary">
          <LearningActivityCalendar activityData={null} />
          <LearningStatisticsCard stats={null} />
          <RecentCertificatesSidebar certificates={null} onViewCertificate={() => {}} />
        </aside>
      </div>
    </Tabs>}
    <p className="text-xs text-muted-foreground">Completion and progress tracking are not available for these enrollments.</p>
  </div>;
}

function Unavailable({ title, text }: { title: string; text: string }) {
  return <Card className="border-dashed shadow-xs"><CardHeader><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent className="text-sm text-muted-foreground">{text}</CardContent></Card>;
}
