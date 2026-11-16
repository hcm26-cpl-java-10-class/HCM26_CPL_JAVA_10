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
  return <MainLayout mainClassName="bg-[#F8FAFC] dark:bg-slate-950" pathName={{ rubrics: "Rubrics", new: "Create" }}><div className="mx-auto w-full max-w-7xl"><div className="mb-4"><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Create rubric</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">The first version starts as a draft and must be published before milestones can use it.</p></div><RubricForm submitting={mutation.isPending} onSubmit={(payload) => mutation.mutate(payload)} onCancel={() => navigate("/rubrics")} /></div></MainLayout>;
}
