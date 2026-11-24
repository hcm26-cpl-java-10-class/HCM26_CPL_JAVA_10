import { cn } from "@/lib/utils";

/**
 * WS-GH-02: a thin bar showing `value` against the largest value of its list. The track is
 * a lighter step of the bar's hue; a non-zero value always shows a sliver.
 */
export function RatioBar({ value, max, track, bar, className }: { value: number; max: number; track: string; bar: string; className?: string }) {
  const percent = max > 0 && value > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return <span aria-hidden="true" className={cn("block h-1.5 w-full overflow-hidden rounded-full", track, className)}>
    <span className={cn("block h-full rounded-full", bar)} style={{ width: `${percent}%` }} />
  </span>;
}
