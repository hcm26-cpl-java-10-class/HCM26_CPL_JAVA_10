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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

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

    const gradeItems = course?.gradeItems ?? [];

    return (
        <MainLayout pathName={{ "my-scores": "My Scores" }}>
            <div className="space-y-6 p-4">
                <Button
                    variant="outline"
                    onClick={() => navigate("/my-scores")}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Course Scores
                </Button>

                <h1 className="text-2xl font-bold">
                    Course Grade Details
                </h1>

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
                        {/* Course Information */}
                            <Card>
                                <CardHeader>
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
                                </CardHeader>

                                <CardContent>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        {/* Overall Score */}
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                Overall Score
                                            </p>

                                            <p className="text-3xl font-semibold">
                                                {course.overallScore != null
                                                    ? course.overallScore.toFixed(1)
                                                    : "-"}
                                            </p>
                                        </div>

                                        {/* Status */}
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                Status
                                            </p>

                                            <div className="mt-2">
                                                {course.resultStatus ? (
                                                    <Badge
                                                        variant={
                                                            course.resultStatus === "PASSED"
                                                                ? "default"
                                                                : course.resultStatus === "FAILED"
                                                                    ? "destructive"
                                                                    : "outline"
                                                        }
                                                    >
                                                        {course.resultStatus}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-2xl font-semibold">
                                                    -
                                                </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                        {/* Grade Details */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Grade Details</CardTitle>
                                </CardHeader>

                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <Table className="[&_tbody_tr]:border-b-0">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Grade Category</TableHead>
                                                    <TableHead>Grade Item</TableHead>
                                                    <TableHead>Grade Weight</TableHead>
                                                    <TableHead>Value</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {gradeItems.map((item, index) => {
                                                    const currentCategory = item.gradeCategory?.trim() || "-";

                                                    const previousCategory =
                                                        index > 0
                                                            ? gradeItems[index - 1].gradeCategory?.trim() || "-"
                                                            : null;

                                                    const showCategory = currentCategory !== previousCategory;

                                                    return (
                                                        <TableRow
                                                            key={`${item.examId ?? item.gradeCategory}-${index}`}
                                                            className={
                                                                showCategory && index > 0
                                                                    ? "border-b-0 border-t-2 border-t-border"
                                                                    : "border-b-0 border-t-0"
                                                            }
                                                        >
                                                            <TableCell className="font-medium">
                                                                {showCategory ? currentCategory : ""}
                                                            </TableCell>

                                                            <TableCell>{item.gradeItem || "-"}</TableCell>

                                                            <TableCell>
                                                                {item.gradeWeight != null
                                                                    ? `${item.gradeWeight.toFixed(2)}%`
                                                                    : "-"}
                                                            </TableCell>

                                                            <TableCell>
                                                                {item.value != null ? item.value.toFixed(1) : "-"}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}

                                                {gradeItems.length === 0 && (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={4}
                                                            className="py-6 text-center text-muted-foreground"
                                                        >
                                                            No grade items available.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                    </>
                )}
            </div>
        </MainLayout>
    );
}
