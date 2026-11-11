import type { EntityCardRendererProps } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ArrowRight, BookOpenText } from "lucide-react";

const formatScoreLabel = (key: string) =>
  key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toScoreEntries = (value: unknown): Array<[string, unknown]> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).filter(([, score]) =>
    score !== null && score !== undefined && String(score).trim() !== "",
  );
};

export function BookWebsiteCard({
  row,
  index,
  idField,
  isSelected,
  showActions = true,
  selectable = true,
  showIndex = true,
  onSelect,
  onRowClick,
  onView,
  renderRowActions,
}: EntityCardRendererProps) {
  const id = row[idField];
  const title = row.name || "Untitled book";
  const description = row.description || "No description available.";
  const scoreEntries = toScoreEntries(row.scores);
  const isClickable = typeof onRowClick === "function";

  const handleCardClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, label, [role=switch]")) {
      return;
    }

    if (onRowClick) {
      onRowClick(row);
      return;
    }

    onView(row);
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/70 bg-gradient-to-b from-background to-muted/30 transition-all hover:-translate-y-0.5 hover:shadow-lg",
        isClickable ? "cursor-pointer" : "cursor-default",
        selectable && isSelected ? "ring-2 ring-primary" : "",
      )}
      onClick={handleCardClick}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-sky-100 via-cyan-100 to-emerald-100 dark:from-sky-900/30 dark:via-cyan-900/20 dark:to-emerald-900/30" />

      <CardHeader className="relative gap-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {selectable && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(id)}
                aria-label="Select card"
              />
            )}

            {showIndex && <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>}
          </div>

          {showActions && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {renderRowActions ? renderRowActions(row) : null}
            </div>
          )}
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <BookOpenText className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <CardTitle className="line-clamp-1 text-base leading-tight">{title}</CardTitle>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {scoreEntries.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {scoreEntries.slice(0, 4).map(([key, score]) => (
              <Badge key={key} variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
                {formatScoreLabel(key)}: {String(score)}
              </Badge>
            ))}
            {scoreEntries.length > 4 && (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
                +{scoreEntries.length - 4} more
              </Badge>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No score metadata.</p>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full justify-between"
          onClick={(event) => {
            event.stopPropagation();
            onView(row);
          }}
        >
          View detail
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
