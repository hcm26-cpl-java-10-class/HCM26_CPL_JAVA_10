type Props = {
  label?: string;
  /** Dùng cho vùng nhỏ (ví dụ đổi khoảng thời gian) thay vì cả tab. */
  compact?: boolean;
};

/**
 * Skeleton giữ sẵn chiều cao của một tab analytics. Trước đây tab chỉ hiện một dòng chữ
 * "Loading..." nên trang co lại rồi giãn ra khi dữ liệu về, gây cảm giác giật khi đổi tab.
 */
export function AnalyticsLoading({ label = "Loading...", compact = false }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={compact ? "space-y-3" : "min-h-[520px] space-y-3"}
    >
      <span className="sr-only">{label}</span>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border bg-muted/60" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border bg-muted/60" aria-hidden />
    </div>
  );
}
