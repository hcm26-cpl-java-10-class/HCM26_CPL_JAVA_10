import { Badge } from "@/components/ui/badge";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";

const MAX_TOOLTIP_ITEMS = 10;

interface BadgeListProps {
  /** Danh sách item đã được match với option */
  items: any[];
  /** Tên trường hiển thị label (VD "name") */
  labelField: string;
  /** Tên trường giá trị ID (VD "id") */
  valueField: string;
  /** Số badge tối đa hiển thị (mặc định không giới hạn ⟹ hiện tất cả) */
  maxVisible?: number;
}

/**
 * Danh sách badge kèm tooltip hiển thị đầy đủ danh sách.
 * Dùng cho field relation/select dạng multiple.
 */
export function BadgeList({
  items,
  labelField,
  valueField,
  maxVisible,
}: BadgeListProps) {
  if (items.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const labels = items.map((m) => m[labelField]);
  const tooltipText =
    labels.length <= MAX_TOOLTIP_ITEMS
      ? labels.join(", ")
      : labels.slice(0, MAX_TOOLTIP_ITEMS).join(", ") +
        ` … và ${labels.length - MAX_TOOLTIP_ITEMS} mục khác`;

  const visible =
    maxVisible !== undefined ? items.slice(0, maxVisible) : items;
  const hiddenCount =
    maxVisible !== undefined ? items.length - maxVisible : 0;

  return (
    <TooltipWrapper content={tooltipText}>
      <div className="flex flex-wrap gap-1">
        {visible.map((m) => (
          <Badge
            key={m[valueField]}
            variant="secondary"
            className="text-xs truncate"
          >
            {m[labelField]}
          </Badge>
        ))}
        {hiddenCount > 0 && (
          <Badge variant="outline" className="text-xs shrink-0">
            +{hiddenCount}
          </Badge>
        )}
      </div>
    </TooltipWrapper>
  );
}
