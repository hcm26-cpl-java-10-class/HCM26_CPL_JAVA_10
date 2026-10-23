import { workspaceApi } from "@/api/features/workspace.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import type { WorkspaceCandidateItem } from "@/types/features/workspace";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, FolderOpen, Loader2, Plus, RefreshCw, Search, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getWorkspaceError, workspaceIneligibleReason, WorkspaceEmptyState, WorkspaceStatusBadge } from "./workspace.shared";

import { WorkspaceCreateDialog } from "./WorkspaceCreateDialog";

export default function WorkspaceCandidatePage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [createFor, setCreateFor] = useState<WorkspaceCandidateItem | null | undefined>(undefined);
  const canCreate = hasPermission("WORKSPACE_CREATE");
  const search = params.get("search") ?? "";
  const cohort = params.get("cohort") ?? "all";
  const workspaceState = params.get("workspace") ?? "all";
  const size = [10, 20, 50, 100].includes(Number(params.get("size"))) ? Number(params.get("size")) : 10;
  const query = useQuery({ queryKey: ["workspace-candidates"], queryFn: workspaceApi.getCandidates });
  const candidates = query.data ?? [];
  const cohorts = useMemo(() => [...new Map(candidates.filter(row => row.cohortId != null).map(row => [String(row.cohortId), row.cohortName ?? `Cohort #${row.cohortId}`])).entries()], [candidates]);
  const filtered = useMemo(() => candidates.filter(row => {
    const matchesSearch = `${row.projectName} ${row.projectCode} ${row.teamName} ${row.teamCode}`.toLocaleLowerCase("en").includes(search.trim().toLocaleLowerCase("en"));
    return matchesSearch && (cohort === "all" || String(row.cohortId) === cohort)
      && (workspaceState === "all" || (workspaceState === "created" ? !!row.workspaceId : !row.workspaceId));
  }), [candidates, search, cohort, workspaceState]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(Math.max(1, Number(params.get("page")) || 1), pageCount);
  const rows = filtered.slice((page - 1) * size, page * size);
  const hasFilters = !!search || cohort !== "all" || workspaceState !== "all";

  function updateParam(key: string, value: string) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (!value || value === "all") next.delete(key); else next.set(key, value);
      if (key !== "page") next.delete("page");
      return next;
    }, { replace: true });
  }

  function openWorkspace(id: number) {
    const workspaceParams = new URLSearchParams(params);
    workspaceParams.delete("tab");
    navigate(`/management/workspaces/${id}${workspaceParams.size ? `?${workspaceParams}` : ""}`);
  }


  return (
    <MainLayout pathName={{ management: "Management", workspaces: "Workspace", candidates: "Create workspace" }}>
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2"><CardTitle>Workspace</CardTitle><CardDescription>Select a project and team to create a workspace or continue working in an existing one.</CardDescription></div>
            <div className="flex flex-wrap gap-2">
              {hasPermission("TEAM_READ") && <Button variant="outline" asChild><Link to="/management/project-teams"><Users />Teams & Mentors</Link></Button>}
              <Button disabled={!canCreate || query.isLoading || query.isError} onClick={() => setCreateFor(null)}><Plus />Create workspace</Button>
              <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />Refresh</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search projects or teams" placeholder="Search team name..." value={search} onChange={event => updateParam("search", event.target.value)} className="pl-9" /></div>
            <Select value={cohort} onValueChange={value => updateParam("cohort", value)}><SelectTrigger className="w-full sm:w-48" aria-label="Cohort"><SelectValue placeholder="Cohort" /></SelectTrigger><SelectContent><SelectItem value="all">All cohorts</SelectItem>{cohorts.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
            <Select value={workspaceState} onValueChange={value => updateParam("workspace", value)}><SelectTrigger className="w-full sm:w-44" aria-label="Workspace status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All workspaces</SelectItem><SelectItem value="uncreated">Not created</SelectItem><SelectItem value="created">Created</SelectItem></SelectContent></Select>
            {hasFilters && <Button variant="ghost" onClick={() => setParams({})}><X />Clear filters</Button>}
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead className="pl-4">Project</TableHead><TableHead>Team</TableHead><TableHead>Cohort</TableHead><TableHead>Members</TableHead><TableHead>Project status</TableHead><TableHead>Workspace</TableHead><TableHead className="pr-4 text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {query.isLoading ? <TableRow><TableCell colSpan={7} className="h-40 text-center"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading projects and teams...</TableCell></TableRow>
                  : query.isError ? <TableRow><TableCell colSpan={7}><WorkspaceEmptyState icon={AlertCircle} title="Unable to load projects and teams" description={getWorkspaceError(query.error)} action={<Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>} /></TableCell></TableRow>
                  : rows.length === 0 ? <TableRow><TableCell colSpan={7}><WorkspaceEmptyState icon={FolderOpen} title="No matching projects or teams" description={hasFilters ? "Change or clear the filters to find other projects and teams." : "Projects and teams appear here when you are assigned as a mentor or team member."} action={hasFilters ? <Button variant="outline" onClick={() => setParams({})}>Clear filters</Button> : undefined} /></TableCell></TableRow>
                  : rows.map(row => <TableRow key={`${row.projectId}-${row.teamId}`}>
                    <TableCell className="pl-4"><p className="font-medium">{row.projectName ?? "No project"}</p><p className="text-xs text-muted-foreground">{row.projectCode}</p></TableCell>
                    <TableCell><p className="font-medium">{row.teamName}</p><p className="text-xs text-muted-foreground">{row.teamCode}</p></TableCell>
                    <TableCell>{row.cohortName ?? "Not assigned"}</TableCell><TableCell><span className="inline-flex items-center gap-1.5"><Users className="size-4 text-muted-foreground" />{row.memberCount ?? 0}</span></TableCell>
                    <TableCell><WorkspaceStatusBadge status={row.projectStatus} /></TableCell><TableCell><Badge variant={row.workspaceId ? "secondary" : "outline"}>{row.workspaceId ? "Created" : "Not created"}</Badge></TableCell>
                    <TableCell className="pr-4 text-right">{row.workspaceId ? <Button variant="outline" size="sm" onClick={() => openWorkspace(row.workspaceId!)}>Open workspace<ArrowRight /></Button> : <Button size="sm" disabled={!canCreate || !row.eligibleForWorkspace} title={!canCreate ? "You do not have permission to create a workspace." : workspaceIneligibleReason(row)} onClick={() => setCreateFor(row)}><Plus />Create workspace</Button>}</TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">{filtered.length ? `${(page - 1) * size + 1}–${Math.min(page * size, filtered.length)} / ${filtered.length} project/team` : "0 project/team"}</p>
            <div className="flex items-center gap-3"><Select value={String(size)} onValueChange={value => updateParam("size", value)}><SelectTrigger className="w-28" aria-label="Rows per page"><SelectValue /></SelectTrigger><SelectContent>{[10, 20, 50, 100].map(value => <SelectItem key={value} value={String(value)}>{value} / page</SelectItem>)}</SelectContent></Select><span>Page {page} / {pageCount}</span><Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}><ChevronLeft /></Button><Button variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= pageCount} onClick={() => updateParam("page", String(page + 1))}><ChevronRight /></Button></div>
          </div>
        </CardContent>
      </Card>
      {createFor !== undefined && <WorkspaceCreateDialog candidates={candidates} initialSelection={createFor} onClose={() => setCreateFor(undefined)} onOpenWorkspace={openWorkspace} />}
    </MainLayout>
  );
}
