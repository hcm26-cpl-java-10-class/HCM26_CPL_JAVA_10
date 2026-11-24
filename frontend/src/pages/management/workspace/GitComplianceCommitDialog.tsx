import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { workspaceGitApi, type GitComplianceReport } from "@/api/features/workspace-git.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { GitLinkedTasks } from "./GitDetailLists";

type Result = GitComplianceReport["results"]["content"][number];
const date = (value: string) => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
}).format(new Date(value));

export function GitComplianceCommitDialog({ workspaceId, row, onClose }: {
  workspaceId: number;
  row?: Result;
  onClose: () => void;
}) {
  const { user, activeRole } = usePermissions();
  const commit = useQuery({
    queryKey: ["git-activity", "compliance-commit-details", workspaceId, user.email, activeRole, row?.commitId],
    queryFn: ({ signal }) => workspaceGitApi.commit(workspaceId, row!.commitId, signal),
    enabled: row != null, retry: false,
  });
  return <Dialog open={row != null} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>Commit validation details</DialogTitle>
        <DialogDescription>Thông tin commit và lý do đánh giá theo phiên bản quy tắc đã dùng.</DialogDescription></DialogHeader>
      {row && <div className="space-y-4">
        <div className="space-y-2"><p className="whitespace-pre-wrap break-words font-medium">{row.message}</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{row.sha}</p></div>
        <section aria-label="Validation result" className={`space-y-2 rounded-xl border p-4 ${row.status === "PASSED"
          ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
          <div className="flex flex-wrap items-center gap-2"><Badge variant={row.status === "PASSED" ? "secondary" : "destructive"}>
            {row.status.replaceAll("_", " ")}</Badge>
            <span className="text-sm font-medium">{row.ruleType === "CONVENTIONAL_COMMIT" ? "Commit format" : "Task ID"} · v{row.ruleVersion}</span></div>
          <h3 className="text-sm font-semibold">Lý do đánh giá</h3>
          <p className="text-sm">{row.reason}</p>
          {row.details && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{row.details}</p>}
        </section>
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 text-sm">
          <dt className="text-muted-foreground">Developer</dt><dd className="break-words">{row.developerName}</dd>
          <dt className="text-muted-foreground">Committed</dt><dd>{date(row.committedAt)}</dd>
          <dt className="text-muted-foreground">Evaluated</dt><dd>{date(row.evaluatedAt)}</dd>
        </dl>
        {commit.isPending ? <Skeleton className="h-24" /> : commit.isError ? <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>Không thể tải thông tin commit. Vui lòng thử lại.</p><Button variant="outline" onClick={() => void commit.refetch()}>Retry</Button>
        </div> : commit.data && <>
          <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 text-sm">
            <dt className="text-muted-foreground">Repository</dt><dd>{commit.data.repositoryName}</dd>
            <dt className="text-muted-foreground">Branch</dt><dd className="break-all">{commit.data.branch ?? "—"}</dd>
          </dl>
          <section className="space-y-2"><h3 className="text-sm font-semibold">Linked Tasks</h3>
            <GitLinkedTasks key={commit.data.id} tasks={commit.data.tasks} /></section>
          {commit.data.htmlUrl && <Button asChild><a href={commit.data.htmlUrl} target="_blank" rel="noreferrer">
            View on GitHub<ExternalLink className="ml-2 size-4" /></a></Button>}
        </>}
      </div>}
    </DialogContent>
  </Dialog>;
}
