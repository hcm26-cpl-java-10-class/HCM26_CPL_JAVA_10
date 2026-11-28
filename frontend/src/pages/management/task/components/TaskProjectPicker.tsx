import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { FolderOpen } from "lucide-react";
import { useState, type FormEvent } from "react";
import { isProjectId, getTaskError } from "../task-form.utils";
import { useTaskProjects } from "../hooks/useTaskProjects";

export function TaskProjectPicker({ projectId, onSelect }: { projectId: string; onSelect: (id: string) => void }) {
  const projects = useTaskProjects();
  const [selected, setSelected] = useState(projectId);
  const [value, setValue] = useState(projectId);
  const [error, setError] = useState<string>();
  const options = projects.isError ? [] : projects.data ?? [];
  const available = options.some(project => project.id === selected);
  const submitId = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = value.trim();
    if (!isProjectId(id)) { setError("Please enter a valid project UUID."); return; }
    setError(undefined);
    onSelect(id);
  };
  return <div className="grid gap-4 rounded-lg border bg-card p-4">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="grid min-w-0 gap-2">
        <Label htmlFor="task-project-select">Project</Label>
        {projects.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading projects...</p>
          : projects.isError ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{getTaskError(projects.error).message}</p>
              <Button type="button" variant="outline" onClick={() => void projects.refetch()}>Try again</Button></div>
          : options.length === 0 ? <p className="text-sm text-muted-foreground">No projects available for your account.</p>
          : <Select value={available ? selected : ""} onValueChange={setSelected} disabled={projects.isFetching}>
              <SelectTrigger id="task-project-select" className="w-full min-w-0"><SelectValue placeholder="Select a project" /></SelectTrigger>
              <SelectContent>{options.map(project => <SelectItem key={project.id} value={project.id}>
                {project.name} ({project.code})
              </SelectItem>)}</SelectContent>
            </Select>}
      </div>
      <Button type="button" variant="outline" disabled={!available || projects.isFetching} onClick={() => onSelect(selected)}>
        <FolderOpen className="size-4" /> Open project
      </Button>
    </div>
    <details className="border-t pt-3">
      <summary className="cursor-pointer text-xs text-muted-foreground">Use a shared project ID</summary>
      <form onSubmit={submitId} noValidate className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="task-project">Project UUID</Label>
          <Input id="task-project" value={value} placeholder="Paste the project UUID shared with you"
            aria-invalid={!!error} aria-describedby={error ? "task-project-error" : undefined}
            onChange={event => { setValue(event.target.value); setError(undefined); }} />
          <div id="task-project-error"><FieldError errors={error ? [error] : undefined} /></div>
        </div>
        <Button type="submit" variant="outline" className="sm:mb-2">Open by ID</Button>
      </form>
    </details>
  </div>;
}
