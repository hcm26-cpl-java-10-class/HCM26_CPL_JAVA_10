import { useQuery } from "@tanstack/react-query";

import { certificateInsightsApi } from "@/api/features/demo/certificate-insights.api";

function getCellColor(value: number) {
  if (value >= 70) {
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
  }

  if (value >= 40) {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
  }

  return "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
}

export function CompetencyHeatmap() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["certificate-insights", "heatmap"],
    queryFn: certificateInsightsApi.getHeatmap,
  });

  if (isLoading) {
    return (
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        Failed to load competency heatmap.
      </p>
    );
  }

  if (!data.departments.length || !data.skills.length) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        No department or skill data available.
      </div>
    );
  }

  const cellMap = new Map(
    data.cells.map((cell) => [
      `${cell.departmentId}-${cell.categoryId}`,
      cell,
    ])
  );

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4">
        <h3 className="font-semibold">
          Competency Heatmap
        </h3>
        <p className="text-sm text-muted-foreground">
          Employee certification coverage by department.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-162.5 border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left">
                Department
              </th>

              {data.skills.map((skill) => (
                <th
                  key={skill.categoryId}
                  className="p-3 text-center"
                >
                  {skill.skillName}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.departments.map((department) => (
              <tr key={department.departmentId}>
                <td className="p-3 font-medium">
                  <div>{department.departmentName}</div>
                  <div className="text-xs text-muted-foreground">
                    {department.totalEmployees} employees
                  </div>
                </td>

                {data.skills.map((skill) => {
                  const cell = cellMap.get(
                    `${department.departmentId}-${skill.categoryId}`
                  );

                  const percentage =
                    cell?.coveragePercentage ?? 0;

                  return (
                    <td
                      key={skill.categoryId}
                      className="p-1 text-center"
                      title={`${cell?.certifiedEmployees ?? 0} / ${department.totalEmployees} certified employees`}
                    >
                      <div
                        className={`rounded-md px-3 py-4 font-semibold ${getCellColor(percentage)}`}
                      >
                        {percentage.toFixed(0)}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>🟢 High: ≥ 70%</span>
        <span>🟡 Medium: 40–69%</span>
        <span>🔴 Low: &lt; 40%</span>
      </div>
    </section>
  );
}
