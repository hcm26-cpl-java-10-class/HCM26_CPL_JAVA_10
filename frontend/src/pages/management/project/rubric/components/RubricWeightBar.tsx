import { criterionKey, type RubricCriterionView } from "../rubric-view.types";
import { criterionColor } from "../rubric-colors";

/** Horizontal stacked bar showing how weight is distributed across criteria. */
export function RubricWeightBar({ criteria }: { criteria: RubricCriterionView[] }) {
  const total = criteria.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  if (!criteria.length || total <= 0) return null;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">Weight distribution</span>
        <span className={total === 100 ? "text-muted-foreground" : "font-medium text-amber-700 dark:text-amber-400"}>
          Total {total}%
        </span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Criterion weight distribution">
        {criteria.map((item, index) => (
          <div
            key={criterionKey(item)}
            className={`${criterionColor(index)} h-full border-r border-background last:border-r-0`}
            style={{ width: `${(Number(item.weight) / total) * 100}%` }}
            title={`${item.name}: ${item.weight}%`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {criteria.map((item, index) => (
          <li key={criterionKey(item)} className="flex min-w-0 items-center gap-1.5">
            <span className={`${criterionColor(index)} size-2.5 shrink-0 rounded-full`} />
            <span className="max-w-48 truncate" title={item.name}>{item.name}</span>
            <span className="font-medium text-foreground">{item.weight}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
