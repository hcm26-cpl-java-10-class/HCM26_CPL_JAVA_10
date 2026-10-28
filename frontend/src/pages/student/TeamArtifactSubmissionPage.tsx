import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { milestoneApi } from "@/api/features/milestone.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export default function TeamArtifactSubmissionPage() {
  const { teamId: rawTeamId, milestoneId = "" } = useParams();
  const teamId = Number(rawTeamId); const navigate = useNavigate(); const qc = useQueryClient();
  const [repositoryUrl, setRepositoryUrl] = useState(""); const [deploymentUrl, setDeploymentUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState(""); const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const submitKey = useRef<string | null>(null);
  const query = useQuery({ queryKey: ["team-artifact-workspace", teamId, milestoneId], queryFn: () => milestoneApi.getTeamArtifactWorkspace(teamId, milestoneId), enabled: teamId > 0 && !!milestoneId, retry: false });
  useEffect(() => { const d = query.data?.draft; if (!query.data) return; setRepositoryUrl(d?.repositoryUrl ?? ""); setDeploymentUrl(d?.deploymentUrl ?? ""); setReleaseNotes(d?.releaseNotes ?? ""); setChecklist(Object.fromEntries(query.data.milestone.checklist.map(x => [x.id, d?.checklist[x.id] ?? false]))); }, [query.data]);
  const save = useMutation({ mutationFn: () => milestoneApi.saveTeamArtifactDraft(teamId, milestoneId, { repositoryUrl, deploymentUrl, releaseNotes, checklist, expectedVersion: query.data?.draft?.version }), onSuccess: () => qc.invalidateQueries({ queryKey: ["team-artifact-workspace", teamId, milestoneId] }) });
  const submit = useMutation({ mutationFn: () => milestoneApi.submitTeamArtifact(teamId, milestoneId, { repositoryUrl, deploymentUrl, releaseNotes, checklist, attachmentIds: [] }, submitKey.current ?? (submitKey.current = crypto.randomUUID())), onSuccess: () => { submitKey.current = null; return qc.invalidateQueries({ queryKey: ["team-artifact-workspace", teamId, milestoneId] }); } });
  const edited = () => { submitKey.current = null; if (submit.isError) submit.reset(); };
  if (query.isPending) return <MainLayout pathName={{ milestones: "Milestone", submit: "Submit artifact" }}><p>Loading milestone...</p></MainLayout>;
  if (!query.data) return <MainLayout pathName={{ milestones: "Milestone", submit: "Submit artifact" }}><Card><CardContent className="p-6">Could not load milestone or you do not have access. <Button onClick={() => void query.refetch()}>Retry</Button></CardContent></Card></MainLayout>;
  const m = query.data.milestone;
  return <MainLayout pathName={{ milestones: "Milestone", [m.id]: m.title, submit: "Submit artifact" }}><main className="mx-auto grid max-w-4xl gap-4">
    <Card><CardHeader><CardTitle>{m.title}</CardTitle><p>Deadline: {new Date(m.deadline).toLocaleString()}</p></CardHeader><CardContent className="grid gap-3"><p className="text-sm text-muted-foreground">Acceptance checklist is assessed by the reviewer after submission.</p>{m.checklist.map(item => <div className="flex items-center gap-2" key={item.id}><Checkbox disabled checked={false} aria-label={`${item.content} — reviewer assessment`} />{item.content}</div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Prepare artifact</CardTitle></CardHeader><CardContent className="grid gap-3"><Input placeholder="Repository URL" value={repositoryUrl} onChange={e => { edited(); setRepositoryUrl(e.target.value); }}/><Input placeholder="Deployment URL" value={deploymentUrl} onChange={e => { edited(); setDeploymentUrl(e.target.value); }}/><Textarea placeholder="Release notes" value={releaseNotes} onChange={e => { edited(); setReleaseNotes(e.target.value); }}/><p className="text-sm text-muted-foreground">File upload is unavailable until the Team upload policy and scanner are configured.</p>
      {m.status !== "OPEN" && <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">This milestone is {m.status}. You can save a draft now, but submissions are accepted only while it is OPEN.</p>}
      {query.data.latestSubmission && <p>Latest submitted version: {query.data.latestSubmission.version} · {new Date(query.data.latestSubmission.submittedAt).toLocaleString()}</p>}
      {save.isError && <p className="text-destructive">Draft could not be saved. Your entries are still here.</p>}{submit.isError && <p className="text-destructive">Submission failed. Check the URLs and milestone late policy, then retry.</p>}{submit.isSuccess && <p className="text-green-700">Version {submit.data.version} submitted successfully.</p>}
      <div className="flex gap-2"><Button variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving..." : "Save draft"}</Button><Button disabled={submit.isPending || save.isPending || m.status !== "OPEN"} onClick={() => submit.mutate()}>{submit.isPending ? "Submitting..." : "Review & submit"}</Button><Button variant="ghost" onClick={() => navigate(-1)}>Back</Button></div>
    </CardContent></Card>
  </main></MainLayout>;
}
