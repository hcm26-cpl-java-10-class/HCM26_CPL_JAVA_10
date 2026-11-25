import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { GitActivityBucket, GitInsightsGranularity } from "@/types/features/git-integration";
import { monthLabel, monthLongLabel, periodLabel, shortDate, spanLabel, weekday, type ActivityBucket } from "../../insights.utils";
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

/** True when `from`..`to` is a whole calendar month (the edge months of a period are clipped). */
function isWholeMonth(from: string, to: string) {
  const [year, month, day] = to.split("-").map(Number);
  return from.endsWith("-01") && from.slice(0, 7) === to.slice(0, 7) && new Date(year, month, 0).getDate() === day;
}

/** "Mon, 16 Nov", "Week of 10–16 Nov" or "November 2025" (with the days when the month is clipped). */
function bucketLabel(point: ActivityBucket, granularity: GitInsightsGranularity) {
  if (granularity === "DAY") return spanLabel(point.from, point.from);
  if (granularity === "WEEK") return `Week of ${spanLabel(point.from, point.to)}`;
  return isWholeMonth(point.from, point.to) ? monthLongLabel(point.from)
    : `${monthLongLabel(point.from)} (${periodLabel(point.from, point.to)})`;
}

function ChartTooltip({ active, payload, granularity = "DAY" }: {
  active?: boolean; payload?: ReadonlyArray<{ payload?: Point }>; granularity?: GitInsightsGranularity;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  const prs = [point.pullRequestsOpened > 0 && `${point.pullRequestsOpened} opened`, point.pullRequestsMerged > 0 && `${point.pullRequestsMerged} merged`]
    .filter(Boolean).join(" · ");
  return <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
    <p className="font-medium">{bucketLabel(point, granularity)}</p>
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

const UNIT: Record<GitInsightsGranularity, string> = { DAY: "day", WEEK: "week", MONTH: "month" };

/**
 * WS-GH-02: commits per day, week or month (the server picks it from the length of the period) as
 * columns, with a violet dot where a pull request was merged. One axis, zero baseline; the whole
 * column band is the hit target and opens the commits of that span. A hidden table carries every value.
 */
export function CommitActivityChart({ buckets, granularity, onSelect }: {
  buckets: GitActivityBucket[];
  granularity: GitInsightsGranularity;
  onSelect: (from: string, to: string) => void;
}) {
  const data: Point[] = buckets.map(bucket => ({ from: bucket.start, to: bucket.end, commits: bucket.commits,
    pullRequestsOpened: bucket.pullRequestsOpened, pullRequestsMerged: bucket.pullRequestsMerged,
    key: bucket.start, merged: bucket.pullRequestsMerged > 0 ? 0 : null }));
  const empty = data.every(point => point.commits === 0);
  const tick = (key: string) => granularity === "MONTH" ? monthLabel(key)
    : granularity === "DAY" && data.length <= 7 ? weekday(key) : shortDate(key);
  // Up to 16 columns show every label; denser charts let the axis skip labels that would overlap.
  const interval = data.length <= 16 ? 0 : "preserveStartEnd";
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
          <Tooltip content={<ChartTooltip granularity={granularity} />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} isAnimationActive={false} />
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

    {/* A table ignores the 1px box and overflow of `sr-only` and would stretch the page: the wrapper clips it. */}
    <div className="sr-only"><table>
      <caption>Commits per {UNIT[granularity]}</caption>
      <thead><tr><th scope="col">{UNIT[granularity][0].toUpperCase() + UNIT[granularity].slice(1)}</th><th scope="col">Commits</th><th scope="col">Pull requests merged</th><th scope="col">Open</th></tr></thead>
      <tbody>
        {data.map(point => <tr key={point.key}>
          <th scope="row">{bucketLabel(point, granularity)}</th>
          <td>{point.commits}</td>
          <td>{point.pullRequestsMerged}</td>
          <td>{point.commits > 0 && <button type="button" onClick={() => onSelect(point.from, point.to)}>Show commits of {spanLabel(point.from, point.to)}</button>}</td>
        </tr>)}
      </tbody>
    </table></div>
  </div>;
}
