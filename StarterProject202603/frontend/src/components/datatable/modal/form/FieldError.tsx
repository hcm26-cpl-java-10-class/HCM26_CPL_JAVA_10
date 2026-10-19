import { AlertCircle } from "lucide-react";

interface FieldErrorProps {
  errors?: string[];
}

/**
 * Hiển thị danh sách lỗi validation cho một field.
 */
export function FieldError({ errors }: FieldErrorProps) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="flex items-start gap-1.5 text-destructive">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div className="text-xs space-y-0.5">
        {errors.map((msg, i) => (
          <p key={i}>{msg}</p>
        ))}
      </div>
    </div>
  );
}
