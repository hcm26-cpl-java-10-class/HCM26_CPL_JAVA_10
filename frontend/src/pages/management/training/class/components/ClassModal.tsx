import React, { useState, useEffect, useMemo, type ComponentProps } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/common/NativeSelect";
import type { ExternalClass, ExternalTrainer, UserDTO } from "@/types";
import { clsApi } from "@/api/features/cls.api";
import { userApi } from "@/api/features/rbac/user.api";
import { classSetupApi } from "@/api/features/class-setup.api";
import { AlertCircle, ChevronDown, X } from "lucide-react";

// Keep the select styling local to the class form.
function ClassSelect(props: ComponentProps<"select">) {
    return <div className="relative">
        <NativeSelect {...props} className="appearance-none pr-9" />
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>;
}

interface ClassModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    classItem?: ExternalClass | null; // null for Create, object for Edit
    onSuccess?: () => void;
    existingClasses?: ExternalClass[];
}

// Mirrors TrainingClassService.TRANSITIONS. Closing remains a backend-only action.
const EDIT_TRANSITIONS: Record<string, string[]> = {
    planning: ["assigned", "cancelled"], assigned: ["active", "cancelled", "planning"],
    active: ["completed", "cancelled"], completed: [], closed: [], cancelled: [],
};
const STATUS_LABELS: Record<string, string> = {
    planning: "Kế hoạch", assigned: "Đã phân công",
    active: "Đang học", completed: "Hoàn thành",
    closed: "Đã đóng", cancelled: "Đã hủy",
};

