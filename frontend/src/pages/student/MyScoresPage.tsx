
import { courseApi } from "@/api/features/demo/course.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
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

  return (
      <MainLayout pathName={{ "my-scores": "My Scores" }}>
        <div className="space-y-6 p-4">
          <h1 className="text-2xl font-bold">My Scores</h1>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Course Scores</h2>

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

            <div className="grid gap-4 md:grid-cols-2">
              {courseScores.map((course) => (
                  <Card
                      key={course.courseId}
                      className="cursor-pointer transition-shadow hover:shadow-md"
                      onClick={() => navigate(`/my-scores/${course.courseId}`)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle>
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
                                      : "destructive"
                                }
                            >
                              {course.resultStatus}
                            </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="flex items-center justify-between">
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
                  </Card>
              ))}
            </div>
          </section>
        </div>
      </MainLayout>
  );
}
