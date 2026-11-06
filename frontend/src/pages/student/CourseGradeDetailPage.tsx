import { courseApi } from "@/api/features/demo/course.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

export default function CourseGradeDetailPage() {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();

    const id = Number(courseId);
    const isValidId = Number.isSafeInteger(id) && id > 0;

    const {
        data: courseScores = [],
        isLoading,
        isError,
    } = useQuery({
        queryKey: ["my-course-scores"],
        queryFn: courseApi.getMyScores,
        enabled: isValidId,
    });

    const course = courseScores.find(
        (item) => item.courseId === id
    );

    return (
        <MainLayout pathName={{ "my-scores": "My Scores" }}>
            <div className="space-y-6 p-4">
                <div>
                    <Button
                        variant="outline"
                        onClick={() => navigate("/my-scores")}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Course Scores
                    </Button>
                </div>

                <h1 className="text-2xl font-bold">Course Grade Details</h1>

                {!isValidId && (
                    <p className="text-sm text-destructive">
                        Invalid course ID.
                    </p>
                )}

                {isValidId && isLoading && (
                    <p className="text-sm text-muted-foreground">
                        Loading course details...
                    </p>
                )}

                {isValidId && isError && (
                    <p className="text-sm text-destructive">
                        Unable to load course details.
                    </p>
                )}

                {isValidId && !isLoading && !isError && !course && (
                    <p className="text-sm text-muted-foreground">
                        Course not found.
                    </p>
                )}

                {course && (
                    <>
                        <Card>
                            <CardHeader>
                                <div className="flex flex-wrap items-start justify-between gap-4">
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
                                <p className="text-sm text-muted-foreground">
                                    Overall Score
                                </p>

                                <p className="text-3xl font-semibold">
                                    {course.overallScore != null
                                        ? course.overallScore.toFixed(1)
                                        : "-"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Grade Details</CardTitle>
                            </CardHeader>

                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                        <tr className="border-b text-left">
                                            <th className="px-4 py-3">Grade Category</th>
                                            <th className="px-4 py-3">Grade Item</th>
                                            <th className="px-4 py-3">Grade Weight</th>
                                            <th className="px-4 py-3">Value</th>
                                        </tr>
                                        </thead>

                                        <tbody>
                                        {course.gradeItems.map((item, index) => (
                                            <tr
                                                key={`${item.examId ?? item.gradeCategory}-${index}`}
                                                className="border-b"
                                            >
                                                <td className="px-4 py-3">
                                                    {item.gradeCategory}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {item.gradeItem ?? ""}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {item.gradeWeight != null
                                                        ? `${item.gradeWeight.toFixed(2)}%`
                                                        : ""}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {item.value != null
                                                        ? item.value.toFixed(1)
                                                        : ""}
                                                </td>
                                            </tr>
                                        ))}

                                        {course.gradeItems.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={4}
                                                    className="px-4 py-6 text-center text-muted-foreground"
                                                >
                                                    No grade items available.
                                                </td>
                                            </tr>
                                        )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </MainLayout>
    );
}
