import { Link } from "react-router-dom";
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
import type { Enrollment } from "@/types";

// A target ID is used only by User Detail. Personal callers always use /learning/me.
export function LearningRecordsPanel({
  userId,
  compact = false,
}: {
  userId?: string;
  compact?: boolean;
}) {
  const { email } = useSelector((state: RootState) => state.auth);

  const query = useQuery({
    queryKey: userId ? ["admin-learning", email, userId] : ["personal-learning", email],
    queryFn: () => (userId ? learningApi.forUser(userId) : learningApi.mine()),
    retry: false,
  });

  if (query.isPending) {
    return <p role="status" className="text-sm text-muted-foreground">Loading learning records...</p>;
  }
  if (query.isError) {
    return <div role="alert" className="space-y-3 text-sm text-destructive">
      <p>Learning records could not be loaded.</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Retry</Button>
    </div>;
  }

  const backendRecords = query.data;
  const allEnrolled: Enrollment[] = backendRecords.enrolledCourses;
  // The current enrollment contract has no per-course progress/completion evidence.
  const inProgressList: Enrollment[] = [];
  const completedList: Enrollment[] = [];
  const inProgressCourses = backendRecords.inProgressCourses;
  const completedCourses = backendRecords.completedCourses;
  const calculatedOverallProgress = backendRecords.overallProgress;

  const metrics = [
    ["Enrolled courses", allEnrolled.length],
    ["In-progress courses", inProgressCourses],
    ["Completed courses", completedCourses],
    [
      "Overall progress",
      calculatedOverallProgress == null ? null : `${calculatedOverallProgress}%`,
    ],
  ];

  return (
    <div className="space-y-5">
      {/* 4 Top Metric Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Card key={String(label)} className="py-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-lg font-semibold text-blue-700 dark:text-blue-400">
                {value ?? "Not available"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {compact ? (
        allEnrolled.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground space-y-2">
            <p>You have no course enrollments yet.</p>
            <Link
              to="/courses"
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 inline-block"
            >
              Explore Courses &amp; Enroll &rarr;
            </Link>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Overall Curriculum Progress Bar */}
            {calculatedOverallProgress !== null && (
              <div className="rounded-lg border border-slate-200 dark:border-zinc-800 p-3.5 bg-slate-50/50 dark:bg-zinc-900/50 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Overall Curriculum Progress</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {calculatedOverallProgress}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${calculatedOverallProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Compact Enrolled Courses List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-0.5">
                <span>Enrolled Courses &amp; Progress</span>
                <span>
                  {allEnrolled.length} {allEnrolled.length === 1 ? "course" : "courses"}
                </span>
              </div>
              {allEnrolled.slice(0, 4).map((course) => {
                return (
                  <div
                    key={course.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-bold text-foreground truncate max-w-full">
                          {course.courseName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {course.instructor && <span>By {course.instructor}</span>}
                        {course.instructor && <span>•</span>}
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Progress is not available
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-medium cursor-pointer"
                      >
                        <Link to="/my-learning">Continue</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
              {allEnrolled.length > 4 && (
                <div className="text-center pt-1">
                  <Link
                    to="/my-learning"
                    className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View all {allEnrolled.length} enrolled courses in My Learning &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        <Tabs defaultValue="enrolled" className="min-w-0">
          <TabsList
            variant="line"
            className="group-data-[orientation=horizontal]/tabs:h-auto w-full flex-wrap justify-start gap-x-3 gap-y-2 border-b pb-2"
          >
            <TabsTrigger value="enrolled">Enrolled ({allEnrolled.length})</TabsTrigger>
            <TabsTrigger value="in_progress">
              In Progress{inProgressList.length > 0 ? ` (${inProgressList.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed{completedList.length > 0 ? ` (${completedList.length})` : ""}
            </TabsTrigger>
            {!userId && <TabsTrigger value="saved">Saved</TabsTrigger>}
            <TabsTrigger value="certificates">Certificates &amp; Badges</TabsTrigger>
          </TabsList>

          <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-12">
            <div className="min-w-0 space-y-4 lg:col-span-8">
              {/* Enrolled Tab Content */}
              <TabsContent value="enrolled" className="mt-0 space-y-4">
                {allEnrolled.length === 0 ? (
                  <Card className="border-dashed shadow-xs">
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                      {userId
                        ? "This user has no course enrollments."
                        : "You have no course enrollments yet."}
                    </CardContent>
                  </Card>
                ) : (
                  allEnrolled.map((course) => (
                    <CourseCard key={course.id} course={enrollmentToCourse(course)} />
                  ))
                )}
              </TabsContent>

              {/* In Progress Tab Content */}
              <TabsContent value="in_progress" className="mt-0 space-y-4">
                {inProgressList.length > 0 ? (
                  inProgressList.map((course) => (
                    <CourseCard key={course.id} course={enrollmentToCourse(course)} />
                  ))
                ) : (
                  <Unavailable
                    title="In-progress courses"
                    text="Course progress tracking is not available. Enrollments are shown in the Enrolled tab."
                  />
                )}
              </TabsContent>

              {/* Completed Tab Content */}
              <TabsContent value="completed" className="mt-0 space-y-4">
                {completedList.length > 0 ? (
                  completedList.map((course) => (
                    <CourseCard key={course.id} course={enrollmentToCourse(course)} />
                  ))
                ) : (
                  <Unavailable
                    title="Completed courses"
                    text="Course completion records are not available."
                  />
                )}
              </TabsContent>

              {!userId && (
                <TabsContent value="saved" className="mt-0">
                  <Unavailable
                    title="Saved courses"
                    text="Saved course records are not available."
                  />
                </TabsContent>
              )}

              <TabsContent value="certificates" className="mt-0">
                <Unavailable
                  title="Certificates & Badges"
                  text="Certificate records are not available."
                />
              </TabsContent>
            </div>

            <aside className="min-w-0 space-y-6 lg:col-span-4" aria-label="Learning summary">
              <LearningActivityCalendar activityData={null} />
              <LearningStatisticsCard stats={null} />
              <RecentCertificatesSidebar certificates={null} onViewCertificate={() => {}} />
            </aside>
          </div>
        </Tabs>
      )}

      {calculatedOverallProgress === null ? (
        <p className="text-xs text-muted-foreground">
          Completion and progress tracking are not available for these enrollments.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Progress and course completion are automatically tracked for all your enrolled courses.
        </p>
      )}
    </div>
  );
}

function Unavailable({ title, text }: { title: string; text: string }) {
  return (
    <Card className="border-dashed shadow-xs">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