export function ClassModal({ open, onOpenChange, classItem, onSuccess, existingClasses = [] }: ClassModalProps) {
    const queryClient = useQueryClient();
    const isEdit = Boolean(classItem);

    // Queries for selectable catalogs
    const usersQuery = useQuery({
        queryKey: ["users", "class-admin-options"],
        queryFn: async () => {
            const res = await userApi.getPage({ size: 100 });
            return res?.content || [];
        },
        enabled: open,
        retry: false,
    });

    const trainersQuery = useQuery({
        queryKey: ["class-setup", "verified-trainers", "INTERNAL"],
        queryFn: classSetupApi.verifiedTrainers,
        enabled: open,
        retry: false,
        staleTime: 0,
    });

    const programsQuery = useQuery({
        queryKey: ["class-setup", "active-programs"],
        queryFn: classSetupApi.activePrograms,
        enabled: open,
        retry: false,
        staleTime: 0,
    });

    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [site, setSite] = useState("HCM");
    const [traineeType, setTraineeType] = useState("Fresher");
    const [program, setProgram] = useState("");
    const [programSelectionId, setProgramSelectionId] = useState<number | null>(null);
    const [deliveryType, setDeliveryType] = useState("Class");
    const [formatType, setFormatType] = useState("Offline");
    const [skills, setSkills] = useState("Java");
    const [classAdmin, setClassAdmin] = useState("");
    const [masterTrainer, setMasterTrainer] = useState("");
    const [masterTrainerId, setMasterTrainerId] = useState<number | null>(null);
    const [location, setLocation] = useState("");
    const [plannedSize, setPlannedSize] = useState<number>(20);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState("planning");

    const [errorMsg, setErrorMsg] = useState("");
    const [programError, setProgramError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Candidates calculation
    const adminCandidates = useMemo(() => {
        const list = usersQuery.data || [];
        return list.filter((u: UserDTO) => u.status !== "LOCKED" && u.status !== "INACTIVE");
    }, [usersQuery.data]);

    const trainerCandidates = useMemo(() => {
        return trainersQuery.isError ? [] : trainersQuery.data || [];
    }, [trainersQuery.data, trainersQuery.isError]);

    const programCandidates = programsQuery.isError ? [] : programsQuery.data || [];
    const isProgramLoading = programsQuery.isPending || programsQuery.isFetching;
    const normalizeProgram = (value: string) => value.trim().toLowerCase();
    const selectedProgram = programSelectionId != null
        ? programCandidates.find(p => p.id === programSelectionId)
        : programCandidates.find(p => [p.code, p.name].some(value => normalizeProgram(value) === normalizeProgram(program)));
    const programStatusMessage = isProgramLoading
        ? "Đang tải danh sách chương trình đào tạo..."
        : programsQuery.isError
            ? "Không thể tải danh sách chương trình đào tạo. Vui lòng thử lại."
            : programCandidates.length === 0
                ? "Chưa có chương trình đào tạo đang hoạt động."
                : program && !selectedProgram
                    ? "Chương trình đã lưu hiện không khả dụng. Vui lòng chọn chương trình đang hoạt động."
                    : "";

    const getAdminValue = (u: UserDTO): string => {
        const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || (u as any).name;
        return fullName || u.username || u.email || String(u.id);
    };

    const getAdminLabel = (u: UserDTO): string => {
        const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || (u as any).name;
        if (fullName && u.email) return `${fullName} (${u.email})`;
        if (u.username && u.email) return `${u.username} (${u.email})`;
        return fullName || u.username || u.email || `Người dùng #${u.id}`;
    };

    const getTrainerValue = (t: ExternalTrainer): string => {
        return String(t.id);
    };

    const getTrainerLabel = (t: ExternalTrainer): string => {
        if (t.name && t.email) return `${t.name} (${t.email})`;
        return t.name || t.email || `Giảng viên #${t.id}`;
    };

    // Diagnostics & errors
    const usersErrorStatus = (usersQuery.error as any)?.response?.status ?? (usersQuery.error as any)?.status;
    const usersErrorMessage = usersQuery.isError
        ? usersErrorStatus === 403
            ? "Bạn không có quyền xem danh sách quản lý lớp."
            : "Không thể tải danh sách quản lý lớp. Vui lòng thử lại."
        : (!usersQuery.isLoading && usersQuery.data && usersQuery.data.length === 0)
            ? "Chưa có người quản lý lớp trong hệ thống."
            : "";

    const isTrainerDirectoryLoading = trainersQuery.isPending || trainersQuery.isFetching;
    const isMasterTrainerBlocked = Boolean(
        trainersQuery.isError || (!isTrainerDirectoryLoading && trainerCandidates.length === 0)
    );
    const trainerErrorMessage = isTrainerDirectoryLoading ? "" : trainersQuery.isError
        ? (trainersQuery.error as any)?.message?.includes("BLOCKED")
            ? "Danh sách giảng viên nội bộ chưa được xác minh. Không thể chọn giảng viên."
            : ((trainersQuery.error as any)?.response?.status === 403 || (trainersQuery.error as any)?.status === 403)
                ? "Thiếu quyền truy cập danh sách giảng viên."
                : "Không thể tải danh sách giảng viên. Vui lòng thử lại."
        : trainerCandidates.length === 0
            ? "Chưa có giảng viên nội bộ đang hoạt động. Vui lòng bổ sung hoặc cập nhật hồ sơ tại mục Quản lý giảng viên. Giảng viên đã lưu trên lớp vẫn được giữ nguyên."
            : "";

    const isCodeLocked = isEdit && ["active", "completed", "closed"].includes(classItem?.status ?? "");
    const allowedStatuses = isEdit
        ? [classItem?.status ?? "planning", ...(EDIT_TRANSITIONS[classItem?.status ?? "planning"] ?? [])]
        : ["planning"];

    useEffect(() => {
        if (open) {
            setErrorMsg("");
            setProgramError("");
            if (classItem) {
                setCode(classItem.code || "");
                setName(classItem.name || "");
                setSite(classItem.site || "HCM");
                setTraineeType(classItem.traineeType || "Fresher");
                setProgram(classItem.program || classItem.trainingProgram || String(classItem.programId ?? ""));
                setProgramSelectionId(classItem.programId ?? null);
                setDeliveryType(classItem.deliveryType || "Class");
                setFormatType(classItem.formatType || "Offline");
                setSkills(classItem.skills || "Java");
                setClassAdmin(classItem.classAdmin || "");
                setMasterTrainer(classItem.masterTrainer || "");
                setMasterTrainerId(classItem.masterTrainerId ?? null);
                setLocation(classItem.location || "");
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
                setProgram("");
                setProgramSelectionId(null);
                setDeliveryType("Class");
                setFormatType("Offline");
                setSkills("Java");
                setClassAdmin("");
                setMasterTrainer("");
                setMasterTrainerId(null);
                setLocation("");
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
        setProgramError("");

        if (!program.trim()) {
            setProgramError("Vui lòng chọn chương trình đào tạo.");
            return;
        }
        if (isProgramLoading) {
            setProgramError("Đang tải danh sách chương trình đào tạo. Vui lòng chờ trước khi lưu.");
            return;
        }
        if (programsQuery.isError || !selectedProgram) {
            setProgramError(programsQuery.isError
                ? "Không thể xác minh chương trình đào tạo. Vui lòng tải lại danh sách."
                : "Vui lòng chọn chương trình đào tạo đang hoạt động.");
            return;
        }

        if (!allowedStatuses.includes(status)) {
            setErrorMsg("Trạng thái không hợp lệ cho thao tác hiện tại.");
            return;
        }

        // ==================== BUSINESS RULES VALIDATION ====================
        // Rule 1: Code validation
        const trimmedCode = code.trim().toUpperCase();
        if (!trimmedCode) {
            setErrorMsg("Vui lòng nhập mã lớp học.");
            return;
        }
        if (!/^[A-Z0-9_-]{4,30}$/.test(trimmedCode)) {
            setErrorMsg("Mã lớp học phải dài từ 4 đến 30 ký tự, chỉ chứa chữ hoa, số, dấu gạch dưới hoặc gạch nối.");
            return;
        }
        if (!isEdit || trimmedCode !== classItem?.code) {
            const isDuplicate = existingClasses.some(c => c.code?.toUpperCase() === trimmedCode && c.id !== classItem?.id);
            if (isDuplicate) {
                setErrorMsg(`Mã lớp '${trimmedCode}' đã tồn tại trong hệ thống. Vui lòng chọn mã khác.`);
                return;
            }
        }

        // Rule 2: Dates validation
        if (!startDate || !endDate) {
            setErrorMsg("Vui lòng nhập ngày bắt đầu và ngày kết thúc.");
            return;
        }
        if (new Date(endDate) <= new Date(startDate)) {
            setErrorMsg("Ngày kết thúc phải diễn ra sau ngày bắt đầu.");
            return;
        }

        // Rule 3: Planned size validation
        if (!plannedSize || plannedSize < 1 || plannedSize > 50) {
            setErrorMsg("Sĩ số dự kiến phải từ 1 đến 50 học viên.");
            return;
        }

        // Rule 4: Admin and Trainer validation
        if (!classAdmin.trim()) {
            setErrorMsg("Vui lòng chọn quản lý lớp.");
            return;
        }
        if (!masterTrainer.trim()) {
            setErrorMsg("Vui lòng chọn giảng viên chính.");
            return;
        }
        if (!isEdit && isMasterTrainerBlocked) {
            setErrorMsg("Không thể tạo lớp học khi danh sách giảng viên chưa được xác minh.");
            return;
        }
        if (isEdit && isMasterTrainerBlocked && masterTrainer !== classItem?.masterTrainer) {
            setErrorMsg("Không thể đổi giảng viên chính sang người chưa được xác minh.");
            return;
        }
        const trainerChanged = !isEdit || masterTrainerId !== (classItem?.masterTrainerId ?? null) || masterTrainer !== classItem?.masterTrainer;
        if (trainerChanged && isTrainerDirectoryLoading) {
            setErrorMsg("Đang kiểm tra danh sách giảng viên. Vui lòng chờ trước khi lưu giảng viên mới.");
            return;
        }
        if (trainerChanged && (trainersQuery.isError || !masterTrainerId || !trainerCandidates.some(t => t.id === masterTrainerId))) {
            setErrorMsg("Vui lòng chọn giảng viên nội bộ đang hoạt động và đã được xác minh.");
            return;
        }

        if (!deliveryType.trim()) {
            setErrorMsg("Vui lòng nhập loại hình triển khai.");
            return;
        }

        setIsSubmitting(true);
        try {
            const programValue = [selectedProgram.code, selectedProgram.name].some(value => normalizeProgram(value) === normalizeProgram(program))
                ? program : selectedProgram.code || selectedProgram.name;
            const payload: Partial<ExternalClass> = {
                code: trimmedCode,
                name: name.trim() || trimmedCode,
                site,
                traineeType,
                program: programValue,
                trainingProgram: programValue,
                deliveryType,
                formatType,
                skills,
                classAdmin: classAdmin.trim(),
                masterTrainer: masterTrainer.trim(),
                masterTrainerId,
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
            const saveErrors: Record<number, string> = {
                400: "Thông tin lớp học chưa hợp lệ. Vui lòng kiểm tra lại chương trình đào tạo, giảng viên, địa điểm và thời gian.",
                403: "Bạn không có quyền thực hiện thao tác này.",
                404: "Không tìm thấy lớp học hoặc dữ liệu liên quan. Vui lòng tải lại và thử lại.",
                409: "Thông tin lớp học bị trùng hoặc đã thay đổi. Vui lòng kiểm tra lại trước khi lưu.",
            };
            setErrorMsg(saveErrors[err.response?.status] || "Không thể lưu lớp học. Vui lòng kiểm tra thông tin và thử lại.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent lang="vi" showCloseButton={false} aria-describedby={undefined} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogClose asChild>
                    <Button type="button" variant="ghost" size="icon-sm" className="absolute top-2 right-2" aria-label="Đóng">
                        <X aria-hidden="true" />
                    </Button>
                </DialogClose>
                <DialogHeader>
                    <DialogTitle className="pr-8 text-xl font-bold">
                        {isEdit ? `Chỉnh sửa lớp học: ${classItem?.code}` : "Tạo mới lớp học"}
                    </DialogTitle>
                </DialogHeader>

                {errorMsg && (
                    <div role="alert" className="flex items-start gap-2 p-3 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
                        <AlertCircle className="size-4 shrink-0 mt-0.5" />
                        <div>{errorMsg}</div>
                    </div>
                )}

                <form noValidate onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Class Code */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-code" className="font-semibold text-xs">
                                Mã lớp học <span className="text-red-500">*</span>
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
                                Tên hiển thị lớp học
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
                                Chương trình đào tạo <span className="text-red-500">*</span>
                            </Label>
                            <ClassSelect
                                id="class-program"
                                value={selectedProgram ? String(selectedProgram.id) : program ? "saved" : ""}
                                onChange={(e) => {
                                    const selected = programCandidates.find(p => String(p.id) === e.target.value);
                                    setProgram(selected ? selected.code || selected.name : "");
                                    setProgramSelectionId(selected?.id ?? null);
                                    setProgramError("");
                                }}
                                disabled={isProgramLoading || programsQuery.isError || programCandidates.length === 0}
                                aria-busy={isProgramLoading}
                                aria-invalid={Boolean(programError)}
                                aria-describedby={programError ? "class-program-error" : programStatusMessage ? "class-program-status" : undefined}
                                required
                            >
                                <option value="">-- Chọn Chương trình đào tạo --</option>
                                {program && !selectedProgram && (
                                    <option value="saved" disabled>{program} (Đã lưu{!isProgramLoading && !programsQuery.isError ? "; hiện không khả dụng" : ""})</option>
                                )}
                                {programCandidates.map(p => <option key={p.id} value={String(p.id)}>{p.code} — {p.name}{p.version ? ` · Phiên bản ${p.version}` : ""}</option>)}
                            </ClassSelect>
                            {programError && <p id="class-program-error" role="alert" className="text-xs text-red-600 dark:text-red-400">{programError}</p>}
                            {programStatusMessage && <p id="class-program-status" role={isProgramLoading ? "status" : "alert"} className="text-xs text-muted-foreground">{programStatusMessage}</p>}
                            {programsQuery.isError && (
                                <Button type="button" variant="outline" size="sm" onClick={() => void programsQuery.refetch()}>Tải lại chương trình đào tạo</Button>
                            )}
                        </div>

                        {/* Site */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-site" className="font-semibold text-xs">
                                Khu vực <span className="text-red-500">*</span>
                            </Label>
                            <ClassSelect
                                id="class-site"
                                value={site}
                                onChange={(e) => setSite(e.target.value)}
                            >
                                <option value="HCM">HCM (TP. Hồ Chí Minh)</option>
                                <option value="HN">HN (Hà Nội)</option>
                                <option value="DN">DN (Đà Nẵng)</option>
                                <option value="QNH">QNH (Quy Nhơn)</option>
                            </ClassSelect>
                        </div>

                        {/* Trainee Type */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-trainee-type" className="font-semibold text-xs">
                                Đối tượng
                            </Label>
                            <ClassSelect
                                id="class-trainee-type"
                                value={traineeType}
                                onChange={(e) => setTraineeType(e.target.value)}
                            >
                                <option value="Fresher">Nhân viên mới</option>
                                <option value="Intern">Thực tập sinh</option>
                                <option value="Campus">Sinh viên</option>
                            </ClassSelect>
                        </div>

                        {/* Format Type */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-delivery-type" className="font-semibold text-xs">Loại hình triển khai <span className="text-red-500">*</span></Label>
                            <Input id="class-delivery-type" value={deliveryType === "Class" ? "Lớp học" : deliveryType} onChange={e => setDeliveryType(e.target.value === "Lớp học" ? "Class" : e.target.value)} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="class-format-type" className="font-semibold text-xs">
                                Hình thức đào tạo
                            </Label>
                            <ClassSelect
                                id="class-format-type"
                                value={formatType}
                                onChange={(e) => setFormatType(e.target.value)}
                            >
                                <option value="Offline">Trực tiếp</option>
                                <option value="Online">Trực tuyến</option>
                                <option value="Hybrid">Trực tiếp và trực tuyến đồng thời</option>
                                <option value="Blended">Học kết hợp</option>
                            </ClassSelect>
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
                                value={plannedSize === 0 || (plannedSize as any) === "" ? "" : plannedSize}
                                placeholder="Ví dụ: 25"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "") {
                                        setPlannedSize("" as any);
                                    } else {
                                        const parsed = parseInt(val, 10);
                                        if (!isNaN(parsed)) {
                                            setPlannedSize(Math.max(0, parsed));
                                        }
                                    }
                                }}
                            />
                        </div>

                        {/* Status */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-status" className="font-semibold text-xs">
                                Trạng thái lớp học <span className="text-red-500">*</span>
                            </Label>
                            <ClassSelect
                                id="class-status"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                {allowedStatuses.map(value => <option key={value} value={value}>{STATUS_LABELS[value] ?? "Trạng thái đã lưu"}</option>)}
                            </ClassSelect>
                        </div>

                        {/* Start Date */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-start-date" className="font-semibold text-xs">
                                Ngày bắt đầu <span className="text-red-500">*</span>
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
                                Ngày kết thúc <span className="text-red-500">*</span>
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
                                Quản lý lớp <span className="text-red-500">*</span>
                            </Label>
                            <ClassSelect
                                id="class-admin"
                                value={classAdmin}
                                onChange={(e) => setClassAdmin(e.target.value)}
                                disabled={usersQuery.isLoading}
                            >
                                {classAdmin && !adminCandidates.some(u => getAdminValue(u) === classAdmin) && (
                                    <option value={classAdmin}>{classAdmin} (Đã lưu)</option>
                                )}
                                {!classAdmin && <option value="">-- Chọn Quản lý lớp --</option>}
                                {usersQuery.isLoading && <option value="">Đang tải danh sách quản lý lớp...</option>}
                                {adminCandidates.map((u) => {
                                    const val = getAdminValue(u);
                                    return (
                                        <option key={u.id} value={val}>
                                            {getAdminLabel(u)}
                                        </option>
                                    );
                                })}
                            </ClassSelect>
                            {usersErrorMessage && (
                                <p role="alert" className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                    {usersErrorMessage}
                                </p>
                            )}
                        </div>

                        {/* Master Trainer */}
                        <div className="space-y-1.5">
                            <Label htmlFor="class-trainer" className="font-semibold text-xs">
                                Giảng viên chính <span className="text-red-500">*</span>
                            </Label>
                            <ClassSelect
                                id="class-trainer"
                                value={masterTrainerId != null ? String(masterTrainerId) : masterTrainer ? "legacy" : ""}
                                onChange={(e) => {
                                    const trainer = trainerCandidates.find(t => String(t.id) === e.target.value);
                                    if (trainer) { setMasterTrainerId(trainer.id ?? null); setMasterTrainer(trainer.name ?? ""); }
                                }}
                                disabled={isTrainerDirectoryLoading || isMasterTrainerBlocked}
                                aria-busy={isTrainerDirectoryLoading}
                                aria-describedby={isTrainerDirectoryLoading || trainerErrorMessage ? "class-trainer-status" : undefined}
                            >
                                {masterTrainer && (masterTrainerId == null || !trainerCandidates.some(t => t.id === masterTrainerId)) && (
                                    <option value={masterTrainerId != null ? String(masterTrainerId) : "legacy"}>{masterTrainer} (Đã lưu{masterTrainerId == null ? "; chưa có mã nội bộ" : ""})</option>
                                )}
                                {!masterTrainer && (
                                    <option value="">
                                        {isMasterTrainerBlocked ? "Không có giảng viên khả dụng" : "-- Chọn Giảng viên chính --"}
                                    </option>
                                )}
                                {isTrainerDirectoryLoading && !masterTrainer && <option value="" disabled>Đang kiểm tra danh sách giảng viên...</option>}
                                {trainerCandidates.map((t) => {
                                    const val = getTrainerValue(t);
                                    return (
                                        <option key={t.id} value={val}>
                                            {getTrainerLabel(t)}
                                        </option>
                                    );
                                })}
                            </ClassSelect>
                            {isTrainerDirectoryLoading && (
                                <p id="class-trainer-status" role="status" className="text-xs text-muted-foreground">
                                    Đang kiểm tra danh sách giảng viên...
                                </p>
                            )}
                            {trainerErrorMessage && (
                                <div className="space-y-2">
                                    <p id="class-trainer-status" role="alert" className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                        {trainerErrorMessage}
                                    </p>
                                    <Button type="button" variant="outline" size="sm" onClick={() => void trainersQuery.refetch()}>
                                        Tải lại danh sách giảng viên
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Location */}
                        <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor="class-location" className="font-semibold text-xs">
                                Địa điểm cụ thể
                            </Label>
                            <Input
                                id="class-location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder={formatType === "Online" ? "Đường dẫn họp trực tuyến (http:// hoặc https://)" : "Tên phòng trong danh sách phòng học"}
                            />
                            <p className="text-xs text-muted-foreground">Với hình thức trực tiếp hoặc kết hợp, hãy nhập tên phòng học cụ thể, có sức chứa tối thiểu bằng sĩ số dự kiến. Với hình thức trực tuyến, hãy nhập đường dẫn họp bắt đầu bằng http:// hoặc https://.</p>
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
