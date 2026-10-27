import { questionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { PermissionGate } from "@/components/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PenSquare } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

function getErrorMessage(error: any, fallback: string): string {
    return error?.response?.data?.message || fallback;
}

export function QuestionDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const questionQuery = useQuery({
        queryKey: ["question", "detail", id],
        queryFn: () => questionApi.getById(id as string),
        enabled: !!id,
    });
    const data = questionQuery.data;

    return (
        <MainLayout pathName={{ questions: "Questions", detail: "Detail" }}>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Question Detail</CardTitle>
                    <CardDescription>Detailed information for question #{id}.</CardDescription>
                </CardHeader>

                {questionQuery.isLoading ? (
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Loading question detail...</p>
                    </CardContent>
                ) : questionQuery.isError ? (
                    <CardContent>
                        <p className="text-sm text-destructive">
                            {getErrorMessage(questionQuery.error, "Unable to load question detail.")}
                        </p>
                    </CardContent>
                ) : (
                    <CardContent className="grid gap-4 text-sm">
                        <div className="grid gap-1">
                            <span className="font-medium text-muted-foreground">Content</span>
                            <p className="text-base font-semibold leading-6">{data?.content || "-"}</p>
                            {data?.imageUrl && <img src={data.imageUrl} alt="" className="mt-2 max-h-48 rounded border object-contain" />}
                        </div>

                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div className="grid gap-1">
                                <span className="font-medium text-muted-foreground">Type</span>
                                <span>{data?.type || "-"}</span>
                            </div>
                            <div className="grid gap-1">
                                <span className="font-medium text-muted-foreground">Difficulty</span>
                                <span>{data?.difficulty || "-"}</span>
                            </div>
                            <div className="grid gap-1">
                                <span className="font-medium text-muted-foreground">Topic</span>
                                <span>{data?.topic || "-"}</span>
                            </div>
                            <div className="grid gap-1">
                                <span className="font-medium text-muted-foreground">Points</span>
                                <span>{data?.points ?? "-"}</span>
                            </div>
                        </div>

                        <div className="grid gap-1">
                            <span className="font-medium text-muted-foreground">Status</span>
                            <div>
                                <Badge variant={data?.isActive ? "default" : "secondary"}>
                                    {data?.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <span className="font-medium text-muted-foreground">Options</span>
                            {(data?.options ?? []).map((option: any, index: number) => (
                                <div key={option.id ?? index} className="flex items-center gap-2">
                                    <span>{option.content}</span>
                                    {option.correct && <Badge>Correct</Badge>}
                                </div>
                            ))}
                        </div>
                        {data?.type === "ESSAY" && (
                            <div className="grid gap-2">
                                <span className="font-medium text-muted-foreground">Grading Criteria</span>
                                {(data.gradingCriteria ?? []).length === 0 ? (
                                    <span className="text-muted-foreground">No criteria defined.</span>
                                ) : (
                                    (data.gradingCriteria ?? []).map((criterion, index) => (
                                        <div key={`${criterion.name}-${index}`} className="rounded border p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="font-medium">{criterion.name}</span>
                                                <Badge variant="outline">{criterion.weightPercentage}%</Badge>
                                            </div>
                                            {criterion.description && (
                                                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                                    {criterion.description}
                                                </p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </CardContent>
                )}

                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => navigate("/questions")}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <PermissionGate permission="QUESTION_UPDATE">
                        <Button asChild>
                            <Link to={`/questions/${id}/edit`}>
                                <PenSquare className="h-4 w-4" />
                                Edit
                            </Link>
                        </Button>
                    </PermissionGate>
                </CardFooter>
            </Card>
        </MainLayout>
    );
}
