import { questionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { initialQuestionForm, QuestionForm, type QuestionFormValues } from "../components/QuestionForm";

function getErrorMessage(error: any, fallback: string): string {
    const data = error?.response?.data;
    const firstFieldError = data?.errors ? (Object.values(data.errors).flat()[0] as string | undefined) : undefined;
    return firstFieldError || data?.message || fallback;
}

export function QuestionCreatePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [form, setForm] = useState<QuestionFormValues>(initialQuestionForm);

    const createMutation = useMutation({
        mutationFn: (payload: QuestionFormValues) => questionApi.create(payload as any),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["question"] });
            toast.success("Question created successfully.");
            navigate("/questions");
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
                    />
                </CardContent>
            </Card>
        </MainLayout>
    );
}
