import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { DepartmentMember } from "@/types";
import { X } from "lucide-react";
import { useMemo } from "react";
import { studentFullName } from "./StudentCheckboxList";

interface DepartmentMemberPickerProps {
  /** Tiêu đề khối (tên department). Mặc định: "Members". */
  title?: string;
  members: DepartmentMember[];
  /** Những thành viên đang bị BỎ tick (không được assign). */
  excludedIds: number[];
  /** Những thành viên đã enroll sẵn trong course (không thể thay đổi). */
  enrolledIds?: Set<number>;
  onExcludedChange: (excludedIds: number[]) => void;
  /** Bỏ hẳn department này khỏi danh sách đã chọn. */
  onRemoveDepartment?: () => void;
  disabled?: boolean;
}

export function DepartmentMemberPicker({
  title = "Members",
  members,
  excludedIds,
  enrolledIds,
  onExcludedChange,
  onRemoveDepartment,
  disabled = false,
}: DepartmentMemberPickerProps) {
  const excludedSet = useMemo(() => new Set(excludedIds), [excludedIds]);
  const isEnrolled = (id: number) => enrolledIds?.has(id) ?? false;

  // Chỉ những người chưa enroll mới có thể tick / bỏ tick
  const selectable = members.filter((member) => !isEnrolled(member.id));
  const selectedCount = selectable.filter((member) => !excludedSet.has(member.id)).length;
  const allSelected = selectable.length > 0 && selectedCount === selectable.length;

  const toggleMember = (memberId: number, checked: boolean) => {
    onExcludedChange(
      checked
        ? excludedIds.filter((id) => id !== memberId)
        : [...excludedIds.filter((id) => id !== memberId), memberId],
    );
  };

  const toggleAll = () => {
    onExcludedChange(allSelected ? selectable.map((member) => member.id) : []);
  };

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {selectedCount} / {selectable.length} selected
        </span>
        {onRemoveDepartment && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            aria-label={`Remove department ${title}`}
            disabled={disabled}
            onClick={onRemoveDepartment}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {selectable.length > 0 && (
        <div className="flex items-center justify-between border-b px-3 py-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={allSelected}
              disabled={disabled}
              onCheckedChange={toggleAll}
              aria-label={`Select all members of ${title}`}
            />
            {allSelected ? "Deselect all" : "Select all"}
          </label>
        </div>
      )}

      {members.length > 0 ? (
        <ul className="max-h-48 divide-y overflow-y-auto">
          {members.map((member) => {
            const enrolled = isEnrolled(member.id);
            const checked = enrolled || !excludedSet.has(member.id);
            return (
              <li key={member.id}>
                <label
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${
                    enrolled || disabled ? "cursor-default" : "cursor-pointer hover:bg-muted/40"
                  } ${!checked ? "text-muted-foreground" : ""}`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled || enrolled}
                    onCheckedChange={(value) => toggleMember(member.id, value === true)}
                    aria-label={`${studentFullName(member)}`}
                  />
                  <span className={`min-w-0 flex-1 truncate ${!checked ? "line-through" : ""}`}>
                    {studentFullName(member)} ({member.email})
                  </span>
                  {enrolled && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      Already enrolled
                    </Badge>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          This department has no active students.
        </p>
      )}
    </div>
  );
}
