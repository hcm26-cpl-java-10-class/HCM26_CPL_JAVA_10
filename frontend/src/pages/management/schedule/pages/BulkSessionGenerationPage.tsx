import { bulkSessionGenerationApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  BulkPreviewRequestDTO,
  BulkPreviewResponseDTO,
  PreviewSessionItemDTO,
  ScheduleGenerationContextResponse,
} from "@/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  DoorOpen,
  Info,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const DEMO_CLASSES = [
  { id: 101, code: "HCM26-FSJ-01", name: "Fullstack Java Developer Bootcamp - HCM" },
  { id: 102, code: "HN26-QAA-02", name: "Quality Assurance & Automation - Hanoi" },
  { id: 103, code: "DN26-DATA-01", name: "Data Engineering Professional - Danang" },
];

const WEEK_DAYS = [
  { key: "MONDAY", label: "T2", fullName: "Thứ Hai" },
  { key: "TUESDAY", label: "T3", fullName: "Thứ Ba" },
  { key: "WEDNESDAY", label: "T4", fullName: "Thứ Tư" },
  { key: "THURSDAY", label: "T5", fullName: "Thứ Năm" },
  { key: "FRIDAY", label: "T6", fullName: "Thứ Sáu" },
  { key: "SATURDAY", label: "T7", fullName: "Thứ Bảy" },
  { key: "SUNDAY", label: "CN", fullName: "Chủ Nhật" },
];

const SLOT_CONFIGS = {
  MORNING: { label: "Sáng (08:00 - 12:00)", start: "08:00:00", end: "12:00:00", hours: 4 },
  AFTERNOON: { label: "Chiều (13:30 - 17:30)", start: "13:30:00", end: "17:30:00", hours: 4 },
  EVENING: { label: "Tối (18:00 - 21:00)", start: "18:00:00", end: "21:00:00", hours: 3 },
  CUSTOM: { label: "Tùy chỉnh giờ", start: "08:30:00", end: "11:30:00", hours: 3 },
};

// Khởi tạo ngày bắt đầu là thứ 2 tuần kế tiếp
const getNextMonday = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() + ((day === 0 ? 1 : 8) - day);
  const nextMon = new Date(d.setDate(diff));
  return nextMon.toISOString().split("T")[0];
};

