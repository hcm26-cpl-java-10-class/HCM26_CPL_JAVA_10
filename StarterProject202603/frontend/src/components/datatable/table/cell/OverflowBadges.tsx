import { Badge } from "@/components/ui/badge";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { useRef, useState, useEffect, useMemo } from "react";

const MAX_TOOLTIP_ITEMS = 10;

interface OverflowBadgesProps {
  items: any[];
  labelField: string;
  valueField: string;
}

export function OverflowBadges({
  items,
  labelField,
  valueField,
}: OverflowBadgesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const rafRef = useRef<number>(0);
  const visibleCountRef = useRef(visibleCount);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const recalculate = () => {
      if (!containerRef.current || !measureRef.current) return;
      const availableWidth = containerRef.current.clientWidth;
      if (availableWidth === 0) return;

      const children = Array.from(
        measureRef.current.children
      ) as HTMLElement[];
      const badgeEls = children.slice(0, items.length);
      const plusBadge = children[items.length];
      const gap = 4;
      const plusWidth = plusBadge ? plusBadge.offsetWidth + gap : 0;

      let usedWidth = 0;
      let count = items.length;

      for (let i = 0; i < badgeEls.length; i++) {
        const badgeWidth = badgeEls[i].offsetWidth;
        const addedWidth = i === 0 ? badgeWidth : badgeWidth + gap;

        if (usedWidth + addedWidth > availableWidth) {
          count = i;
          break;
        }

        usedWidth += addedWidth;

        if (i < badgeEls.length - 1) {
          const remaining = availableWidth - usedWidth;
          if (remaining < plusWidth) {
            count = i + 1;
            break;
          }
        }
      }

      if (visibleCountRef.current !== count) {
        visibleCountRef.current = count;
        setVisibleCount(count);
      }
    };

    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(recalculate);
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    recalculate();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [items.length]);

  const fullText = useMemo(() => {
    const labels = items.map((m) => m[labelField]);
    if (labels.length <= MAX_TOOLTIP_ITEMS) return labels.join(", ");
    return (
      labels.slice(0, MAX_TOOLTIP_ITEMS).join(", ") +
      ` … và ${labels.length - MAX_TOOLTIP_ITEMS} mục khác`
    );
  }, [items, labelField]);

  const hiddenCount = items.length - visibleCount;

  return (
    <TooltipWrapper content={fullText || "—"}>
      <div ref={containerRef} className="relative overflow-hidden">
        {/* Hidden measurement div */}
        <div
          ref={measureRef}
          className="flex gap-1 flex-nowrap absolute top-0 left-0 invisible pointer-events-none h-0"
          aria-hidden="true"
        >
          {items.map((m) => (
            <Badge
              key={m[valueField]}
              variant="secondary"
              className="text-xs shrink-0"
            >
              {m[labelField]}
            </Badge>
          ))}
          <Badge variant="outline" className="text-xs shrink-0">
            +{items.length}
          </Badge>
        </div>

        {/* Visible badges */}
        <div className="flex gap-1 flex-nowrap">
          {items.slice(0, visibleCount).map((m) => (
            <Badge
              key={m[valueField]}
              variant="secondary"
              className="text-xs shrink-0"
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
      </div>
    </TooltipWrapper>
  );
}
