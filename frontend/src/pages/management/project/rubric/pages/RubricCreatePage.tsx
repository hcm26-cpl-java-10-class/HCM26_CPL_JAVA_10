import { rubricApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import type { SaveRubricDraftRequest } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RubricForm } from "../components/RubricForm";

const errorMessage = (error: any, fallback: string) => error?.response?.data?.message || fallback;

export function RubricCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: SaveRubricDraftRequest) => rubricApi.create(payload),
    onSuccess: async (rubric) => { await queryClient.invalidateQueries({ queryKey: ["rubrics"] }); toast.success("Rubric draft created."); navigate(`/rubrics/${rubric.id}`); },
    onError: (error) => toast.error(errorMessage(error, "Could not create rubric.")),
  });
  return <MainLayout pathName={{ rubrics: "Rubrics", new: "Create" }}><div className="mx-auto w-full max-w-6xl"><div className="mb-5"><h1 className="text-2xl font-semibold">Create rubric</h1><p className="mt-1 text-sm text-muted-foreground">The first version starts as a draft and must be published before milestones can use it.</p></div><RubricForm submitting={mutation.isPending} onSubmit={(payload) => mutation.mutate(payload)} onCancel={() => navigate("/rubrics")} /></div></MainLayout>;
}
