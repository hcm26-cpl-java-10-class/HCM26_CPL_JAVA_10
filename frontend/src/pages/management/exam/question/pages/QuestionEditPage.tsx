import { questionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuestionDTO, QuestionOptionDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { initialQuestionForm, QuestionForm, type QuestionFormValues } from "../components/QuestionForm";

function getErrorMessage(error: unknown, fallback: string): string {
    const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
    const data = err?.response?.data;
    const firstFieldError = data?.errors ? Object.values(data.errors).flat()[0] : undefined;
    return firstFieldError || data?.message || fallback;
}

export function QuestionEditPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { id } = useParams<{ id: string }>();

    const [form, setForm] = useState<QuestionFormValues>(initialQuestionForm);

    const questionQuery = useQuery<QuestionDTO>({
        queryKey: ["question", "detail", id],
        queryFn: async () => {
            const data = await questionApi.getById(id as string);
            setForm({
                content: data.content || "",
                type: data.type || "MULTIPLE_CHOICE",
                difficulty: data.difficulty || "EASY",
                topic: data.topic || "",
                points: data.points ?? 1,
                isActive: data.isActive ?? true,
                imageUrl: data.imageUrl || "",
                options: (data.options ?? []).map((option: QuestionOptionDTO) => ({
                    id: option.id,
                    content: option.content || "",
                    correct: !!option.correct,
                    imageUrl: option.imageUrl || null,
                })),
            });
            return data;
        },
        enabled: !!id,
    });

    const updateMutation = useMutation({
        mutationFn: (payload: QuestionFormValues) =>
            questionApi.update(id as string, {
                ...questionQuery.data,
                ...payload,
            } as any),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["question"] });
            toast.success("Question updated successfully.");
            navigate("/questions");
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Update question failed."));
        },
    });

    return (
        <MainLayout pathName={{ questions: "Questions", edit: "Edit" }}>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Edit Question</CardTitle>
                    <CardDescription>Update question #{id}.</CardDescription>
                </CardHeader>
                <CardContent>
                    {questionQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading question data...</p>
                    ) : questionQuery.isError ? (
                        <p className="text-sm text-destructive">
                            {getErrorMessage(questionQuery.error, "Unable to load question.")}
                        </p>
                    ) : (
                        <QuestionForm
                            form={form}
                            setForm={setForm}
                            onSubmit={(values) => updateMutation.mutate(values)}
                            isSaving={updateMutation.isPending}
                            submitLabel="Save changes"
                            showActive
                        />
                    )}
                </CardContent>
            </Card>
        </MainLayout>
    );
}