import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePermissions } from "@/hooks/usePermissions";
import { ChevronDown, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TaskProjectPicker } from "./components/TaskProjectPicker";
import { TaskTable } from "./components/TaskTable";
import { isProjectId } from "./task-form.utils";

export default function TaskManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, activeRole } = usePermissions();
  const [projectOpen, setProjectOpen] = useState(false);
  const projectStorageKey = `task-project:${user.email}`;
  const projectId =
    searchParams.get("projectId") ?? sessionStorage.getItem(projectStorageKey) ?? "";
  const projectSelected = isProjectId(projectId);

  useEffect(() => {
    if (projectSelected) sessionStorage.setItem(projectStorageKey, projectId);
  }, [projectId, projectSelected, projectStorageKey]);

  const selectProject = (id: string) => {
    sessionStorage.setItem(projectStorageKey, id);
    setSearchParams({ projectId: id });
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
                  Project{" "}
                  <span className="font-mono text-xs">{projectId.slice(0, 8).toUpperCase()}</span>
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
          <TaskTable key={`${user.email}:${activeRole}:${projectId}`} projectId={projectId} />
        ) : (
          <div className="mx-auto grid w-full max-w-xl gap-5 py-12">
            <div className="text-center">
              <FolderOpen className="mx-auto mb-3 size-10 text-muted-foreground" />
              <h2 className="font-semibold">Select a project to get started</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your shared project ID to manage tasks.
              </p>
            </div>
            <TaskProjectPicker key={projectId} projectId={projectId} onSelect={selectProject} />
          </div>
        )}
      </section>
    </MainLayout>
  );
}
