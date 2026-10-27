import { projectBoardApi } from "@/api/features/project-board.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BoardColumn, ProjectBoard, ProjectBoardSprintOption } from "@/types/features/project-board";
import { AlertCircle, Check, Circle, CircleDot, Clock3, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

const icons = { BACKLOG: Circle, TODO: Circle, IN_PROGRESS: CircleDot, REVIEW: Clock3, DONE: Check, BLOCKED: AlertCircle };

export function WorkspaceTeamBoardPanel({ teamId }: { teamId: number }) {
  const [sprints, setSprints] = useState<ProjectBoardSprintOption[]>([]);
  const [sprintId, setSprintId] = useState("");
  const [board, setBoard] = useState<ProjectBoard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadSprints = async () => {
    setLoading(true);
    setError("");
    try {
      const options = await projectBoardApi.getTeamSprints(teamId);
      setSprints(options);
      setSprintId((current) => options.some((item) => String(item.id) === current) ? current : String(options[0]?.id ?? ""));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải Sprint của Team.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void loadSprints(); }, [teamId]);
  useEffect(() => {
    if (!sprintId) { setBoard(null); return; }
    let cancelled = false;
    setLoading(true);
    projectBoardApi.getTeamBoard(teamId, Number(sprintId))
      .then((data) => { if (!cancelled) setBoard(data); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải Kanban Board."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [teamId, sprintId]);

  const columns = useMemo(() => board?.columns ?? [], [board]);
  return <Card>
    <CardHeader><div className="flex flex-wrap items-center justify-between gap-3">
      <div><CardTitle>Kanban Board</CardTitle><p className="mt-1 text-sm text-muted-foreground">Board của Team, không phụ thuộc Project Template.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild><Link to={`/project-board?teamId=${teamId}`}>Mở Board đầy đủ</Link></Button>
        <select className="h-9 rounded-md border bg-background px-3 text-sm" value={sprintId} onChange={(event) => setSprintId(event.target.value)} disabled={loading || !sprints.length}>
          <option value="">{sprints.length ? "Chọn Sprint" : "Team chưa có Sprint"}</option>
          {sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name} · {sprint.status}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={() => void loadSprints()} disabled={loading}><RefreshCw className="size-4" />Làm mới</Button>
      </div>
    </div></CardHeader>
    <CardContent>
      {error && <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {!loading && !sprints.length && <p className="py-12 text-center text-sm text-muted-foreground">Chưa có Sprint cho Team này.</p>}
      {loading && <p className="py-12 text-center text-sm text-muted-foreground">Đang tải Kanban Board…</p>}
      {!loading && board && <div className="grid min-w-[1050px] grid-cols-6 gap-3 overflow-x-auto">
        {columns.map((column: BoardColumn) => {
          const Icon = icons[column.key];
          return <section key={column.key} className="min-h-64 rounded-lg border bg-muted/30 p-3">
            <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4" />{column.name}</h3><Badge variant="secondary">{column.count}</Badge></div>
            <div className="space-y-2">{column.tasks.map((task) => <article key={task.id} className="rounded-md border bg-background p-3 shadow-sm"><p className="text-xs text-muted-foreground">{task.code}</p><p className="mt-1 text-sm font-medium">{task.title}</p>{task.assignee && <p className="mt-2 text-xs text-muted-foreground">{task.assignee.displayName}</p>}</article>)}</div>
          </section>;
        })}
      </div>}
    </CardContent>
  </Card>;
}
