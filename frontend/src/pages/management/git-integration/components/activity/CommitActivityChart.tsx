import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { GitDailyActivity, GitInsightsRange } from "@/types/features/git-integration";
import { byDay, byWeek, shortDate, spanLabel, weekday, type ActivityBucket } from "../../insights.utils";
import { CHART_COLORS } from "../git-integration.styles";

interface Point extends ActivityBucket {
  key: string;
  /** y of the merged-PR dot (on the baseline), or null when nothing was merged. */
  merged: number | null;
}

/** Top of the y-axis: a multiple of 3 (at least 3) so its 4 ticks are evenly spaced whole numbers. */
function niceMax(max: number) {
  return Math.max(3, Math.ceil(max / 3) * 3);
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Point }> }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  const prs = [point.pullRequestsOpened > 0 && `${point.pullRequestsOpened} opened`, point.pullRequestsMerged > 0 && `${point.pullRequestsMerged} merged`]
    .filter(Boolean).join(" · ");
  return <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
    <p className="font-medium">{point.from === point.to ? spanLabel(point.from, point.to) : `Week of ${spanLabel(point.from, point.to)}`}</p>
    <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2 rounded-[2px]" style={{ background: CHART_COLORS.bar }} aria-hidden="true" />{plural(point.commits, "commit")}
    </p>
    {prs && <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2 rounded-full" style={{ background: CHART_COLORS.merged }} aria-hidden="true" />PRs: {prs}
    </p>}
    {point.commits > 0 && <p className="mt-1 text-[10px] text-muted-foreground">Click to see these commits</p>}
  </div>;
}

/** Merged-PR marker: r = 4 with a 2px ring in the surface colour so it stays legible on the baseline. */
function MergedDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={4} fill={CHART_COLORS.merged} stroke={CHART_COLORS.surface} strokeWidth={2} />;
}

/**
 * WS-GH-02: commits per day (per week for 90 days) as columns, with a violet dot on the
 * days a pull request was merged. One axis, zero baseline; the whole column band is the
 * hit target and opens the commits of that day / week. A hidden table carries every value.
 */
export function CommitActivityChart({ daily, range, onSelect }: {
  daily: GitDailyActivity[];
  range: GitInsightsRange;
  onSelect: (from: string, to: string) => void;
}) {
  const buckets = range === "90d" ? byWeek(daily) : byDay(daily);
  const data: Point[] = buckets.map(bucket => ({ ...bucket, key: bucket.from, merged: bucket.pullRequestsMerged > 0 ? 0 : null }));
  const empty = data.every(point => point.commits === 0);
  const tick = (key: string) => range === "7d" ? weekday(key) : shortDate(key);
  // Daily labels every 5 days for 30 days; 7 days and the 90-day weeks show every label.
  const interval = range === "30d" ? 4 : 0;
  const select = (point?: Point) => { if (point && point.commits > 0) onSelect(point.from, point.to); };

  return <div className="space-y-3">
    <div className="relative h-40 sm:h-[200px] [&_.recharts-bar-rectangle]:cursor-pointer [&_.recharts-surface]:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="25%" accessibilityLayer
          onClick={state => select(data.find(point => point.key === state.activeLabel)
            ?? data[Number(state.activeTooltipIndex ?? state.activeIndex)])}>
          <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeWidth={1} />
          <XAxis dataKey="key" tickFormatter={tick} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} minTickGap={14}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={interval} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tickCount={4}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} domain={[0, niceMax]} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} isAnimationActive={false} />
          <Bar dataKey="commits" name="Commits" fill={CHART_COLORS.bar} maxBarSize={24} radius={[4, 4, 0, 0]}
            activeBar={{ fill: CHART_COLORS.barActive }} isAnimationActive={false}
            onClick={entry => select((entry as { payload?: Point }).payload)} />
          <Scatter dataKey="merged" name="PR merged" shape={<MergedDot />} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      {empty && <p className="pointer-events-none absolute inset-0 flex items-center justify-center pb-6 text-sm text-muted-foreground">
        No commits in this period.
      </p>}
    </div>

    <table className="sr-only">
      <caption>Commits {range === "90d" ? "per week" : "per day"}</caption>
      <thead><tr><th scope="col">{range === "90d" ? "Week" : "Day"}</th><th scope="col">Commits</th><th scope="col">Pull requests merged</th><th scope="col">Open</th></tr></thead>
      <tbody>
        {data.map(point => <tr key={point.key}>
          <th scope="row">{spanLabel(point.from, point.to)}</th>
          <td>{point.commits}</td>
          <td>{point.pullRequestsMerged}</td>
          <td>{point.commits > 0 && <button type="button" onClick={() => onSelect(point.from, point.to)}>Show commits of {spanLabel(point.from, point.to)}</button>}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
