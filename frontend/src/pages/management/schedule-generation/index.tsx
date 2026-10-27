import { useState, useEffect, useRef } from "react";
import { getBulkSubmission, type BulkSubmission } from "./submission-key";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Save,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  Users,
  RefreshCw,
  ExternalLink,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { scheduleGenerationApi } from "@/api/features/schedule-generation.api";
import { classSetupApi, type SharedClass } from "@/api/features/class-setup.api";
import type {
  ScheduleGenerationContextResponse,
  BulkPreviewRequestDTO,
  BulkPreviewResponseDTO,
  PreviewSessionItemDTO,
} from "@/types/features/schedule-generation";

// Danh sách thứ trong tuần
const WEEK_DAYS = [
  { key: "MONDAY", label: "T2", fullName: "Thứ Hai" },
  { key: "TUESDAY", label: "T3", fullName: "Thứ Ba" },
  { key: "WEDNESDAY", label: "T4", fullName: "Thứ Tư" },
  { key: "THURSDAY", label: "T5", fullName: "Thứ Năm" },
  { key: "FRIDAY", label: "T6", fullName: "Thứ Sáu" },
  { key: "SATURDAY", label: "T7", fullName: "Thứ Bảy" },
  { key: "SUNDAY", label: "CN", fullName: "Chủ Nhật" },
];

// Khung giờ học mẫu
const SLOT_PRESETS = [
  { id: "MORNING", label: "Ca Sáng (08:00 - 12:00)", start: "08:00:00", hours: 4 },
  { id: "AFTERNOON", label: "Ca Chiều (13:30 - 17:30)", start: "13:30:00", hours: 4 },
  { id: "EVENING", label: "Ca Tối (18:00 - 21:00)", start: "18:00:00", hours: 3 },
  { id: "CUSTOM", label: "Tùy chỉnh giờ", start: "08:30:00", hours: 3.5 },
];

// Lấy thứ Hai kế tiếp làm ngày mặc định
const getNextMonday = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() + ((day === 0 ? 1 : 8) - day);
  const nextMon = new Date(d.setDate(diff));
  return nextMon.toISOString().split("T")[0];
};

