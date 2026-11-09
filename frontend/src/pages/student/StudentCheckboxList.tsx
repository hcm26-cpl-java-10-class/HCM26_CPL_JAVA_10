import { Checkbox } from "@/components/ui/checkbox";
import type { DepartmentMember } from "@/types";

interface StudentCheckboxListProps {
  students: DepartmentMember[];
  selected: DepartmentMember[];
  onChange: (selected: DepartmentMember[]) => void;
  disabled?: boolean;
  showDepartment?: boolean;
}

export const studentFullName = (student: DepartmentMember) =>
  [student.firstName, student.lastName].filter(Boolean).join(" ");

export function StudentCheckboxList({
  students,
  selected,
  onChange,
  disabled = false,
  showDepartment = false,
}: StudentCheckboxListProps) {
  const selectedIds = new Set(selected.map((student) => student.id));
  const selectedOnPage = students.filter((student) => selectedIds.has(student.id)).length;
  const allOnPage = students.length > 0 && selectedOnPage === students.length;

  const toggleStudent = (student: DepartmentMember, checked: boolean) => {
    onChange(
      checked
        ? [...selected.filter((item) => item.id !== student.id), student]
        : selected.filter((item) => item.id !== student.id),
    );
  };

  const toggleAllOnPage = (checked: boolean) => {
    const pageIds = new Set(students.map((student) => student.id));
    const others = selected.filter((student) => !pageIds.has(student.id));
    onChange(checked ? [...others, ...students] : others);
  };

  if (students.length === 0) return null;

  return (
    <div className="rounded-md border">
      <label className="flex cursor-pointer items-center gap-3 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
        <Checkbox
          checked={allOnPage ? true : selectedOnPage > 0 ? "indeterminate" : false}
          onCheckedChange={(checked) => toggleAllOnPage(checked === true)}
          disabled={disabled}
          aria-label="Select all students on this page"
        />
        Select all on this page
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {selected.length} selected
        </span>
      </label>
      <ul className="max-h-64 divide-y overflow-y-auto">
        {students.map((student) => (
          <li key={student.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
              <Checkbox
                checked={selectedIds.has(student.id)}
                onCheckedChange={(checked) => toggleStudent(student, checked === true)}
                disabled={disabled}
              />
              <span>
                {studentFullName(student)} ({student.email})
                {showDepartment && student.departmentName ? ` — ${student.departmentName}` : ""}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
