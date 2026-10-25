import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePermissions } from "@/hooks/usePermissions";
import { ChevronDown, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TaskProjectPicker } from "./components/TaskProjectPicker";
import { TaskTable } from "./components/TaskTable";
import { OverdueTaskPanel } from "./components/OverdueTaskPanel";
import { isProjectId } from "./task-form.utils";
import { useTaskProjects } from "./hooks/useTaskProjects";

export default function TaskManagementPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, activeRole } = usePermissions();
  const projects = useTaskProjects();
  const [projectOpen, setProjectOpen] = useState(false);
  const projectStorageKey = `task-project:${user.email}`;
  const projectId =
    searchParams.get("projectId") ?? sessionStorage.getItem(projectStorageKey) ?? "";
  const projectSelected = isProjectId(projectId);
  const overdue = searchParams.get("overdue") === "true";

  useEffect(() => {
    if (projectSelected) sessionStorage.setItem(projectStorageKey, projectId);
  }, [projectId, projectSelected, projectStorageKey]);

  const selectProject = (id: string) => {
    sessionStorage.setItem(projectStorageKey, id);
    setSearchParams({ projectId: id, ...(overdue ? { overdue: "true" } : {}) });
    setProjectOpen(false);
  };

  return (
    <MainLayout pathName={{ tasks: "Tasks" }}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Task Management</h1>
          {projectSelected && (
            <Popover open={projectOpen} onOpenChange={setProjectOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2" title={projectId}>
                  <FolderOpen className="size-4 text-muted-foreground" />
                  <span className="max-w-64 truncate">{projects.isError ? "Change project" : projects.data?.find(project => project.id === projectId)?.name ?? "Change project"}</span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(28rem,calc(100vw-2rem))] p-0">
                <TaskProjectPicker key={projectId} projectId={projectId} onSelect={selectProject} />
              </PopoverContent>
            </Popover>
          )}
        </header>
        {projectSelected ? (
          <div className="grid min-h-0 gap-4">
            <div className="flex gap-2" aria-label="Task views">
              <Button variant={overdue ? "outline" : "default"} onClick={() => setSearchParams({ projectId })}>All tasks</Button>
              <Button variant={overdue ? "default" : "outline"} onClick={() => setSearchParams({ projectId, overdue: "true" })}>Overdue tasks</Button>
              <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/milestones?view=risk`)}>Milestone risks</Button>
            </div>
            {overdue
              ? <OverdueTaskPanel key={`${user.email}:${activeRole}:${projectId}`} projectId={projectId} />
              : <TaskTable key={`${user.email}:${activeRole}:${projectId}`} projectId={projectId} />}
          </div>
        ) : (
          <div className="mx-auto grid w-full max-w-xl gap-5 py-12">
            <div className="text-center">
              <FolderOpen className="mx-auto mb-3 size-10 text-muted-foreground" />
              <h2 className="font-semibold">Select a project to get started</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose a project you can access to manage tasks.
              </p>
            </div>
            <TaskProjectPicker key={projectId} projectId={projectId} onSelect={selectProject} />
          </div>
        )}
      </section>
    </MainLayout>
  );
}
