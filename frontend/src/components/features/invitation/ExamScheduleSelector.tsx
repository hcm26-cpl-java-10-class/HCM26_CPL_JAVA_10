import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Calendar, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import React, { useMemo } from "react";

export type ScheduleMode = "FLEXIBLE" | "FIXED_SHIFT";

export interface ExamScheduleSelectorProps {
    durationMinutes: number;
    scheduleMode: ScheduleMode;
    onScheduleModeChange: (mode: ScheduleMode) => void;
    availableFrom: string;
    onAvailableFromChange: (val: string) => void;
    expiresAt: string;
    onExpiresAtChange: (val: string) => void;
}

// Chuyển đối tượng Date thành định dạng string chuẩn cho input datetime-local: YYYY-MM-DDTHH:mm
function toLocalDatetimeString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function ExamScheduleSelector({
    durationMinutes = 60,
    scheduleMode,
    onScheduleModeChange,
    availableFrom,
    onAvailableFromChange,
    expiresAt,
    onExpiresAtChange,
}: ExamScheduleSelectorProps) {
    // Tính toán độ dài ca thi nếu ở chế độ FIXED_SHIFT
    const shiftInfo = useMemo(() => {
        if (!availableFrom || !expiresAt) return null;
        const start = new Date(availableFrom).getTime();
        const end = new Date(expiresAt).getTime();
        if (isNaN(start) || isNaN(end) || end <= start) return { diffMinutes: 0, isValid: false };
        const diffMinutes = Math.round((end - start) / (1000 * 60));
        return {
            diffMinutes,
            isValid: diffMinutes >= durationMinutes,
            bufferMinutes: Math.max(0, diffMinutes - durationMinutes),
        };
    }, [availableFrom, expiresAt, durationMinutes]);

    // Các hàm tính ngày giờ phím tắt cho chế độ Tự do (FLEXIBLE)
    const applyFlexiblePreset = (hoursToAdd: number) => {
        const d = new Date();
        d.setHours(d.getHours() + hoursToAdd);
        onExpiresAtChange(toLocalDatetimeString(d));
    };

    const applyWeekendPreset = () => {
        const d = new Date();
        const day = d.getDay();
        const daysUntilSunday = (7 - day) % 7;
        d.setDate(d.getDate() + daysUntilSunday);
        d.setHours(23, 59, 0, 0);
        onExpiresAtChange(toLocalDatetimeString(d));
    };

    // Đặt giờ ca thi khi giáo viên chọn giờ bắt đầu
    const handleShiftStartChange = (newStart: string) => {
        onAvailableFromChange(newStart);
        if (newStart) {
            const startDate = new Date(newStart);
            if (!isNaN(startDate.getTime())) {
                const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                onExpiresAtChange(toLocalDatetimeString(endDate));
            }
        }
    };

    // Thêm thời gian dự phòng cho ca thi
    const applyShiftBuffer = (extraMinutes: number) => {
        const baseDate = availableFrom ? new Date(availableFrom) : new Date();
        if (isNaN(baseDate.getTime())) return;
        if (!availableFrom) {
            onAvailableFromChange(toLocalDatetimeString(baseDate));
        }
        const totalMinutes = durationMinutes + extraMinutes;
        const endDate = new Date(baseDate.getTime() + totalMinutes * 60 * 1000);
        onExpiresAtChange(toLocalDatetimeString(endDate));
    };

    return (
        <div className="space-y-4 rounded-lg border bg-slate-50/60 p-3.5">
            {/* Header: Thông tin thời lượng bài thi */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                <div className="flex items-center gap-2">
                    <Clock3 className="size-4 text-blue-600" />
                    <span className="text-sm font-semibold text-slate-800">
                        Cấu hình lịch làm bài
                    </span>
                    <Badge variant="secondary" className="bg-blue-100/80 text-blue-800 text-xs font-medium">
                        ⏱ Thời lượng đề: {durationMinutes} phút
                    </Badge>
                </div>
            </div>

            {/* Bộ chọn 2 chế độ (Mode Selector) */}
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => {
                        onScheduleModeChange("FLEXIBLE");
                        onAvailableFromChange(""); // Mở tự do mặc định mở ngay
                    }}
                    className={`flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-all ${
                        scheduleMode === "FLEXIBLE"
                            ? "border-blue-600 bg-white shadow-sm ring-1 ring-blue-600 text-slate-900"
                            : "border-slate-200 bg-white/50 text-slate-600 hover:bg-white"
                    }`}
                >
                    <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
                        <span>⏱</span>
                        <span>Mở tự do (Hạn chót)</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground line-clamp-2">
                        Làm bất cứ lúc nào trước hạn chót, đủ {durationMinutes} phút
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        onScheduleModeChange("FIXED_SHIFT");
                        if (!availableFrom) {
                            const now = new Date();
                            // Làm tròn đến phút 00 hoặc 30 tiếp theo
                            now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
                            handleShiftStartChange(toLocalDatetimeString(now));
                        }
                    }}
                    className={`flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-all ${
                        scheduleMode === "FIXED_SHIFT"
                            ? "border-blue-600 bg-white shadow-sm ring-1 ring-blue-600 text-slate-900"
                            : "border-slate-200 bg-white/50 text-slate-600 hover:bg-white"
                    }`}
                >
                    <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
                        <span>🎯</span>
                        <span>Theo ca thi cố định</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground line-clamp-2">
                        Thi tập trung, cả lớp vào đúng khung giờ bắt đầu - kết thúc
                    </span>
                </button>
            </div>

            {/* Nội dung tương ứng theo chế độ */}
            {scheduleMode === "FLEXIBLE" ? (
                <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-slate-700">
                                Hạn chót làm bài (Exam Deadline)
                            </Label>
                            <span className="text-[11px] text-muted-foreground">
                                Tùy chọn (để trống = 30 ngày)
                            </span>
                        </div>
                        <Input
                            type="datetime-local"
                            value={expiresAt}
                            onChange={(e) => onExpiresAtChange(e.target.value)}
                            className="bg-white text-sm"
                        />
                    </div>

                    {/* Phím tắt chọn nhanh hạn chót */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                            <Sparkles className="size-3 text-amber-500" /> Chọn nhanh:
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] bg-white hover:bg-slate-100"
                            onClick={() => applyFlexiblePreset(24)}
                        >
                            +24 giờ
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] bg-white hover:bg-slate-100"
                            onClick={() => applyFlexiblePreset(72)}
                        >
                            +3 ngày
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] bg-white hover:bg-slate-100"
                            onClick={() => applyFlexiblePreset(168)}
                        >
                            +7 ngày
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] bg-white hover:bg-slate-100"
                            onClick={applyWeekendPreset}
                        >
                            Cuối tuần (CN 23:59)
                        </Button>
                    </div>

                    <p className="text-[11px] text-slate-500 bg-white/80 rounded p-2 border border-slate-200/80">
                        💡 <strong>Quy tắc làm bài:</strong> Thí sinh có thể truy cập link bài thi bất kỳ lúc nào trước hạn chót. Khi nhấn nút &quot;Bắt đầu làm bài&quot;, đồng hồ {durationMinutes} phút sẽ bắt đầu tính giờ.
                    </p>
                </div>
            ) : (
                <div className="space-y-3 pt-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                <Calendar className="size-3 text-blue-600" /> Thời gian bắt đầu ca thi *
                            </Label>
                            <Input
                                type="datetime-local"
                                value={availableFrom}
                                onChange={(e) => handleShiftStartChange(e.target.value)}
                                className="bg-white text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                <Clock3 className="size-3 text-blue-600" /> Thời gian kết thúc ca thi *
                            </Label>
                            <Input
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(e) => onExpiresAtChange(e.target.value)}
                                className="bg-white text-sm"
                            />
                        </div>
                    </div>

                    {/* Phím tắt thời lượng ca thi */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                            <Sparkles className="size-3 text-amber-500" /> Điều chỉnh ca thi:
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] bg-white hover:bg-slate-100"
                            onClick={() => applyShiftBuffer(0)}
                        >
                            Đúng {durationMinutes} phút
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] bg-white hover:bg-slate-100"
                            onClick={() => applyShiftBuffer(15)}
                        >
                            +{15}p dự phòng ({durationMinutes + 15}p)
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] bg-white hover:bg-slate-100"
                            onClick={() => applyShiftBuffer(30)}
                        >
                            +{30}p dự phòng ({durationMinutes + 30}p)
                        </Button>
                    </div>

                    {/* Trạng thái xác thực ca thi */}
                    {shiftInfo && (
                        <div>
                            {!shiftInfo.isValid ? (
                                <div className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                                    <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                                    <div>
                                        <strong>Cảnh báo:</strong> Thời gian ca thi ({shiftInfo.diffMinutes} phút) đang ngắn hơn thời lượng đề thi ({durationMinutes} phút)! Thí sinh sẽ không đủ thời gian làm bài.
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50/80 px-2.5 py-1.5 text-xs text-green-900">
                                    <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                                    <span>
                                        Ca thi kéo dài <strong>{shiftInfo.diffMinutes} phút</strong> (Làm bài: {durationMinutes}p, Dự phòng: {shiftInfo.bufferMinutes}p).
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="text-[11px] text-slate-500 bg-white/80 rounded p-2 border border-slate-200/80">
                        🔒 <strong>Quy tắc ca thi:</strong> Trước giờ bắt đầu, đề thi sẽ khóa. Đúng giờ kết thúc, hệ thống sẽ tự động đóng đề và thu bài thi.
                    </p>
                </div>
            )}
        </div>
    );
}
