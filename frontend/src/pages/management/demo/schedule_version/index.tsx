import { useState, useEffect, useMemo } from "react";
import TrainingCalendarAdjustDemo from "./TrainingCalendarAdjustDemo";
import { DropdownMenu } from "radix-ui";
import { scheduleVersionApi } from "@/api/features/demo/schedule_version.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Archive,
  Plus,
  Copy,
  ShieldCheck,
  ShieldAlert,
  Rocket,
  Trash2,
  RotateCcw,
  History,
  FileEdit,
  AlertTriangle,
  Info,
  Eye,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ScheduleVersionDTO,
  ScheduleVersionStatus,
  ScheduleVersionValidationResult,
  EntityConfig,
  EntitySchema,
  FieldSchema,
} from "@/types";
import { auditableFieldsSchema } from "@/types";

// Các lớp mẫu có dữ liệu sẵn trong hệ thống để demo kiểm thử nhanh
const PRESET_CLASSES = [
  { id: "CLASS-01", name: "Lớp CLASS-01 (Kỳ 1 Chuyên sâu SE)" },
  { id: "CLASS-02", name: "Lớp CLASS-02 (Java 10 OJT Web)" },
  { id: "CLASS-03", name: "Lớp CLASS-03 (Mobile App - Chưa có ACTIVE)" },
  { id: "SE-01", name: "Lớp SE-01 (Kỹ thuật phần mềm)" },
  { id: "Java-10", name: "Lớp Java-10 (Lập trình Java core)" },
];

// Tên hiển thị tạm ghép từ mã lớp và số phiên bản; API chưa có calendarName.
function getCalendarName(version: ScheduleVersionDTO) {
  return `${version.classId}_TrainingCalendar_v${version.versionNumber}`;
}

// Dùng dữ liệu audit nếu backend trả về, không thay thế bằng ngày kích hoạt.
function getAuditText(version: ScheduleVersionDTO, field: "updatedAt" | "updatedBy") {
  const value: unknown = Reflect.get(version, field);
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return "—";
}

