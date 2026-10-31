import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import type { ClassSetupOverview } from "@/api/features/class-setup.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type SetupListFilter = "all" | "needs_setup" | "complete" | "inactive";

interface ClassSetupListCardProps {
  items: ClassSetupOverview[];
  selectedClassId: string;
  loading: boolean;
  busy?: boolean;
  error: string;
  canCreateClass: boolean;
  canUpdateClass: boolean;
  canDeleteClass: boolean;
  onSelectClass: (classId: string) => void;
  onCreateClass: () => void;
  onImportExcel: () => void;
  onViewClass: (item: ClassSetupOverview) => void;
  onEditClass: (item: ClassSetupOverview) => void;
  onDeleteClass: (item: ClassSetupOverview) => void;
}

export function isOverviewClassActive(item: ClassSetupOverview): boolean {
  return !item.status || item.status.toLowerCase() === "active";
}

export function ClassSetupListCard({
  items,
  selectedClassId,
  loading,
  busy = false,
  error,
  canCreateClass,
  canUpdateClass,
  canDeleteClass,
  onSelectClass,
  onCreateClass,
  onImportExcel,
  onViewClass,
  onEditClass,
  onDeleteClass,
}: ClassSetupListCardProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SetupListFilter>("all");

  const counts = useMemo(() => {
    const activeItems = items.filter(isOverviewClassActive);
    return {
      all: items.length,
      needs_setup: activeItems.filter((item) => !item.setupComplete).length,
      complete: activeItems.filter((item) => item.setupComplete).length,
      inactive: items.filter((item) => !isOverviewClassActive(item)).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      const active = isOverviewClassActive(item);
      if (filter === "needs_setup" && (!active || item.setupComplete)) return false;
      if (filter === "complete" && (!active || !item.setupComplete)) return false;
      if (filter === "inactive" && active) return false;

      if (!keyword) return true;
      return [
        item.code,
        item.name,
        item.site,
        item.location,
        item.programCode,
        item.programName,
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(keyword));
    });
  }, [filter, items, search]);

  const filterButtons: Array<{ key: SetupListFilter; label: string; count: number }> = [
    { key: "all", label: "Tất cả lớp", count: counts.all },
    { key: "needs_setup", label: "Cần thiết lập", count: counts.needs_setup },
    { key: "complete", label: "Đã đủ thiết lập", count: counts.complete },
    { key: "inactive", label: "Ngừng hoạt động", count: counts.inactive },
  ];

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="size-5 text-primary" aria-hidden="true" />
            Quản lý lớp học & Danh sách lớp cần thiết lập
          </CardTitle>
          <CardDescription>
            Tạo mới lớp học, import danh sách lớp từ file Excel (.xlsx / .csv), cập nhật hoặc xóa lớp và chọn lớp để thiết lập kế hoạch môn học phía dưới.
          </CardDescription>
        </div>

        {canCreateClass && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading || busy}
              onClick={onImportExcel}
            >
              <Upload className="size-4" aria-hidden="true" />
              Import từ Excel
            </Button>
            <Button
              type="button"
              disabled={loading || busy}
              onClick={onCreateClass}
            >
              <Plus className="size-4" aria-hidden="true" />
              Tạo lớp mới
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filterButtons.map((btn) => (
              <Button
                key={btn.key}
                type="button"
                size="sm"
                variant={filter === btn.key ? "default" : "outline"}
                onClick={() => setFilter(btn.key)}
              >
                {btn.label}
                <Badge
                  variant={filter === btn.key ? "secondary" : "outline"}
                  className="ml-1 px-1.5 py-0 text-xs"
                >
                  {btn.count}
                </Badge>
              </Button>
            ))}
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Tìm kiếm lớp học"
              placeholder="Tìm mã lớp, tên lớp, địa điểm, chương trình..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-36 w-full" />
        ) : error ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Không tải được danh sách lớp từ nguồn dùng chung: {error}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? "Chưa có lớp học nào. Nhấn Tạo lớp mới hoặc Import từ Excel ở góc trên để thêm lớp đầu tiên."
              : "Không có lớp học nào khớp bộ lọc hiện tại."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lớp học</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày học & Địa điểm</TableHead>
                  <TableHead>Học viên</TableHead>
                  <TableHead>Chương trình & Tiến độ kế hoạch</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const active = isOverviewClassActive(item);
                  const isSelected = String(item.classId) === selectedClassId;
                  const statusLabel = active
                    ? "Đang hoạt động"
                    : item.status?.toLowerCase() === "inactive"
                      ? "Ngừng hoạt động"
                      : item.status || "Không xác định";

                  return (
                    <TableRow
                      key={item.classId}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/40"}`}
                      onClick={() => onSelectClass(String(item.classId))}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{item.code}</span>
                          <span className="text-xs text-muted-foreground">#{item.classId}</span>
                          {isSelected && <Badge variant="default" className="text-[11px]">Đang chọn</Badge>}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{item.name}</p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={active ? "secondary" : "outline"}
                          className={active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : ""}
                        >
                          {statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="whitespace-nowrap font-medium">
                          {item.startDate || "—"} <span className="text-muted-foreground">→</span> {item.endDate || "—"}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3 shrink-0" aria-hidden="true" />
                          <span>
                            {[item.site, item.location, item.formatType].filter(Boolean).join(" · ") || "Chưa cập nhật địa điểm"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <span className="font-semibold">{item.enrolledCount}</span>
                        <span className="text-muted-foreground">
                          {item.plannedSize != null ? ` / ${item.plannedSize} HV` : " HV ghi danh"}
                        </span>
                        {item.enrolledCount > 0 && (
                          <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                            Áp dụng khóa SCR-52
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.programId ? (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5 text-sm">
                              <span className="font-medium">{item.programCode}</span>
                              <Badge variant="outline" className="text-[11px]">v{item.programVersion}</Badge>
                              {item.setupComplete ? (
                                <Badge className="bg-emerald-600 text-[11px] text-white hover:bg-emerald-600">
                                  <CheckCircle2 className="mr-1 size-3" /> Đủ thiết lập
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-800 dark:text-amber-300">
                                  <AlertTriangle className="mr-1 size-3" /> Còn thiếu thiết lập
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                              <span>Course: {item.coursesAssignedCount}/{item.totalSubjects}</span>
                              <span>·</span>
                              <span>Phân công: {item.subjectsWithTrainerCount}/{item.totalSubjects}</span>
                              <span>·</span>
                              <span>Lịch học: {item.subjectsWithScheduleCount}/{item.totalSubjects}</span>
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300">
                            Chưa gán chương trình
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={isSelected ? "secondary" : "outline"}
                            onClick={() => onSelectClass(String(item.classId))}
                          >
                            {isSelected ? "Đang xem" : "Thiết lập"}
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            title={`Xem chi tiết lớp ${item.code}`}
                            aria-label={`Xem chi tiết lớp ${item.code}`}
                            disabled={busy}
                            onClick={() => onViewClass(item)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          {canUpdateClass && (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              title={`Chỉnh sửa lớp ${item.code}`}
                              aria-label={`Chỉnh sửa lớp ${item.code}`}
                              disabled={busy}
                              onClick={() => onEditClass(item)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {canDeleteClass && (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              title={`Xóa lớp ${item.code}`}
                              aria-label={`Xóa lớp ${item.code}`}
                              className="text-destructive hover:text-destructive"
                              disabled={busy}
                              onClick={() => onDeleteClass(item)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
