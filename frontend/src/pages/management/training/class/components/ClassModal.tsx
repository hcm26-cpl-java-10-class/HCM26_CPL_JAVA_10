import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/common/NativeSelect";
import type { ExternalClass } from "@/types";
import { clsApi } from "@/api/features/cls.api";
import { AlertCircle } from "lucide-react";

interface ClassModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    classItem?: ExternalClass | null; // null for Create, object for Edit
    onSuccess?: () => void;
    existingClasses?: ExternalClass[];
}

export function ClassModal({ open, onOpenChange, classItem, onSuccess, existingClasses = [] }: ClassModalProps) {
    const queryClient = useQueryClient();
    const isEdit = Boolean(classItem);

    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [site, setSite] = useState("HCM");
    const [traineeType, setTraineeType] = useState("Fresher");
    const [program, setProgram] = useState("FR_NFP_JAVA");
    const [deliveryType, setDeliveryType] = useState("Class");
    const [formatType, setFormatType] = useState("Offline");
    const [skills, setSkills] = useState("Java");
    const [classAdmin, setClassAdmin] = useState("AnhVNP2, BinhHBB");
    const [masterTrainer, setMasterTrainer] = useState("NgaTTT45");
    const [location, setLocation] = useState("Center Building, HCM");
    const [plannedSize, setPlannedSize] = useState<number>(20);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState("planning");

    const [errorMsg, setErrorMsg] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Is code locked in Edit mode? Rule: if status is active/completed, cannot change code
    const isCodeLocked = isEdit && (classItem?.status === "active" || classItem?.status === "completed");

    useEffect(() => {
        if (open) {
            setErrorMsg("");
            if (classItem) {
                setCode(classItem.code || "");
                setName(classItem.name || "");
                setSite(classItem.site || "HCM");
                setTraineeType(classItem.traineeType || "Fresher");
                setProgram(classItem.program || classItem.trainingProgram || "FR_NFP_JAVA");
                setDeliveryType(classItem.deliveryType || "Class");
                setFormatType(classItem.formatType || "Offline");
                setSkills(classItem.skills || "Java");
                setClassAdmin(classItem.classAdmin || "");
                setMasterTrainer(classItem.masterTrainer || "");
                setLocation(classItem.location || "Center Building, HCM");
                setPlannedSize(classItem.plannedSize || 20);
                setStartDate(classItem.startDate || "");
                setEndDate(classItem.endDate || "");
                setStatus(classItem.status || "planning");
            } else {
                // Reset for Create
                setCode("");
                setName("");
                setSite("HCM");
                setTraineeType("Fresher");
                setProgram("FR_NFP_JAVA");
                setDeliveryType("Class");
                setFormatType("Offline");
                setSkills("Java");
                setClassAdmin("AnhVNP2, BinhHBB");
                setMasterTrainer("NgaTTT45");
                setLocation("Center Building, HCM");
                setPlannedSize(20);
                const today = new Date().toISOString().split("T")[0];
                const threeMonthsLater = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
                setStartDate(today);
                setEndDate(threeMonthsLater);
                setStatus("planning");
            }
        }
    }, [open, classItem]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        // ==================== BUSINESS RULES VALIDATION ====================
        // Rule 1: Code validation
        const trimmedCode = code.trim().toUpperCase();
        if (!trimmedCode) {
            setErrorMsg("Quy tắc 1: Mã lớp học (Class Code) không được để trống.");
            return;
        }
        if (!/^[A-Z0-9_-]{4,30}$/.test(trimmedCode)) {
            setErrorMsg("Quy tắc 1: Mã lớp học chỉ chứa chữ hoa, số, gạch dưới và dài từ 4-30 ký tự (VD: HCM26_FR_JAVA_05).");
            return;
        }
        if (!isEdit || trimmedCode !== classItem?.code) {
            const isDuplicate = existingClasses.some(c => c.code?.toUpperCase() === trimmedCode && c.id !== classItem?.id);
            if (isDuplicate) {
                setErrorMsg(`Quy tắc 1: Mã lớp '${trimmedCode}' đã tồn tại trong hệ thống. Vui lòng chọn mã khác.`);
                return;
            }
        }

        // Rule 2: Dates validation
        if (!startDate || !endDate) {
            setErrorMsg("Quy tắc 2: Vui lòng nhập cả ngày bắt đầu và ngày kết thúc khóa học.");
            return;
        }
        if (new Date(endDate) <= new Date(startDate)) {
            setErrorMsg("Quy tắc 2: Ngày kết thúc (End Date) phải diễn ra sau ngày bắt đầu (Start Date).");
            return;
        }

        // Rule 3: Planned size validation
        if (!plannedSize || plannedSize < 1 || plannedSize > 50) {
            setErrorMsg("Quy tắc 3: Sĩ số dự kiến phải từ 1 đến 50 học viên.");
            return;
        }

        // Rule 4: Admin and Trainer validation
        if (!classAdmin.trim()) {
            setErrorMsg("Quy tắc 4: Vui lòng nhập thông tin Quản lý lớp (Class Admin).");
            return;
        }
        if (!masterTrainer.trim()) {
            setErrorMsg("Quy tắc 4: Vui lòng nhập thông tin Giảng viên chính (Master Trainer).");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: Partial<ExternalClass> = {
                code: trimmedCode,
                name: name.trim() || trimmedCode,
                site,
                traineeType,
                program,
                trainingProgram: program,
                deliveryType,
                formatType,
                skills,
                classAdmin: classAdmin.trim(),
                masterTrainer: masterTrainer.trim(),
                location: location.trim(),
                plannedSize: Number(plannedSize),
                startDate,
                endDate,
                status,
                subjectType: "IT Technical",
                plannedRevenue: "0 VND",
                scope: "Unit",
                supplierPartner: "SCM",
                keyProgram: "No",
                globalSe: "No",
                jobRecommendation: "No",
            };

            if (isEdit && classItem) {
                await clsApi.updateClass(classItem.id, payload as any);
            } else {
                await clsApi.createClass(payload as any);
            }

            await queryClient.invalidateQueries({ queryKey: ["classes"] });
            await queryClient.invalidateQueries({ queryKey: ["session", "class-calendars"] });
            onSuccess?.();
            onOpenChange(false);
        } catch (err: any) {
            const serverMsg = err.response?.data?.message || err.message || "Đã xảy ra lỗi khi lưu lớp học.";
            setErrorMsg(serverMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        {isEdit ? `Chỉnh sửa lớp học: ${classItem?.code}` : "Tạo mới lớp học (Create Class)"}
                    </DialogTitle>
                </DialogHeader>

                {errorMsg && (
                    <div className="flex items-start gap-2 p-3 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
                        <AlertCircle className="size-4 shrink-0 mt-0.5" />
                        <div>{errorMsg}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Class Code */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-code" className="font-semibold text-xs">
                                Mã lớp học (Class Code) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="class-code"
                                value={code}
                                disabled={isCodeLocked}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="VD: HCM26_FR_JAVA_05"
                                className="font-mono uppercase"
                            />
                            {isCodeLocked && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                    Quy tắc: Không được đổi mã lớp khi lớp đang học hoặc đã hoàn thành.
                                </p>
                            )}
                        </div>

                        {/* Class Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-name" className="font-semibold text-xs">
                                Tên hiển thị lớp học (Class Name)
                            </Label>
                            <Input
                                id="class-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Mặc định lấy theo mã lớp"
                            />
                        </div>

                        {/* Program */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-program" className="font-semibold text-xs">
                                Chương trình đào tạo (Program) <span className="text-red-500">*</span>
                            </Label>
                            <NativeSelect
                                id="class-program"
                                value={program}
                                onChange={(e) => setProgram(e.target.value)}
                            >
                                <option value="[FSA.HCM] FR_NFP_JAVA_KS">[FSA.HCM] FR_NFP_JAVA_KS</option>
                                <option value="FR_NFP_JAVA_2">FR_NFP_JAVA_2</option>
                                <option value="FR_NFP_JAVA">FR_NFP_JAVA</option>
                                <option value="[NFP] Fresher Full-stack Java Developer">[NFP] Fresher Full-stack Java Developer</option>
                                <option value="FR_NFP_REACT">FR_NFP_REACT</option>
                                <option value="FR_NFP_DOTNET">FR_NFP_DOTNET</option>
                            </NativeSelect>
                        </div>

                        {/* Site */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-site" className="font-semibold text-xs">
                                Khu vực (Site) <span className="text-red-500">*</span>
                            </Label>
                            <NativeSelect
                                id="class-site"
                                value={site}
                                onChange={(e) => setSite(e.target.value)}
                            >
                                <option value="HCM">HCM (TP. Hồ Chí Minh)</option>
                                <option value="HN">HN (Hà Nội)</option>
                                <option value="DN">DN (Đà Nẵng)</option>
                                <option value="QNH">QNH (Quy Nhơn)</option>
                            </NativeSelect>
                        </div>

                        {/* Trainee Type */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-trainee-type" className="font-semibold text-xs">
                                Đối tượng (Trainee Type)
                            </Label>
                            <NativeSelect
                                id="class-trainee-type"
                                value={traineeType}
                                onChange={(e) => setTraineeType(e.target.value)}
                            >
                                <option value="Fresher">Fresher</option>
                                <option value="Intern">Intern</option>
                                <option value="Campus">Campus</option>
                            </NativeSelect>
                        </div>

                        {/* Format Type */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-format-type" className="font-semibold text-xs">
                                Hình thức đào tạo
                            </Label>
                            <NativeSelect
                                id="class-format-type"
                                value={formatType}
                                onChange={(e) => setFormatType(e.target.value)}
                            >
                                <option value="Offline">Offline</option>
                                <option value="Online">Online</option>
                                <option value="Blended">Blended (Kết hợp)</option>
                            </NativeSelect>
                        </div>

                        {/* Planned Size */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-size" className="font-semibold text-xs">
                                Sĩ số dự kiến (1 - 50) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="class-size"
                                type="number"
                                min={1}
                                max={50}
                                value={plannedSize}
                                onChange={(e) => setPlannedSize(parseInt(e.target.value, 10) || 0)}
                            />
                        </div>

                        {/* Status */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-status" className="font-semibold text-xs">
                                Trạng thái lớp học (Status) <span className="text-red-500">*</span>
                            </Label>
                            <NativeSelect
                                id="class-status"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <option value="planning">Planning (Kế hoạch)</option>
                                <option value="assigned">Assigned (Đã phân công)</option>
                                <option value="active">In progress (Đang học)</option>
                                <option value="completed">Training completed (Hoàn thành)</option>
                                <option value="cancelled">Cancelled (Đã hủy)</option>
                            </NativeSelect>
                        </div>

                        {/* Start Date */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-start-date" className="font-semibold text-xs">
                                Ngày bắt đầu (Start Date) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="class-start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        {/* End Date */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-end-date" className="font-semibold text-xs">
                                Ngày kết thúc (End Date) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="class-end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>

                        {/* Class Admin */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-admin" className="font-semibold text-xs">
                                Quản lý lớp (Class Admin) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="class-admin"
                                value={classAdmin}
                                onChange={(e) => setClassAdmin(e.target.value)}
                                placeholder="VD: AnhVNP2, BinhHBB"
                            />
                        </div>

                        {/* Master Trainer */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-trainer" className="font-semibold text-xs">
                                Giảng viên chính (Master Trainer) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="class-trainer"
                                value={masterTrainer}
                                onChange={(e) => setMasterTrainer(e.target.value)}
                                placeholder="VD: NgaTTT45"
                            />
                        </div>

                        {/* Location */}
                        <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor="class-location" className="font-semibold text-xs">
                                Địa điểm cụ thể (Location)
                            </Label>
                            <Input
                                id="class-location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="VD: Center Building, HCM - Room 101"
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Hủy bỏ
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-blue-800 hover:bg-blue-900 text-white">
                            {isSubmitting ? "Đang xử lý..." : isEdit ? "Lưu thay đổi" : "Tạo lớp học"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
