import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GitProjectOption } from "./git-project-scope";

export function GitProjectSelect({ projects, selectedId, onChange, label, className = "w-52" }: {
  projects: GitProjectOption[];
  selectedId: number;
  onChange: (id: number) => void;
  label: string;
  className?: string;
}) {
  return <Select value={String(selectedId)} onValueChange={value => onChange(Number(value))} disabled={projects.length === 1}>
    <SelectTrigger aria-label={label} className={className}><SelectValue /></SelectTrigger>
    <SelectContent>{projects.map(project => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}</SelectContent>
  </Select>;
}
