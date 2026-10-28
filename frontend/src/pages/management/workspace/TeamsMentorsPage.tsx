import { projectHubApi } from "@/api/features/project-hub.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import type { ProjectMentor, ProjectTeam } from "@/types/features/project-hub";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, BookOpen, Loader2, RefreshCw, Save, Search, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { TeamCharterForm } from "./TeamCharterForm";
import { getWorkspaceError, WorkspaceEmptyState } from "./workspace.shared";

export default function TeamsMentorsPage() {
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState("");
  const [cohort, setCohort] = useState("all");
  const [charterTeam, setCharterTeam] = useState<ProjectTeam | null>(null);
  const canAssign = hasPermission("TEAM_UPDATE");
  const query = useQuery({ queryKey: ["project-teams"], queryFn: projectHubApi.getTeams });
  const mentorsQuery = useQuery({ queryKey: ["project-mentors"], queryFn: projectHubApi.getMentors, enabled: canAssign, retry: false });
  const teams = query.data ?? [];
  const cohorts = [...new Map(teams.filter(team => team.cohortId != null).map(team => [String(team.cohortId), team.cohortName ?? `Cohort #${team.cohortId}`])).entries()];
  const filtered = teams.filter(team => (cohort === "all" || String(team.cohortId) === cohort) && `${team.name} ${team.projectName} ${team.mentorName ?? ""}`.toLocaleLowerCase("en").includes(search.trim().toLocaleLowerCase("en")));
  return <MainLayout pathName={{ management: "Management", "project-teams": "Teams & Mentors" }}><div className="space-y-5"><Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-2"><CardTitle>Teams & Mentors</CardTitle><CardDescription>Review team members, assign mentors and agree on working rules.</CardDescription></div><div className="flex gap-2"><Button variant="outline" asChild><Link to="/management/workspaces/candidates"><ArrowLeft />Workspace</Link></Button><Button variant="outline" disabled={query.isFetching} onClick={() => { void query.refetch(); if (canAssign) void mentorsQuery.refetch(); }}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />Refresh</Button></div></div></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-3"><div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search teams or mentors" className="pl-9" placeholder="Search teams, projects or mentors..." value={search} onChange={event => setSearch(event.target.value)} /></div><Select value={cohort} onValueChange={setCohort}><SelectTrigger className="w-full sm:w-56" aria-label="Filter teams by cohort"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All cohorts</SelectItem>{cohorts.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-wrap gap-2"><Badge variant="outline">{filtered.length} teams</Badge><Badge variant="secondary">{filtered.filter(team => !team.mentorId).length} teams without a mentor</Badge></div></CardContent></Card>
    {mentorsQuery.isError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to load mentors</AlertTitle><AlertDescription>{getWorkspaceError(mentorsQuery.error)}<Button variant="outline" size="sm" onClick={() => void mentorsQuery.refetch()}>Try again</Button></AlertDescription></Alert>}
    {query.isLoading ? <Card><CardContent className="flex justify-center gap-2 py-16"><Loader2 className="size-4 animate-spin" />Loading teams...</CardContent></Card> : query.isError ? <Card><WorkspaceEmptyState icon={AlertCircle} title="Unable to load teams" description={getWorkspaceError(query.error)} action={<Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>} /></Card> : !filtered.length ? <Card><WorkspaceEmptyState icon={Users} title="No matching teams" description="Existing teams appear here when you have access to them." /></Card> : <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map(team => <TeamCard key={`${team.id}:${team.mentorId ?? "none"}`} team={team} mentors={mentorsQuery.data ?? []} canAssign={canAssign} mentorsReady={mentorsQuery.isSuccess} onCharter={() => setCharterTeam(team)} />)}</div>}
    <Dialog open={!!charterTeam} onOpenChange={open => { if (!open) setCharterTeam(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Team charter · {charterTeam?.name}</DialogTitle><DialogDescription>The team's shared goals and working rules.</DialogDescription></DialogHeader>{charterTeam && <TeamCharterForm key={charterTeam.id} teamId={charterTeam.id} initial={charterTeam.charter} />}</DialogContent></Dialog>
  </div></MainLayout>;
}

function TeamCard({ team, mentors, canAssign, mentorsReady, onCharter }: { team: ProjectTeam; mentors: ProjectMentor[]; canAssign: boolean; mentorsReady: boolean; onCharter: () => void }) {
  const queryClient = useQueryClient();
  const [mentorId, setMentorId] = useState(team.mentorId ? String(team.mentorId) : "none");
  const changed = mentorId !== (team.mentorId ? String(team.mentorId) : "none");
  const save = useMutation({ mutationFn: () => projectHubApi.assignMentor(team.id, mentorId === "none" ? null : Number(mentorId)), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["project-teams"] }), queryClient.invalidateQueries({ queryKey: ["workspace-detail"] }), queryClient.invalidateQueries({ queryKey: ["workspace-candidates"] })]); toast.success(`Mentor assignment saved for ${team.name}`); } });
  return <Card><CardHeader><div className="flex items-start justify-between gap-3"><CardTitle className="leading-6">{team.name}</CardTitle><Badge variant="outline">{team.members.length} members</Badge></div><CardDescription>{team.projectName ?? "No project"} · {team.cohortName ?? "Not assigned"}</CardDescription><Badge variant={team.mentorId ? "secondary" : "outline"}>{team.mentorId ? "Mentor assigned" : "No mentor assigned"}</Badge></CardHeader><CardContent className="space-y-4"><div className="min-h-28 space-y-3 border-y py-4">{team.members.length ? team.members.map(member => <div key={member.id} className="flex min-w-0 items-center gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{member.name.split(/\s+/).map(word => word[0]).slice(0, 2).join("")}</div><div className="min-w-0"><p className="text-sm font-medium">{member.name}</p><p className="truncate text-xs text-muted-foreground">{member.email}</p></div></div>) : <p className="text-sm text-muted-foreground">No team members yet.</p>}</div><div className="space-y-2"><Label htmlFor={`mentor-${team.id}`}>Mentor</Label>{canAssign ? <Select value={mentorId} onValueChange={setMentorId} disabled={!mentorsReady || save.isPending}><SelectTrigger id={`mentor-${team.id}`} className="w-full"><SelectValue placeholder="Select a mentor" /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{team.mentorId && !mentors.some(mentor => mentor.id === team.mentorId) && <SelectItem value={String(team.mentorId)} disabled>{team.mentorName} (unavailable)</SelectItem>}{mentors.map(mentor => <SelectItem key={mentor.id} value={String(mentor.id)}>{mentor.name} · {mentor.email}</SelectItem>)}</SelectContent></Select> : <p className="text-sm">{team.mentorName ?? "No mentor assigned"}</p>}</div>{save.isError && <Alert variant="destructive"><AlertCircle /><AlertDescription>{getWorkspaceError(save.error)}</AlertDescription></Alert>}<div className="flex flex-wrap justify-between gap-2"><Button variant="outline" size="sm" onClick={onCharter}><BookOpen />Team charter</Button>{canAssign && <Button size="sm" disabled={!changed || !mentorsReady || save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save assignment</Button>}</div></CardContent></Card>;
}
