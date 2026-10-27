import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";

interface TruncatedTextProps {

  content: string;

  bold?: boolean;

  className?: string;
}

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
