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
            <div className="flex flex-col h-[calc(100vh-6.5rem)]">
                <Card className="flex flex-col flex-1 min-h-0 overflow-hidden shadow-sm">
                    <CardHeader className="shrink-0 border-b pb-3 bg-muted/10">
                        <CardTitle>Create Question</CardTitle>
                        <CardDescription>Create a new question with its options.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
                        <QuestionForm
                            form={form}
                            setForm={setForm}
                            onSubmit={(values) => createMutation.mutate(values)}
                            isSaving={createMutation.isPending}
                            submitLabel="Save"
                            showActive={true}
                            fillHeight
                        />
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
