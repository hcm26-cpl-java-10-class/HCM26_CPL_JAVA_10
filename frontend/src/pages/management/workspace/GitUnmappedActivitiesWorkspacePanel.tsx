import { useGitActivityParam } from "./git-activity-url-context";
import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowUpRight, GitCommitHorizontal, GitPullRequest, Link2, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  workspaceGitApi,
  type GitUnmappedActivity,
  type GitUnmappedActivityType,
} from "@/api/features/workspace-git.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkspaceEmptyState } from "./workspace.shared";

const ALL = "ALL";
const PROJECT_ALL = "all";

function errorText(error: unknown) {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message ?? (error instanceof Error ? error.message : "Could not load unmapped activities.");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
}

export function GitUnmappedActivitiesWorkspacePanel({ workspaceId, initialProjectId }: {
  workspaceId: number; initialProjectId?: number;
}) {
  const { user, activeRole } = usePermissions();
  const client = useQueryClient();
  const [search, setSearch] = useGitActivityParam<string>("gitUnmappedSearch", "");
  const deferredSearch = useDeferredValue(search.trim());
  const [type, setType] = useGitActivityParam<GitUnmappedActivityType>("gitUnmappedType", ALL);
  const [from, setFrom] = useGitActivityParam<string>("gitUnmappedFrom", "");
  const [to, setTo] = useGitActivityParam<string>("gitUnmappedTo", "");
  const [page, setPage] = useGitActivityParam<number>("gitUnmappedPage", 0);
  const [selected, setSelected] = useState<GitUnmappedActivity | null>(null);
  const [projectId, setProjectId] = useGitActivityParam<number | undefined>("gitUnmappedProjectId", initialProjectId, "number");
  const [taskId, setTaskId] = useState<number | undefined>();
  const [taskSearch, setTaskSearch] = useState("");
  const query = useQuery({
    queryKey: ["git-activity", "unmapped", workspaceId, user.email, activeRole,
      type, from, to, deferredSearch, page],
    queryFn: ({ signal }) => workspaceGitApi.unmappedActivities(workspaceId, {
      type, from: from || undefined, to: to || undefined,
      search: deferredSearch || undefined, page, size: 20,
    }, signal),
    retry: false,
  });
  const filterOptions = useQuery({
    queryKey: ["git-activity", "filters", workspaceId, user.email, activeRole, "unmapped"],
    queryFn: ({ signal }) => workspaceGitApi.activityFilters(workspaceId, undefined, signal),
    retry: false,
  });
  const taskOptions = useQuery({
    queryKey: ["git-activity", "unmapped-task-options", workspaceId, projectId, taskSearch, user.email, activeRole],
    queryFn: ({ signal }) => workspaceGitApi.unmappedTaskOptions(workspaceId, projectId, taskSearch.trim() || undefined, signal),
    enabled: selected !== null && projectId !== undefined,
    retry: false,
  });
  const link = useMutation({
    mutationFn: () => selected && taskId ? workspaceGitApi.linkUnmappedActivity(workspaceId, {
      type: selected.type, activityId: selected.id, taskId,
    }) : Promise.reject(new Error("Choose a Task.")),
    onSuccess: async () => {
      toast.success("Git activity linked to the Task.");
      setPage(0);
      setSelected(null); setTaskId(undefined); setTaskSearch("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["git-activity"] }),
        client.invalidateQueries({ queryKey: ["git-integration"] }),
      ]);
    },
    onError: error => toast.error(errorText(error)),
  });

  const data = query.data?.activities;
  const activities = data?.content ?? [];
  const closeDialog = (open: boolean) => {
    if (!open) { setSelected(null); setTaskId(undefined); setTaskSearch(""); }
  };
  const openLinkDialog = (item: GitUnmappedActivity) => {
    setSelected(item);
    setProjectId(initialProjectId);
    setTaskId(undefined);
    setTaskSearch("");
    link.reset();
  };
  return <Card className="overflow-hidden border-orange-200/80 shadow-sm">
    <CardHeader className="border-b bg-gradient-to-r from-orange-50 via-white to-amber-50/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base"><Link2 className="size-4 text-orange-700" />Unmapped Git Activities</CardTitle>
          <CardDescription>Find commits and pull requests without a Task link, see why they are unmatched, and connect them to an in-scope Task.</CardDescription>
        </div>
        {data && <Badge variant="outline" className="border-orange-200 bg-white text-orange-800">{data.totalElements} unlinked activities</Badge>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input aria-label="Search unmapped activities" value={search} placeholder="Search activity or author"
            onChange={event => { setSearch(event.target.value); setPage(0); }} className="bg-white pl-9" /></div>
        <Select value={type} onValueChange={value => { setType(value as GitUnmappedActivityType); setPage(0); }}>
          <SelectTrigger aria-label="Filter unmapped activity type" className="w-48 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Commits and PRs</SelectItem><SelectItem value="COMMIT">Commits</SelectItem>
            <SelectItem value="PULL_REQUEST">Pull requests</SelectItem></SelectContent>
        </Select>
        <Input aria-label="Unmapped activities from date" type="date" value={from}
          onChange={event => { setFrom(event.target.value); setPage(0); }} className="w-40 bg-white" />
        <Input aria-label="Unmapped activities to date" type="date" value={to}
          onChange={event => { setTo(event.target.value); setPage(0); }} className="w-40 bg-white" />
      </div>
    </CardHeader>
    <CardContent className="space-y-3 pt-4">
      {query.isPending ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-44 w-full" /></div>
        : query.isError ? <WorkspaceEmptyState icon={AlertCircle} title="Could not load unmapped activities"
          description={errorText(query.error)} action={<Button variant="outline" onClick={() => void query.refetch()}>Retry</Button>} />
        : activities.length === 0 ? <WorkspaceEmptyState icon={Link2} title="No unmapped Git activities"
          description="Every visible commit and pull request is linked to a Task, or this filter has no matching activity." compact />
        : <div className="overflow-x-auto rounded-lg border"><Table>
          <TableHeader className="bg-slate-50"><TableRow><TableHead>Activity</TableHead><TableHead>Author</TableHead>
            <TableHead>Why it is unmapped</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>{activities.map(item => <TableRow key={item.type + "-" + item.id}>
            <TableCell className="max-w-[24rem]">
              <div className="flex items-start gap-2">
                <span className={"mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md "
                  + (item.type === "COMMIT" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700")}>
                  {item.type === "COMMIT" ? <GitCommitHorizontal className="size-4" /> : <GitPullRequest className="size-4" />}
                </span>
                <div className="min-w-0"><p className="truncate font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.type === "COMMIT" ? (item.sha?.slice(0, 10) ?? String(item.id)) : "#" + (item.number ?? item.id)}
                    {item.state && <> · {item.state}</>}</p></div>
              </div>
            </TableCell>
            <TableCell><span>{item.authorName}</span>{item.authorLogin && <span className="block text-xs text-muted-foreground">@{item.authorLogin}</span>}</TableCell>
            <TableCell><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{item.reason}</Badge></TableCell>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(item.occurredAt)}</TableCell>
            <TableCell className="text-right"><div className="flex justify-end gap-2">
              {item.htmlUrl ? <Button size="sm" variant="outline" asChild><a href={item.htmlUrl} target="_blank" rel="noreferrer"><ArrowUpRight className="size-3.5" />Open GitHub</a></Button>
                : <Badge variant="outline" className="text-muted-foreground">Link after connection</Badge>}
              {query.data?.canManage && <Button size="sm" onClick={() => openLinkDialog(item)}><Link2 className="size-3.5" />Link Task</Button>}
            </div></TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
      {data && data.totalPages > 1 && <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Page {page + 1} of {data.totalPages}</span>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0 || query.isFetching}
          onClick={() => setPage(value => Math.max(0, value - 1))}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= data.totalPages || query.isFetching}
            onClick={() => setPage(value => value + 1)}>Next</Button></div>
      </div>}
    </CardContent>

    <Dialog open={selected !== null} onOpenChange={closeDialog}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Link activity to a Task</DialogTitle>
          <DialogDescription>Choose a project and an active Task inside this Workspace. The link is saved as MANUAL with the acting manager and timestamp.</DialogDescription></DialogHeader>
        {selected && <div className="space-y-3">
          <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3"><p className="text-xs font-semibold uppercase text-orange-800">{selected.type === "COMMIT" ? "Commit" : "Pull request #" + (selected.number ?? selected.id)}</p>
            <p className="mt-1 font-medium">{selected.title}</p><p className="mt-1 text-sm text-muted-foreground">{selected.reason}</p></div>
          <Select value={projectId?.toString() ?? PROJECT_ALL} onValueChange={value => {
            setProjectId(value === PROJECT_ALL ? undefined : Number(value)); setTaskId(undefined);
          }}>
            <SelectTrigger aria-label="Choose project for task link"><SelectValue placeholder="Choose project" /></SelectTrigger>
            <SelectContent><SelectItem value={PROJECT_ALL}>Choose project</SelectItem>{(filterOptions.data?.projects ?? []).map(project =>
              <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input aria-label="Search tasks to link" placeholder="Search active tasks…" value={taskSearch}
            onChange={event => setTaskSearch(event.target.value)} disabled={projectId === undefined} />
          {taskOptions.isError && <p role="alert" className="text-sm text-rose-700">{errorText(taskOptions.error)}</p>}
          {taskOptions.isPending && projectId !== undefined ? <Skeleton className="h-10 w-full" />
            : <Select value={taskId?.toString() ?? PROJECT_ALL} onValueChange={value => setTaskId(value === PROJECT_ALL ? undefined : Number(value))}
              disabled={projectId === undefined || !taskOptions.data?.tasks.length}>
              <SelectTrigger aria-label="Choose task to link"><SelectValue placeholder="Choose task" /></SelectTrigger>
              <SelectContent><SelectItem value={PROJECT_ALL}>Choose task</SelectItem>{(taskOptions.data?.tasks ?? []).map(task =>
                <SelectItem key={task.id} value={String(task.id)}>#{task.id} · {task.title}</SelectItem>)}</SelectContent>
            </Select>}
          {projectId !== undefined && !taskOptions.isPending && !taskOptions.isError && taskOptions.data?.tasks.length === 0
            && <p className="text-xs text-muted-foreground">No active tasks match this project and search.</p>}
        </div>}
        {link.isError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">{errorText(link.error)}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => closeDialog(false)} disabled={link.isPending}><X className="size-4" />Cancel</Button>
          <Button type="button" disabled={!taskId || link.isPending} onClick={() => link.mutate()}>
            <Link2 className="size-4" />{link.isPending ? "Saving link…" : "Confirm link"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>;
}
