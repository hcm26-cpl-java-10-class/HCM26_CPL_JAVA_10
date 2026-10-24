import { MainLayout } from "@/components/layout/MainLayout";
import { ClipboardList, FolderKanban } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TaskProjectPicker } from "./components/TaskProjectPicker";
import { TaskTable } from "./components/TaskTable";
import { isProjectId } from "./task-form.utils";

/**
 * Task workspace (`/tasks`).
 * Tasks always belong to a project, so the page asks for a project id first
 * and then renders the task table of that project.
 */
export default function TaskManagementPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const projectIdParam = searchParams.get("projectId") ?? "";
  const projectId = isProjectId(projectIdParam) ? projectIdParam : "";

  const selectProject = (id: string) => {
    navigate(`/tasks?${new URLSearchParams({ projectId: id })}`, { replace: true });
  };

  return (
    <MainLayout pathName={{ tasks: "Tasks" }}>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Project Management</p>
            <h1 className="mt-1 text-2xl font-semibold">Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track work items, assignments and status transitions inside a project.
            </p>
          </div>
          {projectId && (
            <span className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="max-w-[260px] truncate font-mono">{projectId}</span>
            </span>
          )}
        </header>

        <TaskProjectPicker projectId={projectId} onSelect={selectProject} />

        {projectId ? (
          <TaskTable projectId={projectId} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-muted-foreground shadow-xs">
              <ClipboardList className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">Select a project to view its tasks</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the project id shared with you, then choose “Open project”.
              </p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