export default function BulkScheduleGenerationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClassId = searchParams.get("classId");

  // State Lớp học
  const [classes, setClasses] = useState<SharedClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number>(queryClassId ? Number(queryClassId) : 0);
  const [context, setContext] = useState<ScheduleGenerationContextResponse | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState<boolean>(false);

  // State Cấu hình lịch tuần
  const [startDate, setStartDate] = useState<string>(getNextMonday());
  const [selectedDays, setSelectedDays] = useState<string[]>(["MONDAY", "WEDNESDAY", "FRIDAY"]);
  const [selectedSlotPreset, setSelectedSlotPreset] = useState<string>("MORNING");
  const [customStartTime, setCustomStartTime] = useState<string>("08:00:00");
  const [customHours, setCustomHours] = useState<number>(4);
  const [rooms, setRooms] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number>(0);
  const submission = useRef<BulkSubmission | null>(null);
  const [skipHolidays, setSkipHolidays] = useState<boolean>(true);
  const [checkConflicts, setCheckConflicts] = useState<boolean>(true);

  // State Preview trên RAM
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<BulkPreviewResponseDTO | null>(null);
  const [editableSessions, setEditableSessions] = useState<PreviewSessionItemDTO[]>([]);

  // State Lưu lô
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessModal, setSaveSuccessModal] = useState<boolean>(false);
  const [savedCount, setSavedCount] = useState<number>(0);

  // Tải danh sách lớp
  useEffect(() => {
    classSetupApi
      .getActiveClasses()
      .then((data) => {
        if (data && data.length > 0) {
          setClasses(data);
          if (!queryClassId) {
            setSelectedClassId(data[0].id);
          }
        }
      })
      .catch(() => {
        setClasses([]);
        setSelectedClassId(0);
        toast.error("Không tải được danh sách lớp. Kiểm tra kết nối rồi tải lại trang.");
      });
    classSetupApi.getRooms().then((data) => {
      setRooms(data);
      setSelectedRoomId((current) => data.some((room) => room.id === current) ? current : data[0]?.id ?? 0);
    }).catch(() => {
      setRooms([]);
      setSelectedRoomId(0);
      toast.error("Không tải được danh sách phòng. Chưa thể cấu hình lịch học.");
    });
  }, [queryClassId]);

  // Tải ngữ cảnh môn học của lớp đã chọn
  useEffect(() => {
    if (!selectedClassId) return;
    let active = true;
    setContext(null);
    setPreviewResult(null);
    setEditableSessions([]);
    setIsLoadingContext(true);
    scheduleGenerationApi
      .getContext(selectedClassId)
      .then((data) => {
        if (!active) return;
        setContext(data);
        setPreviewResult(null);
        setEditableSessions([]);
      })
      .catch((err) => {
        if (!active) return;
        toast.error(err?.response?.data?.message || "Không thể tải kế hoạch môn học của lớp");
        console.error(err);
      })
      .finally(() => { if (active) setIsLoadingContext(false); });
    return () => { active = false; };
  }, [selectedClassId]);

  // Toggle thứ trong tuần
  const toggleDay = (dayKey: string) => {
    if (selectedDays.includes(dayKey)) {
      if (selectedDays.length === 1) {
        toast.warning("Phải chọn ít nhất 1 thứ trong tuần");
        return;
      }
      setSelectedDays(selectedDays.filter((d) => d !== dayKey));
    } else {
      setSelectedDays([...selectedDays, dayKey]);
    }
  };

  const handleSelectQuickPattern = (pattern: "2-4-6" | "3-5-7" | "ALL") => {
    if (pattern === "2-4-6") setSelectedDays(["MONDAY", "WEDNESDAY", "FRIDAY"]);
    if (pattern === "3-5-7") setSelectedDays(["TUESDAY", "THURSDAY", "SATURDAY"]);
    if (pattern === "ALL") setSelectedDays(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
  };

  // Sinh lịch dự kiến (RAM Preview)
  const handleGeneratePreview = async () => {
    if (!selectedClassId) {
      toast.error("Vui lòng chọn lớp học");
      return;
    }
    if (!startDate) {
      toast.error("Vui lòng chọn ngày bắt đầu");
      return;
    }
    if (selectedDays.length === 0) {
      toast.error("Vui lòng chọn ít nhất một thứ trong tuần");
      return;
    }

    const currentPreset = SLOT_PRESETS.find((s) => s.id === selectedSlotPreset);
    const startTime = selectedSlotPreset === "CUSTOM" ? customStartTime : (currentPreset?.start || "08:00:00");
    const hours = selectedSlotPreset === "CUSTOM" ? customHours : (currentPreset?.hours || 4);

    const roomObj = rooms.find((r) => r.id === selectedRoomId);
    if (!roomObj) {
      toast.error("Vui lòng chọn phòng từ danh sách phòng của hệ thống.");
      return;
    }

    const requestPayload: BulkPreviewRequestDTO = {
      startDate,
      daysOfWeek: selectedDays,
      slotTime: {
        startTime,
        hoursPerSession: hours,
      },
      defaultRoomId: selectedRoomId,
      defaultRoomName: roomObj?.name,
      skipHolidays,
      checkConflicts,
    };

    setIsPreviewing(true);
    try {
      const result = await scheduleGenerationApi.preview(selectedClassId, requestPayload);
      setPreviewResult(result);
      setEditableSessions(result.sessions || []);
      toast.success(`Đã sinh dự kiến ${result.totalSessions} buổi học trên RAM!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Lỗi khi sinh lịch dự kiến");
      console.error(err);
    } finally {
      setIsPreviewing(false);
    }
  };

  // Chỉnh sửa từng dòng trên bảng preview
  const handleUpdateSession = (index: number, field: keyof PreviewSessionItemDTO, value: any) => {
    setEditableSessions((current) => current.map((session, row) => row === index
      ? { ...session, [field]: value, status: "PENDING", conflictDetails: undefined }
      : session));
  };

  // Xóa bớt dòng trong preview
  const handleDeleteSession = (index: number) => {
    const updated = editableSessions.filter((_, i) => i !== index);
    setEditableSessions(updated);
    toast.info("Đã xóa 1 buổi học khỏi bản xem trước");
  };

  // Lưu toàn bộ lô (All-or-Nothing)
  const handleSaveBulk = async () => {
    if (editableSessions.length === 0) {
      toast.warning("Không có buổi học nào để lưu");
      return;
    }

    setIsSaving(true);
    // Sinh Idempotency Key chống gửi lặp / click đúp
    submission.current = getBulkSubmission(submission.current, selectedClassId, editableSessions);
    const idempotencyKey = submission.current.key;

    try {
      const response = await scheduleGenerationApi.save(
        selectedClassId,
        { sessions: editableSessions },
        idempotencyKey
      );
      setSavedCount(response.createdCount);
      setSaveSuccessModal(true);
      toast.success(response.message);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Lỗi khi lưu lịch học vào hệ thống");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                <CalendarDays className="size-6" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Weekly Schedule Generation
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/calendar/preview?classId=${selectedClassId}`)}
              className="gap-1.5 text-slate-700"
            >
              <ExternalLink className="size-4" />
              Xem Thời khóa biểu
            </Button>
          </div>
        </div>

        {/* Khối 1: Chọn lớp & Ngữ cảnh môn học */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-indigo-600" />
                <CardTitle className="text-base font-semibold">1. Lớp học & Kế hoạch môn học của lớp</CardTitle>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                Tạo lịch theo lớp
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-600">Chọn Lớp học</Label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">Chương trình đào tạo</Label>
                <div className="mt-1 px-3 py-2 bg-slate-50 rounded-md border text-sm font-medium text-slate-800">
                  {isLoadingContext ? "Đang tải kế hoạch..." : (context?.programName || "Chương trình đào tạo")} ({context?.programVersion || "1.0"})
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">Tổng thời lượng kế hoạch</Label>
                <div className="mt-1 px-3 py-2 bg-slate-50 rounded-md border text-sm font-semibold text-indigo-700">
                  {context?.totalHours || 0} giờ học ({context?.topics?.length || 0} môn)
                </div>
              </div>
            </div>

            {/* Bảng danh sách môn học theo thứ tự */}
            {context && context.topics && context.topics.length > 0 && (
              <div className="mt-2 border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-16 text-center">Thứ tự</TableHead>
                      <TableHead>Mã môn</TableHead>
                      <TableHead>Tên môn học</TableHead>
                      <TableHead className="w-24 text-center">Thời lượng</TableHead>
                      <TableHead>Giảng viên phụ trách</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {context.topics.map((t) => (
                      <TableRow key={t.topicId}>
                        <TableCell className="text-center font-bold text-slate-700">#{t.sequenceOrder}</TableCell>
                        <TableCell className="font-mono text-xs">{t.topicCode}</TableCell>
                        <TableCell className="font-medium text-slate-900">{t.topicName}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{t.totalHours}h</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{t.assignedTrainerName || "Chưa gán trainer"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Khối 2: Cấu hình lịch tuần */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="size-5 text-indigo-600" />
              <CardTitle className="text-base font-semibold">2. Cấu hình lịch học theo tuần</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Ngày bắt đầu */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Ngày bắt đầu xếp lịch</Label>
                <div className="mt-1.5 relative">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full font-medium"
                  />
                </div>
              </div>

              {/* Ca học / Slot */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Khung giờ học (Ca học)</Label>
                <select
                  value={selectedSlotPreset}
                  onChange={(e) => setSelectedSlotPreset(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                >
                  {SLOT_PRESETS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {selectedSlotPreset === "CUSTOM" && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Label className="text-xs">Giờ bắt đầu</Label>
                      <Input
                        type="time"
                        value={customStartTime}
                        onChange={(e) => setCustomStartTime(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Số giờ/buổi</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={customHours}
                        onChange={(e) => setCustomHours(Number(e.target.value))}
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Phòng học mặc định */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Phòng học mặc định</Label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chọn các thứ trong tuần */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-slate-700">Các thứ học trong tuần</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleSelectQuickPattern("2-4-6")}
                  >
                    Thứ 2 - 4 - 6
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleSelectQuickPattern("3-5-7")}
                  >
                    Thứ 3 - 5 - 7
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleSelectQuickPattern("ALL")}
                  >
                    Thứ 2 đến Thứ 6
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((day) => {
                  const isSelected = selectedDays.includes(day.key);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleDay(day.key)}
                      className={`flex-1 min-w-[70px] py-2.5 px-3 rounded-lg border text-sm font-semibold transition-all ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div>{day.label}</div>
                      <div className={`text-[10px] font-normal ${isSelected ? "text-indigo-100" : "text-slate-400"}`}>
                        {day.fullName}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Checkbox Tùy chọn */}
            <div className="flex flex-wrap gap-6 pt-2 border-t">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={skipHolidays}
                  onChange={(e) => setSkipHolidays(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 size-4"
                />
                Tự động bỏ qua các ngày nghỉ lễ toàn quốc (Tết Dương lịch, 30/4, 1/5, 2/9)
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={checkConflicts}
                  onChange={(e) => setCheckConflicts(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 size-4"
                />
                Tự động kiểm tra trùng giờ với giảng viên và phòng học
              </label>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50 border-t py-3 flex justify-end items-center">
            <Button
              onClick={handleGeneratePreview}
              disabled={isPreviewing}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2 font-medium"
            >
              {isPreviewing ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Sinh lịch dự kiến (Preview)
            </Button>
          </CardFooter>
        </Card>

        {/* Khối 3: Bảng kết quả & Chỉnh sửa trước khi lưu */}
        {previewResult && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                    <CardTitle className="text-base font-semibold">3. Bảng buổi học dự kiến & Chỉnh sửa trực tiếp</CardTitle>
                  </div>
                  <CardDescription>
                    Bạn có thể chỉnh sửa trực tiếp ngày, giờ, phòng hoặc xóa bớt dòng trước khi bấm Lưu toàn bộ.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Tổng số buổi sinh ra</div>
                    <div className="text-base font-bold text-slate-900">{editableSessions.length} buổi</div>
                  </div>
                  <div className="text-right border-l pl-3">
                    <div className="text-xs text-slate-500">Thời gian dự kiến</div>
                    <div className="text-xs font-semibold text-slate-700">
                      {previewResult.startDate} ➔ {previewResult.estimatedEndDate}
                    </div>
                  </div>
                  {previewResult.hasConflicts && (
                    <Badge variant="destructive" className="ml-2 gap-1">
                      <AlertTriangle className="size-3" />
                      {previewResult.conflictCount} xung đột
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {previewResult.hasConflicts && (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Phát hiện xung đột lịch học</AlertTitle>
                  <AlertDescription>
                    Một số buổi học bị trùng lịch với giảng viên hoặc phòng học khác. Bạn có thể sửa ngày/giờ/phòng trực tiếp trên bảng bên dưới trước khi lưu.
                  </AlertDescription>
                </Alert>
              )}

              {/* Bảng chỉnh sửa trực tiếp */}
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-16">Mã tạm</TableHead>
                      <TableHead>Môn học / Tiêu đề</TableHead>
                      <TableHead className="w-36">Ngày học</TableHead>
                      <TableHead className="w-48">Khung giờ</TableHead>
                      <TableHead>Giảng viên</TableHead>
                      <TableHead>Phòng học / Link</TableHead>
                      <TableHead className="w-24 text-center">Trạng thái</TableHead>
                      <TableHead className="w-14 text-center">Xóa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editableSessions.map((session, idx) => {
                      const isConflict = session.status === "CONFLICT";
                      return (
                        <TableRow key={session.tempId} className={isConflict ? "bg-rose-50/50" : undefined}>
                          <TableCell className="font-mono text-xs text-slate-500">{session.tempId}</TableCell>
                          <TableCell>
                            <Input
                              value={session.title || ""}
                              onChange={(e) => handleUpdateSession(idx, "title", e.target.value)}
                              className="h-8 text-xs font-medium"
                            />
                            <div className="text-[10px] text-slate-400 mt-0.5">{session.topicName}</div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={session.date}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                const startPart = session.startTime.split("T")[1] || "08:00:00";
                                const endPart = session.endTime.split("T")[1] || "12:00:00";
                                handleUpdateSession(idx, "date", newDate);
                                handleUpdateSession(idx, "startTime", `${newDate}T${startPart}`);
                                handleUpdateSession(idx, "endTime", `${newDate}T${endPart}`);
                              }}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="time"
                                value={session.startTime.split("T")[1]?.substring(0, 5) || "08:00"}
                                onChange={(e) => {
                                  const datePart = session.date;
                                  handleUpdateSession(idx, "startTime", `${datePart}T${e.target.value}:00`);
                                }}
                                className="h-8 text-xs w-24"
                              />
                              <span className="text-xs text-slate-400">-</span>
                              <Input
                                type="time"
                                value={session.endTime.split("T")[1]?.substring(0, 5) || "12:00"}
                                onChange={(e) => {
                                  const datePart = session.date;
                                  handleUpdateSession(idx, "endTime", `${datePart}T${e.target.value}:00`);
                                }}
                                className="h-8 text-xs w-24"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={session.trainerName || ""}
                              readOnly
                              title="Giảng viên lấy từ phân công giảng dạy của lớp."
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              value={session.roomId ?? ""}
                              onChange={(e) => {
                                const room = rooms.find((item) => item.id === Number(e.target.value));
                                setEditableSessions((current) => current.map((item, row) => row === idx
                                  ? { ...item, roomId: room?.id, roomName: room?.name, status: "PENDING", conflictDetails: undefined }
                                  : item));
                              }}
                              className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                              aria-label={`Phòng học buổi ${idx + 1}`}
                            >
                              <option value="">Chọn phòng</option>
                              {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                            </select>
                          </TableCell>
                          <TableCell className="text-center">
                            {isConflict ? (
                              <Badge variant="destructive" className="text-[10px] whitespace-nowrap">
                                Trùng lịch
                              </Badge>
                            ) : session.status === "PENDING" ? (
                              <Badge variant="outline" className="text-[10px] whitespace-nowrap">Kiểm tra khi lưu</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                Hợp lệ
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSession(idx)}
                              className="size-7 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>

            <CardFooter className="bg-slate-50 border-t py-4 flex flex-col sm:flex-row items-center justify-end gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreviewResult(null);
                    setEditableSessions([]);
                  }}
                  disabled={isSaving}
                >
                  Hủy bản xem trước
                </Button>
                <Button
                  onClick={handleSaveBulk}
                  disabled={isSaving || editableSessions.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold px-6"
                >
                  {isSaving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Lưu toàn bộ {editableSessions.length} buổi học
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}

        {/* Modal Chúc mừng khi lưu thành công */}
        <Dialog open={saveSuccessModal} onOpenChange={setSaveSuccessModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
                <CheckCircle2 className="size-7" />
              </div>
              <DialogTitle className="text-center text-lg">Tạo lịch lớp thành công!</DialogTitle>
              <DialogDescription className="text-center">
                Đã ghi thành công <span className="font-bold text-slate-900">{savedCount} buổi học</span> vào hệ thống cho lớp học này.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setSaveSuccessModal(false);
                  setPreviewResult(null);
                  setEditableSessions([]);
                }}
              >
                Tiếp tục tạo thêm
              </Button>
              <Button
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 gap-1.5"
                onClick={() => {
                  setSaveSuccessModal(false);
                  navigate(`/calendar/preview?classId=${selectedClassId}`);
                }}
              >
                Mở Thời khóa biểu ngay
                <ArrowRight className="size-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