function formatCalendarDate(value: string | undefined) {
  if (!value || value === "—") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSourceVersionLabel(
  version: ScheduleVersionDTO,
  versions: ScheduleVersionDTO[],
) {
  if (version.clonedFromVersionId == null) return "Created from an empty draft";
  const source = versions.find(
    (item) => String(item.id) === String(version.clonedFromVersionId),
  );
  return source
    ? `Version ${source.versionNumber}`
    : `Source version ID: ${version.clonedFromVersionId}`;
}

export default function ScheduleVersionManagementPage() {
  // Trạng thái chọn lớp (Feature 1)
  const [selectedClassId, setSelectedClassId] = useState<string>("CLASS-01");
  const [customClassInput, setCustomClassInput] = useState<string>("");
  
  // Dữ liệu phiên bản của lớp
  const [versions, setVersions] = useState<ScheduleVersionDTO[]>([]);

  // Bộ lọc danh sách và hộp thông tin phiên bản cho giao diện Training Calendar.
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [detailVersion, setDetailVersion] = useState<ScheduleVersionDTO | null>(null);
  const [adjustVersion, setAdjustVersion] = useState<ScheduleVersionDTO | null>(null);

  const visibleVersions = useMemo(
    () => versions
      .filter((version) => statusFilter === "ALL" || version.status === statusFilter)
      .slice()
      .sort((left, right) => right.versionNumber - left.versionNumber),
    [versions, statusFilter],
  );

  useEffect(() => {
    setStatusFilter("ALL");
    setDetailVersion(null);
  }, [selectedClassId]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modal Tạo nháp rỗng (Feature 3)
  const [createDraftOpen, setCreateDraftOpen] = useState<boolean>(false);
  const [draftNote, setDraftNote] = useState<string>("");
  const [isCreatingDraft, setIsCreatingDraft] = useState<boolean>(false);

  // Modal Clone phiên bản (Feature 4)
  const [cloneModalOpen, setCloneModalOpen] = useState<boolean>(false);
  const [sourceVersionToClone, setSourceVersionToClone] = useState<ScheduleVersionDTO | null>(null);
  const [cloneNote, setCloneNote] = useState<string>("");
  const [isCloning, setIsCloning] = useState<boolean>(false);

  // Modal Kiểm tra xung đột (Feature 5)
  const [validateModalOpen, setValidateModalOpen] = useState<boolean>(false);
  const [validatingVersion, setValidatingVersion] = useState<ScheduleVersionDTO | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ScheduleVersionValidationResult | null>(null);

  // Modal Xác nhận Kích hoạt (Feature 6)
  const [activateModalOpen, setActivateModalOpen] = useState<boolean>(false);
  const [versionToActivate, setVersionToActivate] = useState<ScheduleVersionDTO | null>(null);
  const [activationReason, setActivationReason] = useState<string>("");
  const [activationAgreed, setActivationAgreed] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);

  // Modal Lịch sử kích hoạt
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<ScheduleVersionDTO[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Tải danh sách phiên bản theo lớp
  const loadVersions = async (classId: string, showToast = false) => {
    if (!classId.trim()) return;
    setIsLoading(true);
    try {
      const data = await scheduleVersionApi.getVersionsByClass(classId.trim());
      setVersions(data || []);
      if (showToast) {
        toast.success(`Đã tải ${data.length} phiên bản của lớp ${classId}`);
      }
    } catch (err: any) {
      console.error("Lỗi khi tải phiên bản của lớp:", err);
      toast.error(err?.response?.data?.message || `Không thể tải phiên bản của lớp ${classId}`);
      setVersions([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadVersions(selectedClassId);
  }, [selectedClassId]);

  // Phân loại phiên bản
  const activeVersion = useMemo(
    () => versions.find((v) => v.status === "ACTIVE"),
    [versions]
  );
  const draftVersion = useMemo(
    () => versions.find((v) => v.status === "DRAFT"),
    [versions]
  );
  const archivedVersions = useMemo(
    () => versions.filter((v) => v.status === "ARCHIVED"),
    [versions]
  );

  // 1. Thao tác chọn lớp tùy chỉnh
  const handleApplyCustomClass = () => {
    if (!customClassInput.trim()) {
      toast.error("Vui lòng nhập mã lớp học");
      return;
    }
    setSelectedClassId(customClassInput.trim());
    setCustomClassInput("");
  };

  // 3. Tạo bản nháp rỗng mới
  const handleCreateDraft = async () => {
    if (draftVersion) {
      toast.error(`Lớp ${selectedClassId} đã có bản nháp DRAFT (v${draftVersion.versionNumber}). Vui lòng kích hoạt hoặc xóa bản nháp trước khi tạo mới.`);
      return;
    }
    setIsCreatingDraft(true);
    try {
      const created = await scheduleVersionApi.createDraft(selectedClassId, draftNote.trim() || undefined);
      toast.success(`Đã tạo thành công bản nháp DRAFT v${created.versionNumber} cho lớp ${selectedClassId}!`);
      setCreateDraftOpen(false);
      setDraftNote("");
      loadVersions(selectedClassId);
    } catch (err: any) {
      console.error("Lỗi tạo bản nháp:", err);
      toast.error(err?.response?.data?.message || "Không thể tạo bản nháp. Vui lòng thử lại!");
    } finally {
      setIsCreatingDraft(false);
    }
  };

  // 4. Clone phiên bản
  const openCloneModal = (version: ScheduleVersionDTO) => {
    setSourceVersionToClone(version);
    setCloneNote(`Kế thừa từ bản v${version.versionNumber} (${version.status})`);
    setCloneModalOpen(true);
  };

  const handleExecuteClone = async () => {
    if (!sourceVersionToClone || sourceVersionToClone.id === undefined) return;
    if (draftVersion) {
      toast.error(`Lớp ${selectedClassId} đã có bản nháp DRAFT (v${draftVersion.versionNumber}). Không thể clone thêm nháp mới khi chưa kích hoạt.`);
      return;
    }
    setIsCloning(true);
    try {
      const cloned = await scheduleVersionApi.cloneVersion(
        sourceVersionToClone.id,
        cloneNote.trim() || undefined
      );
      toast.success(`Đã clone thành công bản v${sourceVersionToClone.versionNumber} sang DRAFT mới (v${cloned.versionNumber})!`);
      setCloneModalOpen(false);
      loadVersions(selectedClassId);
    } catch (err: any) {
      console.error("Lỗi clone phiên bản:", err);
      toast.error(err?.response?.data?.message || "Không thể clone phiên bản. Vui lòng thử lại!");
    } finally {
      setIsCloning(false);
    }
  };

  // 5. Kiểm tra xung đột (Validate)
  const handleOpenValidate = async (version: ScheduleVersionDTO) => {
    if (version.id === undefined) return;
    setValidatingVersion(version);
    setValidationResult(null);
    setValidateModalOpen(true);
    setIsValidating(true);
    try {
      const res = await scheduleVersionApi.validateVersion(version.id);
      setValidationResult(res);
      if (res.valid) {
        toast.success(`Phiên bản v${version.versionNumber} hợp lệ! Không có xung đột lịch.`);
      } else {
        toast.warning(`Phát hiện ${res.issues?.length || 0} vấn đề xung đột lịch cần xử lý.`);
      }
    } catch (err: any) {
      console.error("Lỗi kiểm tra xung đột:", err);
      toast.error(err?.response?.data?.message || "Không thể kiểm tra xung đột lịch!");
    } finally {
      setIsValidating(false);
    }
  };

  // 6. Kích hoạt phiên bản (Activate)
  const handleOpenActivate = (version: ScheduleVersionDTO) => {
    setVersionToActivate(version);
    setActivationReason("");
    setActivationAgreed(false);
    setActivateModalOpen(true);
  };

  const handleExecuteActivate = async () => {
    if (!versionToActivate || versionToActivate.id === undefined) return;
    if (!activationReason.trim()) {
      toast.error("Bắt buộc phải nhập Lý do kích hoạt (activationReason)!");
      return;
    }
    if (!activationAgreed) {
      toast.error("Vui lòng tích xác nhận đồng ý kích hoạt!");
      return;
    }
    setIsActivating(true);
    try {
      const activated = await scheduleVersionApi.activateVersion(
        versionToActivate.id,
        activationReason.trim()
      );
      toast.success(`🎉 Kích hoạt thành công! Phiên bản v${activated.versionNumber} hiện là LỊCH CHÍNH THỨC của lớp ${selectedClassId}.`);
      setActivateModalOpen(false);
      loadVersions(selectedClassId);
    } catch (err: any) {
      console.error("Lỗi kích hoạt phiên bản:", err);
      toast.error(err?.response?.data?.message || "Không thể kích hoạt phiên bản!");
    } finally {
      setIsActivating(false);
    }
  };

  // Xóa bản nháp DRAFT
  const handleDeleteDraft = async (version: ScheduleVersionDTO) => {
    if (version.id === undefined) return;
    if (version.status !== "DRAFT") {
      toast.error("Chỉ có thể xóa phiên bản đang ở trạng thái DRAFT!");
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản nháp v${version.versionNumber}? Thao tác này không thể hoàn tác.`)) {
      return;
    }
    try {
      await scheduleVersionApi.deleteDraft(version.id);
      toast.success(`Đã xóa bản nháp v${version.versionNumber} thành công!`);
      loadVersions(selectedClassId);
    } catch (err: any) {
      console.error("Lỗi xóa bản nháp:", err);
      toast.error(err?.response?.data?.message || "Không thể xóa bản nháp!");
    }
  };

  // Xem lịch sử phiên bản
  const handleOpenHistory = async () => {
    setHistoryModalOpen(true);
    setIsLoadingHistory(true);
    try {
      const history = await scheduleVersionApi.getHistory(selectedClassId);
      setHistoryList(history || []);
    } catch (err: any) {
      console.error("Lỗi xem lịch sử:", err);
      toast.error("Không thể tải lịch sử phiên bản!");
      setHistoryList([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Render Badge trạng thái (Feature 2)
  const renderStatusBadge = (status: ScheduleVersionStatus | string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold px-2.5 py-1 gap-1.5 shadow-xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <CheckCircle2 className="size-3.5" />
            Active
          </Badge>
        );
      case "DRAFT":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold px-2.5 py-1 gap-1.5 shadow-xs">
            <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
            Draft
          </Badge>
        );
      case "ARCHIVED":
        return (
          <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30 font-medium px-2.5 py-1 gap-1.5 shadow-xs">
            <Archive className="size-3.5 text-slate-500" />
            Archived
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (adjustVersion) {
    return (
      <TrainingCalendarAdjustDemo
        version={adjustVersion}
        onBack={() => {
          setAdjustVersion(null);
          loadVersions(selectedClassId);
        }}
        onSave={() => {
          setAdjustVersion(null);
          loadVersions(selectedClassId, true);
        }}
      />
    );
  }

  return (
    <MainLayout pathName={{ "schedule-versions": "Quản lý Phiên bản Lịch học" }}>
      <div className="mx-auto w-full max-w-7xl space-y-4 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold">Training Calendar</h1>
            <p className="mt-1 text-sm text-muted-foreground">Class: {selectedClassId}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenHistory}>
              <History className="size-4" /> Version history
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || isRefreshing}
              onClick={() => {
                setIsRefreshing(true);
                void loadVersions(selectedClassId, true);
              }}
            >
              <RotateCcw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              disabled={isLoading || Boolean(draftVersion)}
              onClick={() => {
                setDraftNote("");
                setCreateDraftOpen(true);
              }}
              title={draftVersion ? "This class already has an open draft" : "Create an empty draft"}
            >
              <Plus className="size-4" /> Create draft
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="classSelect">Class</Label>
            <select
              id="classSelect"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PRESET_CLASSES.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
              {!PRESET_CLASSES.some((cls) => cls.id === selectedClassId) && (
                <option value={selectedClassId}>{selectedClassId}</option>
              )}
            </select>
          </div>
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="customClass">Other class ID</Label>
            <div className="flex gap-2">
              <Input
                id="customClass"
                className="h-9"
                placeholder="Enter class ID"
                value={customClassInput}
                onChange={(event) => setCustomClassInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleApplyCustomClass();
                }}
              />
              <Button variant="outline" size="sm" onClick={handleApplyCustomClass}>Apply</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="version-status">Status</Label>
            <select
              id="version-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span>Active: <strong className="text-foreground">{activeVersion ? `v${activeVersion.versionNumber}` : "None"}</strong></span>
          <span>Draft: <strong className="text-foreground">{draftVersion ? `v${draftVersion.versionNumber}` : "None"}</strong></span>
          <span>Archived: {archivedVersions.length}</span>
        </div>

        {/* Header & Tiêu đề */}
        {/* FEATURE 1: Bộ chọn Lớp học (classId) */}
        {/* Dropdown các lớp mẫu */}
        {/* Nhập mã lớp tùy chỉnh */}
        {/* Thông tin thống kê nhanh */}
        {/* FEATURE 2: Thẻ hiển thị Nổi bật Phiên bản ACTIVE hiện hành */}
        {/* Thao tác nhanh với bản ACTIVE */}
        {/* Thông tin cảnh báo nếu lớp đang có bản DRAFT */}

        {/* DANH SÁCH TẤT CẢ PHIÊN BẢN CỦA LỚP */}
        <Card className="overflow-hidden shadow-xs">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">Calendar versions — {selectedClassId}</CardTitle>
            <CardDescription>
              {visibleVersions.length} of {versions.length} versions · Latest version first
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground space-y-3">
                <RotateCcw className="size-8 animate-spin mx-auto text-indigo-600" />
                <p>Đang tải danh sách phiên bản của lớp {selectedClassId}...</p>
              </div>
            ) : versions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground space-y-4">
                <Calendar className="size-12 mx-auto text-muted-foreground/40" />
                <div>
                  <p className="font-semibold text-foreground text-base">Chưa có phiên bản nào cho lớp {selectedClassId}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Bấm nút "Tạo nháp rỗng" bên dưới để khởi tạo phiên bản đầu tiên (v1).
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setDraftNote("");
                    setCreateDraftOpen(true);
                  }}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  <Plus className="size-4" />
                  Tạo bản nháp đầu tiên (Create Draft)
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">              {/* Phiên bản */}
              {/* Trạng thái Badge (Feature 2) */}
              {/* Ghi chú / Lý do */}
              {/* Nguồn kế thừa */}
              {/* Ngày kích hoạt */}
              {/* Các nút thao tác nghiệp vụ */}
              {/* Đối với bản DRAFT: có nút Validate (5), Activate (6), Delete */}
              {/* Đối với bản ACTIVE hoặc ARCHIVED: có nút Clone (Feature 4) */}

                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3">No.</th>
                      <th scope="col" className="px-4 py-3">Calendar name</th>
                      <th scope="col" className="px-4 py-3">Change note</th>
                      <th scope="col" className="px-4 py-3">Last modified date</th>
                      <th scope="col" className="px-4 py-3">Last modified by</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleVersions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No calendar versions match the selected status.
                        </td>
                      </tr>
                    )}
                    {visibleVersions.map((ver, index) => (
                      <tr key={ver.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setDetailVersion(ver)}
                            className="break-words text-left font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {getCalendarName(ver)}
                          </button>
                        </td>
                        <td className="max-w-64 px-4 py-3">
                          <p className="line-clamp-2" title={ver.note || undefined}>{ver.note || "—"}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatCalendarDate(getAuditText(ver, "updatedAt"))}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{getAuditText(ver, "updatedBy")}</td>
                        <td className="whitespace-nowrap px-4 py-3">{renderStatusBadge(ver.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label={`Actions for version ${ver.versionNumber}`}
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                align="end"
                                sideOffset={6}
                                className="z-50 min-w-52 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
                              >
                                <DropdownMenu.Item
                                  className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                                  onSelect={() => setDetailVersion(ver)}
                                >
                                  <Eye className="size-4" /> Version information
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                                {ver.status === "DRAFT" && (
                                  <>
                                    <DropdownMenu.Item
                                      className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 outline-none data-[highlighted]:bg-accent"
                                      onSelect={() => setAdjustVersion(ver)}
                                    >
                                      <FileEdit className="size-4" /> Adjust Training Calendar
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 outline-none data-[highlighted]:bg-accent"
                                      onSelect={() => { void handleOpenValidate(ver); }}
                                    >
                                      <ShieldCheck className="size-4" /> Validate
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 outline-none data-[highlighted]:bg-accent"
                                      onSelect={() => handleOpenActivate(ver)}
                                    >
                                      <Rocket className="size-4" /> Activate
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-destructive outline-none data-[highlighted]:bg-destructive/10"
                                      onSelect={() => { void handleDeleteDraft(ver); }}
                                    >
                                      <Trash2 className="size-4" /> Delete draft
                                    </DropdownMenu.Item>
                                  </>
                                )}
                                {(ver.status === "ACTIVE" || ver.status === "ARCHIVED") && (
                                  <DropdownMenu.Item
                                    disabled={Boolean(draftVersion)}
                                    className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 outline-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    onSelect={() => openCloneModal(ver)}
                                  >
                                    <Copy className="size-4" /> Clone to draft
                                  </DropdownMenu.Item>
                                )}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* Thông tin metadata của phiên bản; nội dung lịch sẽ tích hợp ở bước sau. */}
        <Dialog open={detailVersion !== null} onOpenChange={(open) => { if (!open) setDetailVersion(null); }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Calendar version information</DialogTitle>
              <DialogDescription className="break-words">
                {detailVersion ? getCalendarName(detailVersion) : ""}
              </DialogDescription>
            </DialogHeader>
            {detailVersion && (
              <dl className="space-y-3 text-sm">
                {[
                  ["Class", String(detailVersion.classId)],
                  ["Version", String(detailVersion.versionNumber)],
                  ["Last modified", formatCalendarDate(getAuditText(detailVersion, "updatedAt"))],
                  ["Modified by", getAuditText(detailVersion, "updatedBy")],
                  ["Cloned from", getSourceVersionLabel(detailVersion, versions)],
                  ["Activated at", formatCalendarDate(detailVersion.activatedAt)],
                  ["Activated by", detailVersion.activatedBy || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-b pb-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-words font-medium">{value}</dd>
                  </div>
                ))}
                <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{renderStatusBadge(detailVersion.status)}</dd>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <dt className="font-medium">Change note</dt>
                  <dd className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{detailVersion.note || "No change note"}</dd>
                </div>
              </dl>
            )}
          </DialogContent>
        </Dialog>

        {/* FEATURE 3: MODAL TẠO BẢN NHÁP RỖNG (Create Draft) */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <Dialog open={createDraftOpen} onOpenChange={setCreateDraftOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <FileEdit className="size-5" />
                <DialogTitle>Tạo phiên bản nháp rỗng mới</DialogTitle>
              </div>
              <DialogDescription>
                Tạo bản DRAFT mới cho lớp <strong>{selectedClassId}</strong>. Sau khi tạo, giáo vụ có thể bắt đầu xếp lịch các buổi học (Study Sessions).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="targetClassId">Mã lớp học (Class ID)</Label>
                <Input id="targetClassId" value={selectedClassId} disabled className="bg-muted font-mono" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="draftNote">Ghi chú ban đầu (Note - Tùy chọn)</Label>
                <Textarea
                  id="draftNote"
                  placeholder="Ví dụ: Bản nháp khởi tạo lịch học học kỳ mới, điều chỉnh phòng máy tuần 1-4..."
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  rows={3}
                />
              </div>

              <Alert className="border-indigo-500/20 bg-indigo-500/5 text-xs text-indigo-900 dark:text-indigo-200">
                <Info className="size-4 text-indigo-600" />
                <AlertDescription>
                  Quy tắc hệ thống: Mỗi lớp chỉ được phép có duy nhất 1 bản DRAFT tại một thời điểm. Số phiên bản (versionNumber) sẽ tự động tăng dần.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                type="button"
                onClick={() => setCreateDraftOpen(false)}
                disabled={isCreatingDraft}
                className="cursor-pointer"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                onClick={handleCreateDraft}
                disabled={isCreatingDraft}
                className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                {isCreatingDraft ? "Đang tạo nháp..." : "Xác nhận tạo DRAFT"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* FEATURE 4: MODAL CLONE PHIÊN BẢN (Clone Version) */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <Dialog open={cloneModalOpen} onOpenChange={setCloneModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Copy className="size-5" />
                <DialogTitle>Clone phiên bản sang DRAFT mới</DialogTitle>
              </div>
              <DialogDescription>
                Sao chép lịch học từ phiên bản nguồn <strong>v{sourceVersionToClone?.versionNumber}</strong> ({sourceVersionToClone?.status}) sang bản DRAFT mới cho lớp <strong>{selectedClassId}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phiên bản nguồn:</span>
                  <span className="font-semibold text-foreground">v{sourceVersionToClone?.versionNumber} ({sourceVersionToClone?.status})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ghi chú gốc:</span>
                  <span className="text-foreground italic">{sourceVersionToClone?.note || "Không có"}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cloneNote">Ghi chú cho bản nháp mới (Note)</Label>
                <Textarea
                  id="cloneNote"
                  placeholder="Ghi chú mục đích clone phiên bản này..."
                  value={cloneNote}
                  onChange={(e) => setCloneNote(e.target.value)}
                  rows={3}
                />
              </div>

              <Alert className="border-amber-500/30 bg-amber-500/5 text-xs text-amber-900 dark:text-amber-200">
                <Info className="size-4 text-amber-600" />
                <AlertDescription>
                  Bản DRAFT mới sẽ ghi nhận <code>clonedFromVersionId = {sourceVersionToClone?.id}</code> để phục vụ truy vết lịch sử điều chỉnh lịch.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                type="button"
                onClick={() => setCloneModalOpen(false)}
                disabled={isCloning}
                className="cursor-pointer"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                onClick={handleExecuteClone}
                disabled={isCloning}
                className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                {isCloning ? "Đang clone..." : "Xác nhận Clone"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* FEATURE 5: MODAL KIỂM TRA XUNG ĐỘT LỊCH (Validate Version) */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <Dialog open={validateModalOpen} onOpenChange={setValidateModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="size-5" />
                <DialogTitle>Kiểm tra Xung đột Lịch học</DialogTitle>
              </div>
              <DialogDescription>
                Đối soát toàn bộ các buổi học trong bản nháp <strong>v{validatingVersion?.versionNumber}</strong> với toàn bộ lịch học, phòng học và giảng viên trong hệ thống.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3">
              {isValidating ? (
                <div className="py-8 text-center space-y-3">
                  <RotateCcw className="size-8 animate-spin mx-auto text-blue-600" />
                  <p className="text-sm font-medium text-foreground">
                    Đang quét xung đột phòng, giảng viên và thời gian...
                  </p>
                  <p className="text-xs text-muted-foreground">Gọi ScheduleConflictService</p>
                </div>
              ) : validationResult ? (
                validationResult.valid ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2">
                      <div className="size-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="size-7" />
                      </div>
                      <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                        Phiên bản hoàn toàn hợp lệ!
                      </h3>
                      <p className="text-sm text-foreground/80">
                        Không phát hiện bất kỳ xung đột nào về:
                      </p>
                      <div className="grid grid-cols-3 gap-2 pt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        <div className="bg-emerald-500/10 rounded-md py-2 px-1">✓ Trùng giờ học</div>
                        <div className="bg-emerald-500/10 rounded-md py-2 px-1">✓ Trùng phòng học</div>
                        <div className="bg-emerald-500/10 rounded-md py-2 px-1">✓ Trùng giảng viên</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Phiên bản nháp v{validatingVersion?.versionNumber} đã sẵn sàng để kích hoạt chính thức.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <ShieldAlert className="size-4" />
                      <AlertTitle className="font-semibold">
                        Phát hiện {validationResult.issues?.length || 0} vấn đề xung đột lịch!
                      </AlertTitle>
                      <AlertDescription className="text-xs mt-1">
                        Cần giải quyết tất cả xung đột trước khi hệ thống cho phép kích hoạt bản chính thức.
                      </AlertDescription>
                    </Alert>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {validationResult.issues?.map((issue, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1"
                        >
                          <div className="flex justify-between font-semibold text-destructive">
                            <span>Mã lỗi: {issue.code}</span>
                            {issue.field && <span>Trường: {issue.field}</span>}
                          </div>
                          <p className="text-foreground">{issue.message}</p>
                          {issue.conflictSessionId && (
                            <p className="text-muted-foreground">
                              Buổi học bị xung đột ID: #{issue.conflictSessionId}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : null}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                type="button"
                onClick={() => setValidateModalOpen(false)}
                className="cursor-pointer"
              >
                Đóng
              </Button>
              {validationResult?.valid && validatingVersion?.status === "DRAFT" && (
                <Button
                  type="button"
                  onClick={() => {
                    setValidateModalOpen(false);
                    if (validatingVersion) handleOpenActivate(validatingVersion);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer"
                >
                  <Rocket className="size-4" />
                  Tiến hành Kích hoạt ngay
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* FEATURE 6: MODAL XÁC NHẬN KÍCH HOẠT (Activate Version) */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <Dialog open={activateModalOpen} onOpenChange={setActivateModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Rocket className="size-5" />
                <DialogTitle>Xác nhận Kích hoạt Phiên bản Lịch</DialogTitle>
              </div>
              <DialogDescription>
                Kích hoạt bản nháp <strong>v{versionToActivate?.versionNumber}</strong> thành lịch chính thức hiện hành của lớp <strong>{selectedClassId}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Cảnh báo quan trọng */}
              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
                <AlertTriangle className="size-4 text-amber-600" />
                <AlertTitle className="font-bold">CẢNH BÁO NGUYÊN TỬ (@Transactional)</AlertTitle>
                <AlertDescription className="text-xs space-y-1.5 mt-1">
                  <p>
                    • Bản nháp <strong>v{versionToActivate?.versionNumber}</strong> sẽ trở thành <strong className="text-emerald-600">ACTIVE</strong>. Học viên và giảng viên sẽ theo dõi lịch từ bản này.
                  </p>
                  {activeVersion && (
                    <p>
                      • Bản ACTIVE hiện tại (<strong>v{activeVersion.versionNumber}</strong>) sẽ tự động chuyển sang trạng thái <strong className="text-slate-500">Archived</strong>.
                    </p>
                  )}
                </AlertDescription>
              </Alert>

              {/* BẮT BUỘC NHẬP: Lý do kích hoạt (activationReason) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="activationReason" className="font-semibold text-sm">
                    Lý do kích hoạt (activationReason) <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-xs text-destructive font-medium">Bắt buộc</span>
                </div>
                <Textarea
                  id="activationReason"
                  placeholder="Ví dụ: Áp dụng lịch học chính thức sau khi chốt danh sách giảng viên tuần 1-4; điều chỉnh phòng thực hành máy 2..."
                  value={activationReason}
                  onChange={(e) => setActivationReason(e.target.value)}
                  rows={3}
                  className={!activationReason.trim() ? "border-amber-500/60 focus-visible:ring-amber-500" : ""}
                />
                {!activationReason.trim() && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    * Yêu cầu nhập lý do để ghi nhận vào lịch sử phiên bản (audit log).
                  </p>
                )}
              </div>

              {/* Checkbox xác nhận */}
              <div className="flex items-start gap-2.5 rounded-lg border p-3 bg-muted/30">
                <input
                  type="checkbox"
                  id="agreeActivate"
                  checked={activationAgreed}
                  onChange={(e) => setActivationAgreed(e.target.checked)}
                  className="size-4 mt-0.5 rounded border-input text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="agreeActivate" className="text-xs text-foreground cursor-pointer select-none">
                  Tôi đã kiểm tra xung đột lịch và xác nhận kích hoạt phiên bản <strong>v{versionToActivate?.versionNumber}</strong> làm thời khóa biểu chính thức cho lớp <strong>{selectedClassId}</strong>.
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                type="button"
                onClick={() => setActivateModalOpen(false)}
                disabled={isActivating}
                className="cursor-pointer"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                onClick={handleExecuteActivate}
                disabled={isActivating || !activationReason.trim() || !activationAgreed}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isActivating ? (
                  <>
                    <RotateCcw className="size-4 animate-spin" />
                    Đang kích hoạt...
                  </>
                ) : (
                  <>
                    <Rocket className="size-4" />
                    Xác nhận Kích hoạt (ACTIVE)
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* MODAL LỊCH SỬ PHIÊN BẢN (History) */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 text-indigo-600">
                <History className="size-5" />
                <DialogTitle>Lịch sử Phiên bản Lớp {selectedClassId}</DialogTitle>
              </div>
              <DialogDescription>
                Toàn bộ lịch sử các phiên bản của lớp được sắp xếp theo thời gian mới nhất trước (GET /classes/{selectedClassId}/history).
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-96 overflow-y-auto py-2 pr-1">
              {isLoadingHistory ? (
                <div className="py-8 text-center text-muted-foreground space-y-2">
                  <RotateCcw className="size-6 animate-spin mx-auto text-indigo-600" />
                  <p className="text-xs">Đang tải lịch sử phiên bản...</p>
                </div>
              ) : historyList.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Chưa có lịch sử phiên bản cho lớp này.
                </p>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:bottom-0 before:left-2 before:top-2 before:w-0.5 before:bg-border">
                  {historyList.map((item) => (
                    <div key={item.id} className="relative group">
                      {/* Timeline dot */}
                      <span
                        className={`absolute -left-[29px] top-1.5 size-3.5 rounded-full border-2 border-background ${
                          item.status === "ACTIVE"
                            ? "bg-emerald-500 ring-4 ring-emerald-500/20"
                            : item.status === "DRAFT"
                            ? "bg-amber-500"
                            : "bg-slate-400"
                        }`}
                      />
                      <div className="rounded-lg border bg-card p-3.5 space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              Phiên bản v{item.versionNumber}
                            </span>
                            {renderStatusBadge(item.status)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {item.activatedAt
                              ? new Date(item.activatedAt).toLocaleString("vi-VN")
                              : "Chưa kích hoạt"}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80">
                          <strong>Ghi chú:</strong> {item.note || <span className="italic text-muted-foreground">Không có</span>}
                        </p>
                        {item.clonedFromVersionId && (
                          <p className="text-[11px] text-muted-foreground font-mono">
                            Clone từ ID phiên bản: {item.clonedFromVersionId}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="cursor-pointer"
              >
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

// Giữ lại EntityConfig để tương thích với component registry và auto router
const statusOptions = [
  { value: "DRAFT", label: "Draft", color: "amber" },
  { value: "ACTIVE", label: "Active", color: "green" },
  { value: "ARCHIVED", label: "Archived", color: "slate" },
];

const scheduleVersionSchema: EntitySchema = {
  entityName: "schedule_version",
  idField: "id",
  fields: [
    {
      name: "classId",
      label: "Class ID",
      type: "number",
      sortable: true,
      filterable: true,
      filterType: "numberRange",
      bold: true,
    },
    {
      name: "versionNumber",
      label: "Version",
      type: "number",
      sortable: true,
      filterable: true,
      filterType: "numberRange",
    },
    {
      name: "status",
      label: "Version Status",
      type: "select",
      options: statusOptions,
      filterOptions: statusOptions,
      sortable: true,
      filterable: true,
      filterType: "select",
    },
    {
      name: "note",
      label: "Note / Reason",
      type: "textarea",
      sortable: false,
    },
    {
      name: "activatedAt",
      label: "Activated At",
      type: "datetime",
      sortable: true,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Schedule Version",
  path: "/schedule-versions",
  api: scheduleVersionApi,
  schema: scheduleVersionSchema,
};
