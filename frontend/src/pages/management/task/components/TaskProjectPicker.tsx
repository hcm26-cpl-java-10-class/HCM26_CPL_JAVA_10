import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { FolderOpen } from "lucide-react";
import { useState, type FormEvent } from "react";
import { isProjectId } from "../task-form.utils";

export function TaskProjectPicker({
  projectId,
  onSelect,
}: {
  projectId: string;
  onSelect: (id: string) => void;
}) {
  const [value, setValue] = useState(projectId);
  const [error, setError] = useState<string>();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = value.trim();
    if (!isProjectId(id)) {
      setError("Please enter a valid project ID.");
      return;
    }
    setError(undefined);
    onSelect(id);
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <div className="grid gap-2">
        <Label htmlFor="task-project">Project</Label>
        <Input
          id="task-project"
          value={value}
          placeholder="Enter the project ID shared with you"
          aria-invalid={!!error}
          aria-describedby={error ? "task-project-error" : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setError(undefined);
          }}
        />
        <div id="task-project-error">
          <FieldError errors={error ? [error] : undefined} />
        </div>
      </div>
      <Button type="submit" variant="outline" className="sm:mb-2">
        <FolderOpen className="size-4" /> Open project
      </Button>
    </form>
  );
}
