import { COURSE_GRADE_STATUS_LABEL } from "@/types/features/course-my-scores";
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
import { ArrowLeft, ExternalLink } from "lucide-react";
import { examApi } from "@/api/features/exam.api";
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

    const {
        data: publishedScores = [],
    } = useQuery({
        queryKey: ["my-published-exam-scores"],
        queryFn: examApi.getMyPublishedExamScores,
        enabled: isValidId,
    });

    const course = courseScores.find(
        (item) => item.courseId === id
    );

    const gradeItems = course?.gradeItems ?? [];

    const bestAttemptByExam = new Map<
        number,
        (typeof publishedScores)[number]
    >();

    for (const attempt of publishedScores) {
        if (
            attempt.examId == null ||
            attempt.attemptId == null ||
            attempt.finalScore == null ||
            attempt.submittedAt == null ||
            !attempt.resultPublished
        ) {
            continue;
        }

        const current = bestAttemptByExam.get(attempt.examId);

        const attemptScore = attempt.finalScore;
        const currentScore = current?.finalScore;

        const attemptTime = Date.parse(attempt.submittedAt);
        const currentTime = current
            ? Date.parse(current.submittedAt)
            : 0;

        const isBetter =
            !current ||
            currentScore == null ||
            (
                attemptScore != null &&
                (
                    attemptScore > currentScore ||
                    (
                        attemptScore === currentScore &&
                        attemptTime > currentTime
                    ) ||
                    (
                        attemptScore === currentScore &&
                        attemptTime === currentTime &&
                        attempt.attemptNumber > current.attemptNumber
                    )
                )
            );

        if (isBetter) {
            bestAttemptByExam.set(attempt.examId, attempt);
        }
    }

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
                                                        {COURSE_GRADE_STATUS_LABEL[course.resultStatus] || course.resultStatus}
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

                                                    console.log({
                                                        index,
                                                        currentCategory,
                                                        previousCategory,
                                                        showCategory,
                                                    });

                                                    return (
                                                        <TableRow
                                                            key={`${item.examId ?? item.gradeCategory}-${index}`}
                                                            className={
                                                                showCategory && index > 0
                                                                    ? "!border-t-2 !border-t-solid !border-t-muted-foreground/10 border-b-0"
                                                                    : "border-0"
                                                            }
                                                        >
                                                            <TableCell className="font-medium">
                                                                {showCategory ? currentCategory : ""}
                                                            </TableCell>

                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <span>{item.gradeItem || "-"}</span>

                                                                    {(() => {
                                                                        const attempt =
                                                                            item.examId != null
                                                                                ? bestAttemptByExam.get(item.examId)
                                                                                : undefined;

                                                                        return item.value != null && attempt ? (
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 shrink-0"
                                                                                aria-label="Review exam"
                                                                                title="Review Exam"
                                                                                onClick={() =>
                                                                                    window.open(
                                                                                        `/student/exams/attempts/${attempt.attemptId}/review`,
                                                                                        "_blank",
                                                                                        "noopener,noreferrer"
                                                                                    )
                                                                                }
                                                                            >
                                                                                <ExternalLink className="h-4 w-4" />
                                                                            </Button>
                                                                        ) : null;
                                                                    })()}
                                                                </div>
                                                            </TableCell>

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
