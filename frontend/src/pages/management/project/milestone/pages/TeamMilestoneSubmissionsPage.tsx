import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { milestoneApi } from "@/api/features/milestone.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamMilestoneSubmissionsPage() {
  const { teamId: rawTeam, milestoneId = "" } = useParams(); const teamId = Number(rawTeam);
  const navigate = useNavigate(); const [params] = useSearchParams();
  const location = useLocation();
  const query = useQuery({ queryKey: ["team-milestone-submissions", teamId, milestoneId], queryFn: () => milestoneApi.getTeamArtifactSubmissions(teamId, milestoneId), enabled: teamId > 0 && !!milestoneId, refetchInterval: 20_000, retry: false });
  return <MainLayout pathName={{ milestones: "Milestones", [milestoneId]: "Submissions" }}><main className="mx-auto grid max-w-5xl gap-4">
    <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Milestone submissions</h1><Button variant="outline" onClick={() => navigate(`/management/workspaces/${params.get("workspaceId") ?? ""}?tab=milestones`)}>Back to workspace</Button></div>
    {query.isPending ? <p>Loading submissions...</p> : query.isError ? <Card><CardContent className="p-6">Could not load submissions. Please try again. <Button onClick={() => void query.refetch()}>Retry</Button></CardContent></Card> : query.data?.length === 0 ? <Card><CardContent className="p-6">No submissions have been received for this milestone yet.</CardContent></Card> : query.data?.map(({ submission, reviewSubmissionId, submitterId, submitterName, submitterEmail }) => <Card key={submission.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Version {submission.version} · {submission.status}</CardTitle><p>{submitterName || "Student"}{submitterEmail ? ` (${submitterEmail})` : ` · ${submitterId}`} · {new Date(submission.submittedAt).toLocaleString()}</p>{submission.submittedLate && <p className="text-amber-700">Submitted late{submission.latePenaltyPercent == null ? "" : ` · penalty ${submission.latePenaltyPercent}%`}</p>}</div>{reviewSubmissionId ? <Button onClick={() => navigate(`/milestone-submissions/${reviewSubmissionId}/review`, { state: { returnTo: `${location.pathname}${location.search}` } })}>Review submission</Button> : <Button disabled>Review unavailable</Button>}</div></CardHeader><CardContent className="grid gap-2 text-sm"><p><b>Repository:</b> {submission.repositoryUrl || "—"}</p><p><b>Deployment:</b> {submission.deploymentUrl || "—"}</p><p><b>Release notes:</b></p><p className="whitespace-pre-wrap">{submission.releaseNotes || "—"}</p><p><b>Attachments:</b> {submission.attachments.length}</p><p><b>Acceptance checklist:</b> Reviewer assessment pending</p></CardContent></Card>)}
  </main></MainLayout>;
}
