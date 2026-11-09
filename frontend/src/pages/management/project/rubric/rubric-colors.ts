/** Per-criterion accent colors shared by the weight bar and criterion cards. */
export const CRITERION_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-500",
];

export const criterionColor = (index: number) => CRITERION_COLORS[index % CRITERION_COLORS.length];
