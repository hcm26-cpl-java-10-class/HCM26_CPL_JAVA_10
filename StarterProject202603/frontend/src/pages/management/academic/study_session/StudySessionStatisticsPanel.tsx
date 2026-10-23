import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { subjectApi, studySessionApi } from "@/api";
import type { StudySessionStatisticsFilter } from "@/api/features/academic/study_session.api";

export function StudySessionStatisticsPanel() {
  const [filter, setFilter] = useState<StudySessionStatisticsFilter>({});
  const [subjectId, setSubjectId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalidRange = !!from && !!to && from > to;
  const subjects = useQuery({
    queryKey: ["relation", "study-session", "statistics-subjects"],
    queryFn: async () => {
      // Load every lookup page, rather than silently limiting the Subject filter.
      const first = await subjectApi.getPage({ page: 0, size: 100 });
      const rest = await Promise.all(Array.from({ length: Math.max(0, first.totalPages - 1) },
        (_, index) => subjectApi.getPage({ page: index + 1, size: 100 })));
      return [first, ...rest].flatMap(page => page.content);
    },
  });
  const stats = useQuery({
    queryKey: ["study-session", "statistics", filter],
    queryFn: () => studySessionApi.statistics(filter),
  });
  function apply(event: FormEvent) {
    event.preventDefault();
    if (invalidRange) return;
    setFilter({ subjectId: subjectId ? Number(subjectId) : undefined,
      sessionDateFrom: from || undefined, sessionDateTo: to || undefined });
  }
  const inputClass = "rounded-md border bg-background px-3 py-2 text-sm";
  const distribution = stats.data && [
    { status: "SCHEDULED", count: stats.data.scheduled, color: "bg-blue-500" },
    { status: "COMPLETED", count: stats.data.completed, color: "bg-emerald-500" },
    { status: "CANCELLED", count: stats.data.cancelled, color: "bg-rose-500" },
  ].map(item => ({ ...item, percentage: stats.data.total === 0 ? 0 : item.count * 100 / stats.data.total }));
  const values = stats.data && [
    ["Tổng số buổi học", stats.data.total],
    ["SCHEDULED", stats.data.scheduled],
    ["COMPLETED", stats.data.completed],
    ["CANCELLED", stats.data.cancelled],
    ["Tỷ lệ hoàn thành", `${stats.data.completionRate.toFixed(2)}%`],
    ["Tỷ lệ hủy", `${stats.data.cancellationRate.toFixed(2)}%`],
  ];
  return (
    <section className="mb-5 space-y-4 rounded-lg border bg-card p-4" aria-label="Thống kê buổi học" aria-busy={stats.isFetching}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Thống kê buổi học</h2>
          <p className="text-sm text-muted-foreground">Toàn bộ dữ liệu theo Subject và ngày học, độc lập với bộ lọc và phân trang của bảng.</p>
        </div>
        <button type="button" className={inputClass} disabled={stats.isFetching} onClick={() => void stats.refetch()}>Tải lại thống kê</button>
      </div>
      <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">Subject
          <select className={inputClass} value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">Tất cả Subject</option>
            {subjects.data?.map(subject => <option key={subject.id} value={subject.id}>{subject.subjectName}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">Từ ngày
          <input className={inputClass} type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">Đến ngày
          <input className={inputClass} type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
        </label>
        <button className={inputClass} type="submit" disabled={invalidRange}>Áp dụng</button>
        <button className={inputClass} type="button" onClick={() => { setSubjectId(""); setFrom(""); setTo(""); setFilter({}); }}>Xóa bộ lọc</button>
      </form>
      {invalidRange && <p role="alert" className="text-sm text-destructive">Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.</p>}
      {subjects.isError && <p role="alert">Không thể tải danh sách Subject. <button onClick={() => void subjects.refetch()}>Thử lại</button></p>}
      <div aria-live="polite">
        {stats.isFetching && !stats.isPending && <p role="status">Đang cập nhật thống kê…</p>}
        {stats.isPending ? <p>Đang tải thống kê…</p> : stats.isError ?
          <p role="alert">Không thể tải thống kê. Kiểm tra kết nối và quyền đọc, sau đó thử tải lại.</p> : <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {values?.map(([label, value]) => <div key={label} className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="mt-1 text-2xl font-semibold">{value}</div>
              </div>)}
            </div>
            <figure className="mt-4 space-y-3" aria-label="Biểu đồ tỷ lệ trạng thái">
              <figcaption className="text-sm font-medium">Tỷ lệ trạng thái</figcaption>
              {distribution?.map(item => (
                <div key={item.status} className="space-y-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{item.status}</span>
                    <span>{item.count} ({item.percentage.toFixed(2)}%)</span>
                  </div>
                  <div role="meter" aria-label={item.status} aria-valuemin={0} aria-valuemax={100}
                    aria-valuenow={item.percentage} aria-valuetext={`${item.count} (${item.percentage.toFixed(2)}%)`}
                    className="h-3 overflow-hidden rounded bg-muted">
                    <div className={`h-full ${item.color}`} style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </figure>
            {stats.data.total === 0 && <p className="mt-3 text-sm text-muted-foreground">Không có buổi học phù hợp với bộ lọc đã chọn.</p>}
          </>}
      </div>
    </section>
  );
}