export function BulkSessionGenerationPage() {
  const navigate = useNavigate();

  // State cấu hình
  const [selectedClassId, setSelectedClassId] = useState<number>(101);
  const [calendarVersionId, setCalendarVersionId] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>(getNextMonday());
  const [selectedDays, setSelectedDays] = useState<string[]>(["MONDAY", "WEDNESDAY", "FRIDAY"]);
  const [slotType, setSlotType] = useState<"MORNING" | "AFTERNOON" | "EVENING" | "CUSTOM">("MORNING");
  const [customStartTime, setCustomStartTime] = useState<string>("08:30:00");
  const [customEndTime, setCustomEndTime] = useState<string>("11:30:00");
  const [defaultTrainerId, setDefaultTrainerId] = useState<number | undefined>(1);
  const [defaultRoomId, setDefaultRoomId] = useState<string>("Phòng A-301");
  const [skipHolidays, setSkipHolidays] = useState<boolean>(true);

  // State kết quả preview & danh sách có thể chỉnh sửa
  const [previewData, setPreviewData] = useState<BulkPreviewResponseDTO | null>(null);
  const [editableSessions, setEditableSessions] = useState<PreviewSessionItemDTO[]>([]);

  // 1. Tải Context (Chương trình đào tạo, Topic, Giảng viên, Phòng, Lễ tết)
  const { data: context, isLoading: isContextLoading } = useQuery<ScheduleGenerationContextResponse>({
    queryKey: ["scheduleGenerationContext", selectedClassId],
    queryFn: () => bulkSessionGenerationApi.getContext(selectedClassId),
  });

  // Áp dụng Trainer/Room mặc định khi context tải xong
  useMemo(() => {
    if (context) {
      if (context.availableTrainers?.length > 0 && !defaultTrainerId) {
        setDefaultTrainerId(context.availableTrainers[0].id);
      }
      if (context.availableRooms?.length > 0 && !defaultRoomId) {
        setDefaultRoomId(context.availableRooms[0].roomId);
      }
    }
  }, [context, defaultTrainerId, defaultRoomId]);

  // 2. Mutation tạo bản xem trước (Preview in RAM)
  const previewMutation = useMutation({
    mutationFn: (req: BulkPreviewRequestDTO) =>
      bulkSessionGenerationApi.generatePreview(selectedClassId, req),
    onSuccess: (data) => {
      setPreviewData(data);
      setEditableSessions(data.sessions || []);
      toast.success(
        `Đã tạo xem trước ${data.totalSessions} buổi học. Đã bỏ qua ${data.skippedHolidaysCount} ngày nghỉ lễ.`
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Không thể tạo bản xem trước.";
      toast.error(msg);
    },
  });

  // 3. Mutation lưu hàng loạt vào DRAFT CalendarVersion (All-or-Nothing + Idempotency)
  const saveMutation = useMutation({
    mutationFn: async ({
      versionId,
      sessions,
    }: {
      versionId: number;
      sessions: PreviewSessionItemDTO[];
    }) => {
      // Tạo Idempotency-Key UUID ngẫu nhiên để chống submit trùng lặp
      const idempotencyKey = crypto.randomUUID();
      return bulkSessionGenerationApi.saveBulkSessions(
        versionId,
        { sessions },
        idempotencyKey
      );
    },
    onSuccess: (res) => {
      toast.success(
        `Lưu thành công ${res.createdCount} buổi học vào Bản nháp lịch học (DRAFT).`
      );
      navigate("/sessions");
    },
    onError: (err: any) => {
      const res = err?.response?.data;
      if (err?.response?.status === 409) {
        toast.error(
          res?.message || "Xung đột: Không được phép lưu vào phiên bản lịch đã ACTIVE."
        );
      } else {
        toast.error(res?.message || "Lưu hàng loạt thất bại.");
      }
    },
  });

  // Handler xử lý Preset thứ trong tuần
  const applyDaysPreset = (preset: "246" | "357" | "allweek") => {
    if (preset === "246") {
      setSelectedDays(["MONDAY", "WEDNESDAY", "FRIDAY"]);
    } else if (preset === "357") {
      setSelectedDays(["TUESDAY", "THURSDAY", "SATURDAY"]);
    } else {
      setSelectedDays(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
    }
  };

  const toggleDay = (dayKey: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
    );
  };

  // Handler kích hoạt tạo Preview
  const handleGeneratePreview = () => {
    if (selectedDays.length === 0) {
      toast.error("Vui lòng chọn ít nhất một thứ trong tuần để xếp lịch.");
      return;
    }
    if (!startDate) {
      toast.error("Vui lòng chọn ngày bắt đầu khóa học.");
      return;
    }

    const slotStart =
      slotType === "CUSTOM" ? customStartTime : SLOT_CONFIGS[slotType].start;
    const slotEnd =
      slotType === "CUSTOM" ? customEndTime : SLOT_CONFIGS[slotType].end;
    const slotHours =
      slotType === "CUSTOM" ? 3 : SLOT_CONFIGS[slotType].hours;

    const payload: BulkPreviewRequestDTO = {
      startDate,
      daysOfWeek: selectedDays,
      slotTime: {
        slotName: slotType,
        startTime: slotStart,
        endTime: slotEnd,
        hoursPerSession: slotHours,
      },
      defaultRoomId,
      skipHolidays,
      checkConflicts: true,
    };

    previewMutation.mutate(payload);
  };

  // Handlers chỉnh sửa trên bảng Preview (Interactive Preview)
  const handleUpdateSessionTrainer = (tempId: string, trainerId: number) => {
    const trainer = context?.availableTrainers?.find((t) => t.id === trainerId);
    setEditableSessions((prev) =>
      prev.map((s) =>
        s.tempId === tempId
          ? {
              ...s,
              trainerId,
              trainerName: trainer ? trainer.name : s.trainerName,
            }
          : s
      )
    );
  };

  const handleUpdateSessionRoom = (tempId: string, roomId: string) => {
    setEditableSessions((prev) =>
      prev.map((s) => (s.tempId === tempId ? { ...s, roomId } : s))
    );
  };

  const handleDeleteSession = (tempId: string) => {
    setEditableSessions((prev) => prev.filter((s) => s.tempId !== tempId));
    toast.info("Đã xóa buổi học khỏi danh sách xem trước.");
  };

  const handleApplyTrainerToAll = (trainerId: number) => {
    const trainer = context?.availableTrainers?.find((t) => t.id === trainerId);
    if (!trainer) return;
    setEditableSessions((prev) =>
      prev.map((s) => ({
        ...s,
        trainerId,
        trainerName: trainer.name,
      }))
    );
    toast.success(`Đã cập nhật Giảng viên ${trainer.name} cho tất cả các buổi.`);
  };

  const handleApplyRoomToAll = (roomId: string) => {
    setEditableSessions((prev) =>
      prev.map((s) => ({
        ...s,
        roomId,
      }))
    );
    toast.success(`Đã cập nhật Phòng học ${roomId} cho tất cả các buổi.`);
  };

  // Handler Xác nhận lưu vào DRAFT
  const handleSaveToDraft = () => {
    if (editableSessions.length === 0) {
      toast.error("Không có buổi học nào để lưu.");
      return;
    }
    saveMutation.mutate({
      versionId: calendarVersionId,
      sessions: editableSessions,
    });
  };

  return (
    <MainLayout
      pathName={{
        sessions: "Schedules",
        "bulk-generate": "Sinh lịch học hàng loạt (F16)",
      }}
    >
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/sessions")}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </Button>
              <Badge variant="outline" className="text-primary border-primary/30">
                F16 - Bulk Generation
              </Badge>
              <Badge variant="secondary">Safety Invariant: DRAFT Only</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Sinh Lịch Học Hàng Loạt (Bulk Session Generator)
            </h1>
            <p className="text-sm text-muted-foreground">
              Phân bổ tự động các Topic theo đúng thứ tự chương trình học, tự động tránh ngày lễ tết và hỗ trợ xem trước điều chỉnh linh hoạt.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/sessions/create")}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Tạo buổi học đơn lẻ
            </Button>
          </div>
        </div>

        {/* Thông tin Invariant & Thao tác an toàn */}
        <Alert className="border-sky-200 bg-sky-50 text-sky-900">
          <Info className="h-4 w-4 text-sky-600" />
          <AlertTitle className="text-sm font-semibold">Quy tắc an toàn hệ thống (BR-UNI-20 & BR-02):</AlertTitle>
          <AlertDescription className="text-xs text-sky-800 space-y-1 mt-1">
            <p>
              • Toàn bộ các buổi học sinh ra sẽ được lưu vào <strong>Calendar Version DRAFT #{calendarVersionId}</strong> theo cơ chế <strong>All-or-Nothing</strong> nguyên tử.
            </p>
            <p>
              • Tính năng không tự động kích hoạt phiên bản sang ACTIVE (quy trình kích hoạt do thành viên Calendar Lifecycle phụ trách).
            </p>
          </AlertDescription>
        </Alert>

        {/* Khối Cấu hình Lập lịch */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột 1 & 2: Form Tham số */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Tham Số Sinh Lịch Học
              </CardTitle>
              <CardDescription>
                Thiết lập ngày khai giảng, các thứ trong tuần và ca học cho lớp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Chọn Lớp & Version */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="select-class">Lớp học cần lập lịch <span className="text-red-500">*</span></Label>
                  <Select
                    value={selectedClassId.toString()}
                    onValueChange={(val) => setSelectedClassId(Number(val))}
                  >
                    <SelectTrigger id="select-class">
                      <SelectValue placeholder="Chọn lớp" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_CLASSES.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.code} - {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="select-version">Calendar Version mục tiêu <span className="text-red-500">*</span></Label>
                  <Select
                    value={calendarVersionId.toString()}
                    onValueChange={(val) => setCalendarVersionId(Number(val))}
                  >
                    <SelectTrigger id="select-version">
                      <SelectValue placeholder="Chọn version" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Version 1.0 (DRAFT - Bản nháp đang sửa)</SelectItem>
                      <SelectItem value="2">Version 2.0 (DRAFT - Tạo mới)</SelectItem>
                      <SelectItem value="999">Version 9.9 (ACTIVE - Cấm ghi, Test Invariant)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Ngày bắt đầu & Ca học */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date">Ngày bắt đầu khóa học <span className="text-red-500">*</span></Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="slot-type">Khung giờ ca học (Slot) <span className="text-red-500">*</span></Label>
                  <Select
                    value={slotType}
                    onValueChange={(v: any) => setSlotType(v)}
                  >
                    <SelectTrigger id="slot-type">
                      <SelectValue placeholder="Chọn ca học" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MORNING">{SLOT_CONFIGS.MORNING.label}</SelectItem>
                      <SelectItem value="AFTERNOON">{SLOT_CONFIGS.AFTERNOON.label}</SelectItem>
                      <SelectItem value="EVENING">{SLOT_CONFIGS.EVENING.label}</SelectItem>
                      <SelectItem value="CUSTOM">{SLOT_CONFIGS.CUSTOM.label}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tùy chỉnh giờ nếu chọn CUSTOM */}
              {slotType === "CUSTOM" && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="custom-start">Giờ bắt đầu</Label>
                    <Input
                      id="custom-start"
                      type="time"
                      value={customStartTime.substring(0, 5)}
                      onChange={(e) => setCustomStartTime(`${e.target.value}:00`)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-end">Giờ kết thúc</Label>
                    <Input
                      id="custom-end"
                      type="time"
                      value={customEndTime.substring(0, 5)}
                      onChange={(e) => setCustomEndTime(`${e.target.value}:00`)}
                    />
                  </div>
                </div>
              )}

              {/* Chọn thứ trong tuần */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Lịch học trong tuần <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyDaysPreset("246")}
                      className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors"
                    >
                      T2-T4-T6
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDaysPreset("357")}
                      className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors"
                    >
                      T3-T5-T7
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDaysPreset("allweek")}
                      className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors"
                    >
                      T2 đến T6
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {WEEK_DAYS.map((day) => {
                    const isSelected = selectedDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background hover:bg-accent text-muted-foreground border-border"
                        }`}
                      >
                        <span className="font-bold text-sm">{day.label}</span>
                        <span className="text-[10px] opacity-80">{day.fullName.replace("Thứ ", "T")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Giảng viên & Phòng mặc định */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="default-trainer">Giảng viên phân công mặc định</Label>
                  <Select
                    value={defaultTrainerId?.toString()}
                    onValueChange={(val) => setDefaultTrainerId(Number(val))}
                  >
                    <SelectTrigger id="default-trainer">
                      <SelectValue placeholder="Chọn giảng viên" />
                    </SelectTrigger>
                    <SelectContent>
                      {context?.availableTrainers?.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name} ({t.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="default-room">Phòng học mặc định</Label>
                  <Select
                    value={defaultRoomId}
                    onValueChange={(val) => setDefaultRoomId(val)}
                  >
                    <SelectTrigger id="default-room">
                      <SelectValue placeholder="Chọn phòng" />
                    </SelectTrigger>
                    <SelectContent>
                      {context?.availableRooms?.map((r) => (
                        <SelectItem key={r.roomId} value={r.roomId}>
                          {r.roomId} - {r.roomName} ({r.capacity} chỗ)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tùy chọn Bỏ qua ngày nghỉ lễ */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="space-y-0.5">
                  <Label htmlFor="skip-holidays" className="text-sm font-medium flex items-center gap-1.5">
                    <CalendarCheck className="h-4 w-4 text-emerald-600" />
                    Tự động bỏ qua ngày nghỉ lễ (RTM-BSG-02)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Hệ thống sẽ tự động dời lịch sang buổi tiếp theo nếu rơi vào danh sách ngày lễ đã cấu hình.
                  </p>
                </div>
                <Switch
                  id="skip-holidays"
                  checked={skipHolidays}
                  onCheckedChange={setSkipHolidays}
                />
              </div>
            </CardContent>

            <CardFooter className="flex justify-between border-t p-4 bg-muted/20">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewData(null);
                  setEditableSessions([]);
                }}
                disabled={!previewData}
              >
                Đặt lại
              </Button>

              <Button
                size="sm"
                onClick={handleGeneratePreview}
                disabled={previewMutation.isPending || isContextLoading}
                className="gap-2"
              >
                {previewMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Tính Toán & Xem Trước (Generate Preview)
              </Button>
            </CardFooter>
          </Card>

          {/* Cột 3: Tóm tắt Khung Đào Tạo (Curriculum Context) */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Cấu Trúc Chương Trình Học
              </CardTitle>
              <CardDescription className="text-xs">
                {context?.programName || "Đang tải dữ liệu..."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground block">Tổng thời lượng</span>
                  <span className="text-base font-bold text-foreground">
                    {context?.totalHours || 0} giờ
                  </span>
                </div>
                <div className="p-2.5 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground block">Tổng số Topics</span>
                  <span className="text-base font-bold text-foreground">
                    {context?.topics?.length || 0} bài học
                  </span>
                </div>
              </div>

              {/* Danh sách Topic theo thứ tự orderIndex (US-F16-01) */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Thứ tự bài học (Topics Sequence):
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
                  {context?.topics?.map((topic) => (
                    <div
                      key={topic.topicId}
                      className="flex items-center justify-between p-2 rounded border bg-card/60 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px]">
                          {topic.sequenceOrder ?? topic.orderIndex}
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{topic.topicName}</p>
                          <p className="text-[10px] text-muted-foreground">{topic.topicCode}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[11px]">
                        {topic.totalHours ?? topic.durationHours}h
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ngày nghỉ lễ cấu hình */}
              <div className="space-y-1.5 pt-2 border-t">
                <span className="text-xs font-semibold text-muted-foreground block">
                  Ngày nghỉ đã cấu hình:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {context?.holidays?.map((h) => (
                    <Badge key={h} variant="secondary" className="text-[10px]">
                      {h}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Khối Bảng Xem Trước Lịch Học (Interactive Preview Table) */}
        {previewData && (
          <Card className="shadow-sm border-primary/20">
            <CardHeader className="border-b bg-muted/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Bảng Xem Trước Lịch Học (Preview Sessions)
                  </CardTitle>
                  <CardDescription>
                    Xem trước kết quả sinh lịch, bạn có thể chỉnh sửa Giảng viên hoặc Phòng học cho từng buổi trước khi xác nhận lưu.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveToDraft}
                    disabled={saveMutation.isPending || editableSessions.length === 0}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {saveMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Xác Nhận Lưu Vào DRAFT (All-or-Nothing)
                  </Button>
                </div>
              </div>

              {/* Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
                <div className="p-3 bg-card border rounded-lg">
                  <span className="text-muted-foreground block">Tổng số buổi dự kiến</span>
                  <span className="text-lg font-bold text-foreground">{editableSessions.length} buổi</span>
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <span className="text-muted-foreground block">Ngày bắt đầu</span>
                  <span className="text-lg font-bold text-foreground">{previewData.startDate}</span>
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <span className="text-muted-foreground block">Dự kiến bế giảng</span>
                  <span className="text-lg font-bold text-foreground">{previewData.estimatedEndDate}</span>
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <span className="text-muted-foreground block">Số ngày nghỉ đã tránh</span>
                  <span className="text-lg font-bold text-emerald-600">
                    {previewData.skippedHolidaysCount} ngày
                  </span>
                </div>
              </div>

              {/* Cảnh báo xung đột nếu có */}
              {previewData.conflictCount > 0 && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Phát hiện {previewData.conflictCount} buổi học có nguy cơ xung đột lịch!</AlertTitle>
                  <AlertDescription className="text-xs">
                    Vui lòng đổi Giảng viên hoặc Phòng học cho các buổi bị đánh dấu đỏ bên dưới trước khi lưu.
                  </AlertDescription>
                </Alert>
              )}

              {/* Thao tác áp dụng nhanh */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs">
                <span className="font-semibold text-muted-foreground">Thao tác nhanh cho tất cả các buổi:</span>
                <div className="flex items-center gap-2">
                  {defaultTrainerId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleApplyTrainerToAll(defaultTrainerId)}
                    >
                      <Users className="h-3.5 w-3.5 text-primary" />
                      Gán lại GV mặc định cho tất cả
                    </Button>
                  )}
                  {defaultRoomId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleApplyRoomToAll(defaultRoomId)}
                    >
                      <DoorOpen className="h-3.5 w-3.5 text-primary" />
                      Gán lại Phòng mặc định cho tất cả
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14 text-center">Buổi</TableHead>
                      <TableHead className="w-32">Ngày & Thứ</TableHead>
                      <TableHead className="w-36">Khung Giờ</TableHead>
                      <TableHead>Chủ Đề (Topic)</TableHead>
                      <TableHead className="w-56">Giảng Viên (Điều chỉnh)</TableHead>
                      <TableHead className="w-44">Phòng Học (Điều chỉnh)</TableHead>
                      <TableHead className="w-28 text-center">Trạng Thái</TableHead>
                      <TableHead className="w-14 text-center">Xóa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editableSessions.map((item, index) => {
                      const startTimeDisplay = item.startTime?.includes("T")
                        ? item.startTime.split("T")[1]?.substring(0, 5)
                        : item.startTime;
                      const endTimeDisplay = item.endTime?.includes("T")
                        ? item.endTime.split("T")[1]?.substring(0, 5)
                        : item.endTime;

                      const isConflicted = item.hasConflict || item.status === "CONFLICT";
                      const dayOfWeekDisplay =
                        item.dayOfWeek ||
                        (item.date
                          ? [
                              "Chủ Nhật",
                              "Thứ Hai",
                              "Thứ Ba",
                              "Thứ Tư",
                              "Thứ Năm",
                              "Thứ Sáu",
                              "Thứ Bảy",
                            ][new Date(item.date).getDay()]
                          : "");

                      return (
                        <TableRow
                          key={item.tempId}
                          className={isConflicted ? "bg-red-50/50 hover:bg-red-50" : ""}
                        >
                          <TableCell className="text-center font-bold text-muted-foreground">
                            #{item.sessionNumber || index + 1}
                          </TableCell>

                          <TableCell>
                            <div className="text-xs">
                              <span className="font-semibold block">{item.date}</span>
                              <span className="text-muted-foreground">{dayOfWeekDisplay}</span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="gap-1 font-mono text-xs">
                              <Clock className="h-3 w-3" />
                              {startTimeDisplay} - {endTimeDisplay}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="text-xs">
                              <span className="font-medium text-foreground block">{item.topicName}</span>
                              {item.isFractional && (
                                <span className="text-[10px] text-amber-600 font-medium">
                                  (Buổi học lẻ thời lượng)
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Giảng viên có thể đổi trực tiếp trên hàng */}
                          <TableCell>
                            <Select
                              value={item.trainerId?.toString()}
                              onValueChange={(val) =>
                                handleUpdateSessionTrainer(item.tempId, Number(val))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {context?.availableTrainers?.map((t) => (
                                  <SelectItem key={t.id} value={t.id.toString()}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Phòng học có thể đổi trực tiếp trên hàng */}
                          <TableCell>
                            <Select
                              value={item.roomId}
                              onValueChange={(val) =>
                                handleUpdateSessionRoom(item.tempId, val)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {context?.availableRooms?.map((r) => (
                                  <SelectItem key={r.roomId} value={r.roomId}>
                                    {r.roomId}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Trạng thái xung đột */}
                          <TableCell className="text-center">
                            {isConflicted ? (
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Xung đột
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                                Hợp lệ
                              </Badge>
                            )}
                          </TableCell>

                          {/* Thao tác xóa */}
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteSession(item.tempId)}
                              title="Xóa buổi này"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t p-4 bg-muted/10">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Hiển thị {editableSessions.length} buổi học đã sẵn sàng để lưu.</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewData(null)}
                >
                  Đóng xem trước
                </Button>

                <Button
                  size="sm"
                  onClick={handleSaveToDraft}
                  disabled={saveMutation.isPending || editableSessions.length === 0}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saveMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Xác Nhận Lưu Vào DRAFT (All-or-Nothing)
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

export default BulkSessionGenerationPage;
