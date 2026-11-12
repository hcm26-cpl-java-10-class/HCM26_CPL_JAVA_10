import { COURSE_GRADE_STATUS_LABEL } from "@/types/features/course-my-scores";

import { courseApi } from "@/api/features/demo/course.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { examApi } from "@/api/features/exam.api";
import { Input } from "@/components/ui/input";
import {
  DateRangeFilter,
  EMPTY_RANGE,
  MyExamStatistics,
  effectiveRange,
  inRange,
  type DateRange,
} from "@/pages/student/components/MyExamStatistics";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function MyScoresPage() {
  const navigate = useNavigate();

  const {
    data: courseScores = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["my-course-scores"],
    queryFn: courseApi.getMyScores,
  });

  const { data: insights } = useQuery({
    queryKey: ["my-score-insights"],
    queryFn: () => examApi.getMyScoreInsights(),
  });

  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const enrolledAtByCourse = useMemo(
    () => new Map((insights?.courses ?? []).map((c) => [c.courseId, c.enrolledAt])),
    [insights],
  );

  const visibleScores = useMemo(() => {
    const applied = effectiveRange(range);
    const term = search.trim().toLowerCase();
    return courseScores.filter((course) => {
      const label = `${course.courseCode ?? ""} ${course.courseName}`.toLowerCase();
      return (
        label.includes(term) &&
        inRange(enrolledAtByCourse.get(course.courseId) ?? null, applied)
      );
    });
  }, [courseScores, search, range, enrolledAtByCourse]);

  return (
      <MainLayout pathName={{ "my-scores": "My Scores" }}>
        <div className="space-y-6 p-4">
          <h1 className="text-2xl font-bold">My Scores</h1>

          <Tabs defaultValue="course-scores" className="space-y-4">
            <TabsList className="w-full">
              <TabsTrigger value="statistics" className="flex-1">Statistics</TabsTrigger>
              <TabsTrigger value="course-scores" className="flex-1">Course Scores</TabsTrigger>
            </TabsList>

            <TabsContent value="statistics">
              <MyExamStatistics />
            </TabsContent>

            <TabsContent value="course-scores">
          <section className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <label htmlFor="course-scores-search" className="text-xs font-medium text-muted-foreground">
                  Search course
                </label>
                <Input
                  id="course-scores-search"
                  className="w-64"
                  placeholder="Course name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <DateRangeFilter value={range} onChange={setRange} idPrefix="course-scores-filter" />
            </div>

            {isLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading course scores...
                </p>
            )}

            {isError && (
                <p className="text-sm text-destructive">
                  Unable to load course scores.
                </p>
            )}

            {!isLoading && !isError && courseScores.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No course scores available.
                </p>
            )}

            {!isLoading && !isError && courseScores.length > 0 && visibleScores.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No course matches the current search or date filter.
                </p>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleScores.map((course) => (
                  <Card
                      key={course.courseId}
                      className="cursor-pointer transition-shadow hover:shadow-md"
                      onClick={() => navigate(`/my-scores/${course.courseId}`)}
                  >

                    <div className="flex items-start gap-4 p-4">
                      {/* Course thumbnail - 88x88 */}
                      <div className="h-[88px] w-[120px] shrink-0 overflow-hidden rounded-lg bg-muted">
                        {course.thumbnailUrl && (
                            <img
                                src={course.thumbnailUrl}
                                alt={course.courseName}
                                className="h-full w-full object-cover"
                            />
                        )}
                      </div>

                      {/* Course information */}
                      <div className="min-w-0 flex-1">
                        <CardHeader className="p-0 pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <CardTitle className="text-base">
                                {course.courseCode
                                    ? `${course.courseCode} - `
                                    : ""}
                                {course.courseName}
                              </CardTitle>

                              {course.className && (
                                  <CardDescription>
                                    Class: {course.className}
                                  </CardDescription>
                              )}
                            </div>

                            {course.resultStatus && (
                                <Badge
                                    variant={
                                      course.resultStatus === "PASSED"
                                          ? "default"
                                          : course.resultStatus === "FAILED" ? "destructive" : "outline"
                                    }
                                >
                                  {COURSE_GRADE_STATUS_LABEL[course.resultStatus] || course.resultStatus}
                                </Badge>
                            )}
                          </div>
                        </CardHeader>

                        <CardContent className="p-0">
                          <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          Overall Score
        </span>

                            <span className="text-2xl font-semibold">
          {course.overallScore != null
              ? course.overallScore.toFixed(1)
              : "-"}
        </span>
                          </div>
                        </CardContent>
                      </div>
                    </div>

                  </Card>
              ))}
            </div>
          </section>
            </TabsContent>
          </Tabs>
        </div>
      </MainLayout>
  );
}
