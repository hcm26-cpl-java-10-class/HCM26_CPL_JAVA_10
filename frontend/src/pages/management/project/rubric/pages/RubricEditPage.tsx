import { rubricApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SaveRubricDraftRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { RubricForm } from "../components/RubricForm";

export function RubricEditPage() {
  const { rubricId, versionId } = useParams<{ rubricId: string; versionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["rubrics", rubricId], queryFn: () => rubricApi.getDetail(rubricId!), enabled: Boolean(rubricId) });
  const mutation = useMutation({ mutationFn: (payload: SaveRubricDraftRequest) => rubricApi.updateDraft(rubricId!, versionId!, payload), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["rubrics"] }); toast.success("Rubric draft saved."); navigate(`/rubrics/${rubricId}`); }, onError: (error: any) => toast.error(error?.response?.data?.message || "Could not save rubric draft.") });
  const version = query.data?.versions.find((item) => item.id === versionId);
  const back = () => navigate(rubricId ? `/rubrics/${rubricId}` : "/rubrics");
  if (query.isLoading) return <MainLayout pathName={{ rubrics: "Rubrics", edit: "Edit" }}><div className="p-8 text-center">Loading rubric…</div></MainLayout>;
  if (!version || version.status !== "DRAFT") return <MainLayout pathName={{ rubrics: "Rubrics", edit: "Edit" }}><Alert variant="destructive"><AlertCircle /><AlertTitle>Draft is not editable</AlertTitle><AlertDescription className="mt-2">Only an existing draft version can be changed.<div><Button className="mt-3" variant="outline" onClick={back}>Back to rubric</Button></div></AlertDescription></Alert></MainLayout>;
  const initial: SaveRubricDraftRequest = { name: version.name, description: version.description ?? undefined, criteria: version.criteria.map(({ code, name, description, weight, maxScore, orderIndex, ratings }) => ({ code, name, description: description ?? undefined, weight, maxScore, orderIndex, ratings: ratings.map(({ level, description: ratingDescription }) => ({ level, description: ratingDescription })) })) };
  return <MainLayout pathName={{ rubrics: "Rubrics", [rubricId!]: query.data?.name ?? "Rubric", edit: `Edit v${version.versionNumber}` }}><div className="mx-auto w-full max-w-6xl"><div className="mb-5"><h1 className="text-2xl font-semibold">Edit {version.name} · v{version.versionNumber}</h1><p className="mt-1 text-sm text-muted-foreground">Changes are allowed until this version is published.</p></div><RubricForm initialValue={initial} submitting={mutation.isPending} onSubmit={(payload) => mutation.mutate(payload)} onCancel={back} /></div></MainLayout>;
}
