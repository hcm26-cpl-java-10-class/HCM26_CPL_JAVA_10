import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { normalizeTags } from "../task-form.utils";

interface TaskTagsInputProps {
  value: string[];
  draft: string;
  suggestions: string[];
  invalid: boolean;
  disabled: boolean;
  onChange: (tags: string[]) => void;
  onDraftChange: (draft: string) => void;
}

export function TaskTagsInput({
  value,
  draft,
  suggestions,
  invalid,
  disabled,
  onChange,
  onDraftChange,
}: TaskTagsInputProps) {
  const addTag = (name: string) => {
    if (!name.trim()) return;
    onChange(normalizeTags([...value, name]));
    onDraftChange("");
  };
  const availableTags = suggestions
    .filter(
      (name) =>
        name.toLowerCase().includes(draft.trim().toLowerCase()) &&
        !value.some((tag) => tag.toLowerCase() === name.toLowerCase()),
    )
    .slice(0, 8);

  return (
    <div className="grid gap-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge key={tag.toLowerCase()} variant="secondary" className="max-w-full gap-1 py-1">
              <span className="truncate">{tag}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Xóa nhãn ${tag}`}
                onClick={() => onChange(value.filter((name) => name !== tag))}
                className="rounded-sm p-0.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          id="task-tags"
          value={draft}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? "task-tags-error" : undefined}
          placeholder="Nhập nhãn, ví dụ Backend"
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === ",") && !event.nativeEvent.isComposing) {
              event.preventDefault();
              addTag(draft);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !draft.trim()}
          onClick={() => addTag(draft)}
        >
          <Plus className="size-4" /> Thêm
        </Button>
      </div>
      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Nhãn có sẵn:</span>
          {availableTags.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="xs"
              variant="outline"
              disabled={disabled}
              onClick={() => addTag(tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
