import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";

interface TruncatedTextProps {
  /** Giá trị hiển thị (cũng dùng làm nội dung tooltip) */
  content: string;
  /** Thêm class font-medium khi field có bold */
  bold?: boolean;
  /** Thêm class bổ sung (VD "text-sm" cho CardView) */
  className?: string;
}

/**
 * Text truncate kèm tooltip hiển thị đầy đủ nội dung.
 * Dùng cho field text, date, single-relation, v.v.
 */
export function TruncatedText({
  content,
  bold,
  className = "",
}: TruncatedTextProps) {
  return (
    <TooltipWrapper content={content}>
      <span
        className={`block truncate${bold ? " font-medium" : ""}${className ? ` ${className}` : ""}`}
      >
        {content}
      </span>
    </TooltipWrapper>
  );
}
