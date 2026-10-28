import { Badge } from "@/components/ui/badge";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";

const MAX_TOOLTIP_ITEMS = 10;

interface BadgeListProps {

  items: any[];

  labelField: string;

  valueField: string;

  maxVisible?: number;
}

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
      <div className="flex min-w-0 max-w-full flex-wrap gap-1">
        {visible.map((m) => (
          <Badge
            key={m[valueField]}
            variant="secondary"
            className="max-w-full whitespace-normal break-all text-xs"
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
