import { questionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { initialQuestionForm, QuestionForm, type QuestionFormValues } from "../components/QuestionForm";

function getErrorMessage(error: any, fallback: string): string {
    const data = error?.response?.data;
    const firstFieldError = data?.errors ? (Object.values(data.errors).flat()[0] as string | undefined) : undefined;
    return firstFieldError || data?.message || fallback;
}

export function QuestionCreatePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const paramTopic = searchParams.get("topic") || "";

    const [form, setForm] = useState<QuestionFormValues>(() => ({
        ...initialQuestionForm,
        topic: paramTopic || initialQuestionForm.topic,
    }));

    const createMutation = useMutation({
        mutationFn: (payload: QuestionFormValues) =>
            questionApi.create({ ...payload, isActive: payload.isActive ?? true } as any),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["question"] });
            toast.success("Question created successfully.");
            const redirectUrl = form.topic ? `/questions?topic=${encodeURIComponent(form.topic)}` : "/questions";
            navigate(redirectUrl);
        },
        onError: (error: any) => {
            toast.error(getErrorMessage(error, "Create question failed."));
        },
    });

    return (
        <MainLayout pathName={{ questions: "Questions", create: "Create" }}>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Create Question</CardTitle>
                    <CardDescription>Create a new question with its options.</CardDescription>
                </CardHeader>
                <CardContent>
                    <QuestionForm
                        form={form}
                        setForm={setForm}
                        onSubmit={(values) => createMutation.mutate(values)}
                        isSaving={createMutation.isPending}
                        submitLabel="Save"
                        showActive={true}
                    />
                </CardContent>
            </Card>
        </MainLayout>
    );
}
