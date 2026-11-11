
import type { TrainingProgramResponse } from "@/api/features/program.api";

interface ProgramChartsProps {
  programs: TrainingProgramResponse[];
}

export function ProgramCharts({ programs }: ProgramChartsProps) {
  const total = programs.length;
  const active = programs.filter((p) => p.status === "ACTIVE").length;
  const inactive = programs.filter((p) => p.status === "INACTIVE").length;
  const hours = programs.reduce(
    (sum, p) => sum + (Number(p.totalDurationHours) || 0),
    0
  );

  const statuses = [
    { label: "Đang áp dụng", value: active },
    { label: "Ngừng áp dụng", value: inactive },
  ];

  const regions = Object.entries(
    programs.reduce<Record<string, number>>((result, p) => {
      const name = p.region?.trim() || "Chưa đặt khu vực";
      result[name] = (result[name] || 0) + 1;
      return result;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const maxRegion = Math.max(1, ...regions.map(([, value]) => value));

  return (
    <section className="space-y-4" aria-label="Thống kê chương trình đào tạo">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric title="Tổng chương trình" value={total} />
        <Metric title="Đang áp dụng" value={active} />
        <Metric title="Ngừng áp dụng" value={inactive} />
        <Metric title="Tổng thời lượng" value={`${hours} giờ`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Trạng thái chương trình</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tỷ lệ trên danh sách dữ liệu hiện được tải.
          </p>

          <div className="mt-5 space-y-4">
            {statuses.map((item) => {
              const percent = total
                ? Math.round((item.value / total) * 100)
                : 0;

              return (
                <div key={item.label}>
                  <div className="mb-1.5 flex justify-between gap-3 text-sm">
                    <span>{item.label}</span>
                    <span className="font-medium">
                      {item.value} ({percent}%)
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={item.label}
                    aria-valuemin={0}
                    aria-valuemax={total || 1}
                    aria-valuenow={item.value}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Phân bố theo khu vực</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Số chương trình trong từng khu vực.
          </p>

          {regions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Chưa có dữ liệu khu vực.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {regions.map(([name, value]) => (
                <div key={name}>
                  <div className="mb-1.5 flex justify-between gap-3 text-sm">
                    <span className="break-words">{name}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{
                        width: `${(value / maxRegion) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}