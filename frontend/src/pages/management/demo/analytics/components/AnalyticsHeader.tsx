import type { ReactNode } from "react";
import { AnalyticsSearchInput } from "@/pages/management/demo/analytics/components/AnalyticsSearchInput";

type Stat = {
  label: string;
  value: string;
};

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  stats: Stat[];
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  /** Danh sách chip lọc (ví dụ "All Courses"). */
  filterChips?: string[];
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  /** Chữ ở góc phải của hàng lọc, ví dụ "4 courses available". */
  trailingLabel?: string;
  /**
   * Hiển thị thanh công cụ tìm kiếm + lọc hay không.
   *
   * <p>Đặt false khi đã chọn một khóa học và đang xem phân tích —
   * lúc đó không cần tìm kiếm khóa học nữa.
   */
  showToolbar?: boolean;
  actions?: ReactNode;
};

/**
 * Header của trang Course Analytics.
 *
 * <p>Bố cục (theo thiết kế):
 * <ol>
 *   <li>Eyebrow "ANALYTICS CENTER" + tiêu đề + mô tả.</li>
 *   <li>Hàng 3 thống kê: Available courses / Total learners / Avg. completion.</li>
 *   <li>Hàng tìm kiếm: ô tìm kiếm chiếm một hàng riêng.</li>
 *   <li>Hàng lọc: chip "All Courses" bên trái, số lượng khóa học bên phải.</li>
 * </ol>
 */
export function AnalyticsHeader({
  eyebrow,
  title,
  subtitle,
  stats,
  searchTerm,
  onSearchTermChange,
  filterChips,
  activeFilter,
  onFilterChange,
  trailingLabel,
  showToolbar = true,
  actions,
}: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Tiêu đề */}
      <div className="px-5 pb-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>

      {/* Thống kê tổng quan */}
      <div className="grid grid-cols-1 border-t sm:grid-cols-3">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`px-5 py-4 sm:px-6 ${
              index > 0 ? "border-t sm:border-l sm:border-t-0" : ""
            }`}
          >
            <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
            <div className="mt-0.5 text-sm text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Hàng tìm kiếm — chiếm một hàng riêng */}
      {showToolbar ? (
        <div className="border-t px-5 py-4 sm:px-6">
          <AnalyticsSearchInput
            searchTerm={searchTerm}
            onSearchTermChange={onSearchTermChange}
          />
        </div>
      ) : null}

      {/* Hàng lọc: chip bên trái, số lượng bên phải */}
      {showToolbar ? (
        <div className="border-t px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1">
              {filterChips?.map((chip) => {
                const active = chip === activeFilter;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => onFilterChange?.(chip)}
                    className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                      active
                        ? "text-foreground underline underline-offset-4"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>

            {trailingLabel ? (
              <span className="text-sm text-muted-foreground">{trailingLabel}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
