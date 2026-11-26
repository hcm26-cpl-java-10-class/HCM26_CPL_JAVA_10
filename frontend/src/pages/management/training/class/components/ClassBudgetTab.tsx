import {
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Download,
    Info,
    Lock,
    Plus,
    RotateCcw,
    Save,
    Trash2,
    Unlock,
    X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { utils, writeFile } from "xlsx";
import {
    useAddClassActivity,
    useClassActivities,
    useClassOperation,
    useSaveClassOperation,
    useSaveTopicAssessments,
    useTopicAssessments,
} from "@/hooks/useExternalLookups";
import type {
    AssessmentItem,
    ClassOperationData,
    ExternalClass,
    GpaCalculation,
    Milestone,
    TopicAssessment,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/session.utils";
import { autoFitWorksheetColumns } from "@/utils/trainee-import.utils";

function calculateTopicTotal(topic: TopicAssessment): number {
    return (topic.assessments || []).reduce((sum, a) => sum + (Number(a.weightedNumber) || 0), 0);
}

// ===================== MODAL: TOPIC ASSESSMENT CONFIGURATION =====================
interface TopicAssessmentModalProps {
    open: boolean;
    onClose: () => void;
    classId: string;
    onActivityLog: (content: string) => void;
}

function TopicAssessmentModal({ open, onClose, classId, onActivityLog }: TopicAssessmentModalProps) {
    const { data: serverTopics, refetch } = useTopicAssessments(classId);
    const saveMutation = useSaveTopicAssessments(classId);

    const [topics, setTopics] = useState<TopicAssessment[]>([]);
    const [initialTopics, setInitialTopics] = useState<TopicAssessment[]>([]);
    const [openTopicId, setOpenTopicId] = useState<number | null>(1);

    useEffect(() => {
        if (serverTopics && Array.isArray(serverTopics)) {
            setTopics(JSON.parse(JSON.stringify(serverTopics)));
            setInitialTopics(JSON.parse(JSON.stringify(serverTopics)));
            if (serverTopics.length > 0 && !serverTopics.some((t) => t.id === openTopicId)) {
                setOpenTopicId(serverTopics[0].id);
            }
        }
    }, [serverTopics, open]);

    const handleToggleTopic = (id: number) => {
        setOpenTopicId((prev) => (prev === id ? null : id));
    };

    const handleUpdateAssessment = (
        topicId: number,
        assessmentId: number,
        field: keyof AssessmentItem,
        val: any
    ) => {
        setTopics((prev) =>
            prev.map((t) => {
                if (t.id !== topicId) return t;
                return {
                    ...t,
                    assessments: t.assessments.map((a) => {
                        if (a.id !== assessmentId) return a;
                        return {
                            ...a,
                            [field]: val,
                            changeStatus: "waiting", // Marks row as waiting for confirm (pink)
                        };
                    }),
                };
            })
        );
    };

    const handleAddAssessment = (topicId: number) => {
        setTopics((prev) =>
            prev.map((t) => {
                if (t.id !== topicId) return t;
                const newId = Date.now();
                const newItem: AssessmentItem = {
                    id: newId,
                    name: "New Assessment",
                    weightedNumber: 10,
                    quantity: 1,
                    note: "",
                    action: "Keep",
                    changeStatus: "waiting",
                };
                return {
                    ...t,
                    assessments: [...t.assessments, newItem],
                };
            })
        );
    };

    const handleDeleteAssessment = (topicId: number, assessmentId: number) => {
        setTopics((prev) =>
            prev.map((t) => {
                if (t.id !== topicId) return t;
                return {
                    ...t,
                    assessments: t.assessments.filter((a) => a.id !== assessmentId),
                };
            })
        );
    };

    // 2.4: Discard Changes
    const handleDiscard = () => {
        setTopics(JSON.parse(JSON.stringify(initialTopics)));
        toast.info("Đã hoàn tác các thay đổi cấu hình đánh giá chuyên đề.");
    };

    // 2.4: Reject Assessments (persisted to H2, keeps modal open)
    const handleReject = () => {
        const rejected = topics.map((t) => ({
            ...t,
            assessments: t.assessments.map((a) => ({
                ...a,
                changeStatus: "none" as const,
            })),
        }));
        setTopics(rejected);
        saveMutation.mutate(
            { topics: rejected, action: "reject" },
            {
                onSuccess: (updatedTopics) => {
                    if (updatedTopics && Array.isArray(updatedTopics)) {
                        setTopics(JSON.parse(JSON.stringify(updatedTopics)));
                        setInitialTopics(JSON.parse(JSON.stringify(updatedTopics)));
                    }
                    toast.warn("Đã từ chối các thay đổi cấu hình đánh giá.");
                    onActivityLog("has rejected topic assessments changes.");
                    refetch();
                },
                onError: () => {
                    toast.error("Không thể cập nhật trạng thái từ chối vào cơ sở dữ liệu H2!");
                },
            }
        );
    };

    // 2.4: Confirm Assessments with validation (Max 100%, persisted to H2, does NOT auto-close modal)
    const handleConfirm = () => {
        // Validate: no topic can have total weighted number > 100
        const exceedingTopic = topics.find((t) => calculateTopicTotal(t) > 100);
        if (exceedingTopic) {
            const total = calculateTopicTotal(exceedingTopic);
            toast.error(
                `Chuyên đề "${exceedingTopic.title}" có tổng trọng số là ${total}%, vượt quá giới hạn 100%! Vui lòng điều chỉnh lại.`
            );
            setOpenTopicId(exceedingTopic.id);
            return;
        }

        const confirmed = topics.map((t) => ({
            ...t,
            assessments: t.assessments.map((a) => ({
                ...a,
                changeStatus: a.changeStatus === "waiting" ? ("confirmed" as const) : a.changeStatus,
            })),
        }));
        setTopics(confirmed);
        saveMutation.mutate(
            { topics: confirmed, action: "confirm" },
            {
                onSuccess: (updatedTopics) => {
                    if (updatedTopics && Array.isArray(updatedTopics)) {
                        setTopics(JSON.parse(JSON.stringify(updatedTopics)));
                        setInitialTopics(JSON.parse(JSON.stringify(updatedTopics)));
                    } else {
                        setInitialTopics(JSON.parse(JSON.stringify(confirmed)));
                    }
                    toast.success("Xác nhận thay đổi cấu hình đánh giá thành công!");
                    onActivityLog("has confirmed topic assessment configuration.");
                    refetch();
                },
                onError: () => {
                    toast.error("Không thể lưu cấu hình đánh giá vào cơ sở dữ liệu H2!");
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            {/* Modal: widened to max-w-6xl w-[94vw] to ensure spacious layout and avoid narrow horizontal scrollbars */}
            <DialogContent className="sm:max-w-5xl md:max-w-6xl w-[94vw] p-0 overflow-hidden max-h-[92vh] flex flex-col">
                {/* Header with Purple Background as in FAMS Screenshot */}
                <div className="bg-[#5944d3] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <DialogTitle className="text-base font-semibold text-white tracking-wide">
                        Topic Assessment Configuration
                    </DialogTitle>
                    <div className="flex items-center gap-4 text-xs font-medium">
                        {/* Legend boxes */}
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block w-4 h-4 bg-[#fcd4dc] rounded-xs border border-pink-300" />
                            <span className="text-white/90">Waiting for confirm</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block w-4 h-4 bg-[#c8f7d4] rounded-xs border border-green-300" />
                            <span className="text-white/90">Changes confirmed</span>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-1 text-white hover:bg-white/20 transition-colors ml-2"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                </div>

                {/* Accordion List Body */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
                    {topics.map((t) => {
                        const isOpen = openTopicId === t.id;
                        const topicTotal = calculateTopicTotal(t);
                        const isExceeded = topicTotal > 100;

                        return (
                            <div
                                key={t.id}
                                className={cn(
                                    "rounded-xl border bg-card shadow-xs overflow-hidden transition-all",
                                    isExceeded && "border-red-300 dark:border-red-900 ring-1 ring-red-300 dark:ring-red-900"
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => handleToggleTopic(t.id)}
                                    className="w-full flex items-center justify-between px-5 py-3.5 text-left font-medium text-sm hover:bg-muted/50 transition-colors"
                                >
                                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{t.title}</span>
                                    <div className="flex items-center gap-3">
                                        {/* Total weight badge indicator */}
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-xs px-2.5 py-0.5 font-bold transition-colors",
                                                isExceeded
                                                    ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-400"
                                                    : topicTotal === 100
                                                    ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/60 dark:text-green-400"
                                                    : "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400"
                                            )}
                                        >
                                            Total: {topicTotal}/100%
                                        </Badge>
                                        {isOpen ? (
                                            <ChevronUp className="size-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="size-4 text-muted-foreground" />
                                        )}
                                    </div>
                                </button>

                                {isOpen && (
                                    <div className="border-t px-5 py-4 bg-white dark:bg-card space-y-4">
                                        {/* Exceeded 100% Warning Banner */}
                                        {isExceeded && (
                                            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-300">
                                                <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                                                <span>
                                                    Tổng trọng số (Weighted Number) của chuyên đề này hiện là{" "}
                                                    <strong>{topicTotal}%</strong>, vượt quá giới hạn tối đa <strong>100%</strong>. Vui lòng giảm bớt các đầu điểm trước khi xác nhận.
                                                </span>
                                            </div>
                                        )}

                                        <div className="overflow-x-auto rounded-lg border">
                                            <Table className="text-xs w-full">
                                                <TableHeader className="bg-muted/40">
                                                    <TableRow className="border-b">
                                                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[220px]">
                                                            Assessment Name
                                                        </TableHead>
                                                        <TableHead className="w-36 text-center font-semibold text-slate-700 dark:text-slate-300 min-w-[130px]">
                                                            Weighted Number (%)
                                                        </TableHead>
                                                        <TableHead className="w-28 text-center font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">
                                                            Quantity
                                                        </TableHead>
                                                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[200px]">
                                                            Note
                                                        </TableHead>
                                                        <TableHead className="w-28 text-center font-semibold text-slate-700 dark:text-slate-300 min-w-[110px]">
                                                            Action
                                                        </TableHead>
                                                        <TableHead className="w-12 text-center" />
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {t.assessments.map((a) => {
                                                        const rowBg =
                                                            a.changeStatus === "waiting"
                                                                ? "bg-[#fcd4dc]/60 hover:bg-[#fcd4dc]/80 dark:bg-pink-950/40"
                                                                : a.changeStatus === "confirmed"
                                                                  ? "bg-[#c8f7d4]/60 hover:bg-[#c8f7d4]/80 dark:bg-green-950/40"
                                                                  : "";
                                                        return (
                                                            <TableRow key={a.id} className={cn("transition-colors", rowBg)}>
                                                                <TableCell className="font-medium">
                                                                    <Input
                                                                        value={a.name}
                                                                        onChange={(e) =>
                                                                            handleUpdateAssessment(t.id, a.id, "name", e.target.value)
                                                                        }
                                                                        className="h-8 text-xs bg-white/70 dark:bg-card border-slate-200 dark:border-slate-800"
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <div className="relative flex items-center justify-center">
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            max={100}
                                                                            value={a.weightedNumber}
                                                                            onChange={(e) =>
                                                                                handleUpdateAssessment(
                                                                                    t.id,
                                                                                    a.id,
                                                                                    "weightedNumber",
                                                                                    Number(e.target.value) || 0
                                                                                )
                                                                            }
                                                                            className={cn(
                                                                                "h-8 text-xs text-center font-semibold bg-white/70 dark:bg-card border-slate-200 dark:border-slate-800",
                                                                                isExceeded && "border-red-400 text-red-600 font-bold"
                                                                            )}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Input
                                                                        type="number"
                                                                        min={1}
                                                                        value={a.quantity}
                                                                        onChange={(e) =>
                                                                            handleUpdateAssessment(
                                                                                t.id,
                                                                                a.id,
                                                                                "quantity",
                                                                                Number(e.target.value) || 1
                                                                            )
                                                                        }
                                                                        className="h-8 text-xs text-center bg-white/70 dark:bg-card border-slate-200 dark:border-slate-800"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        placeholder="Ghi chú..."
                                                                        value={a.note || ""}
                                                                        onChange={(e) =>
                                                                            handleUpdateAssessment(t.id, a.id, "note", e.target.value)
                                                                        }
                                                                        className="h-8 text-xs bg-white/70 dark:bg-card border-slate-200 dark:border-slate-800"
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <select
                                                                        value={a.action || "Keep"}
                                                                        onChange={(e) =>
                                                                            handleUpdateAssessment(t.id, a.id, "action", e.target.value)
                                                                        }
                                                                        className="h-8 px-2 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-card text-foreground"
                                                                    >
                                                                        <option value="Keep">Keep</option>
                                                                        <option value="Update">Update</option>
                                                                        <option value="Delete">Delete</option>
                                                                    </select>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleDeleteAssessment(t.id, a.id)}
                                                                        className="size-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                                                        title="Xóa đầu điểm"
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

                                        <div className="flex items-center justify-between pt-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleAddAssessment(t.id)}
                                                className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 gap-1.5 h-8"
                                            >
                                                <Plus className="size-3.5" /> Thêm đầu điểm (Assessment)
                                            </Button>
                                            <span className="text-xs text-muted-foreground">
                                                Tổng trọng số: <strong className={cn(isExceeded ? "text-red-600 font-bold" : "text-foreground")}>{topicTotal}%</strong> / 100%
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Buttons: Discard, Reject (Red), Confirm (Purple) */}
                <div className="border-t p-4 px-6 bg-white dark:bg-card flex items-center justify-end gap-3 shrink-0">
                    <Button variant="outline" size="sm" onClick={handleDiscard} className="text-xs">
                        Discard Changes
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleReject}
                        className="bg-[#e02b2b] hover:bg-red-700 text-white text-xs px-4"
                    >
                        Reject Assessments
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleConfirm}
                        className="bg-[#5944d3] hover:bg-[#4b39b5] text-white text-xs px-5 shadow-sm"
                    >
                        Confirm Assessments
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ===================== MAIN TAB: BUDGET & OPERATION INFO =====================
const DEFAULT_GPA_CALCULATION: GpaCalculation = {
    topicMark: 70,
    disciplinePoint: 30,
    bonusPoint: 10,
    penaltyPoint: 20,
};

export function ClassBudgetTab({ classItem }: { classItem: ExternalClass }) {
    const classId = String(classItem.id);
    const { data: serverOpData, isLoading } = useClassOperation(classId);
    const { data: serverTopics = [] } = useTopicAssessments(classId);
    const { data: serverActivities = [] } = useClassActivities(classId);
    const saveOpMutation = useSaveClassOperation(classId);
    const addActivityMutation = useAddClassActivity(classId);

    const [openOperating, setOpenOperating] = useState(true);
    const [openMilestones, setOpenMilestones] = useState(true);
    const [configModalOpen, setConfigModalOpen] = useState(false);

    // Form states
    const [actualEndDate, setActualEndDate] = useState<string>("");
    const [hasNoAllocationNeeds, setHasNoAllocationNeeds] = useState<boolean>(false);
    const [gpaForm, setGpaForm] = useState<GpaCalculation>(DEFAULT_GPA_CALCULATION);
    const [milestones, setMilestones] = useState<Milestone[]>([]);

    useEffect(() => {
        if (serverOpData) {
            setActualEndDate(serverOpData.operatingInfo?.actualEndDate || "");
            setHasNoAllocationNeeds(Boolean(serverOpData.operatingInfo?.hasNoAllocationNeeds));
            const serverGpa = serverOpData.operatingInfo?.gpaCalculation;
            setGpaForm({
                topicMark: serverGpa?.topicMark ?? 70,
                disciplinePoint: serverGpa?.disciplinePoint ?? 30,
                bonusPoint: serverGpa?.bonusPoint ?? 10,
                penaltyPoint: serverGpa?.penaltyPoint ?? 20,
            });
            setMilestones(serverOpData.milestones || []);
        }
    }, [serverOpData, classItem]);

    // Calculate total weighted number from all milestone topics
    const totalWeightedNumber = useMemo(() => {
        return milestones.reduce((sum, m) => {
            return sum + (m.topics || []).reduce((tSum, t) => tSum + (Number(t.weightedNumber) || 0), 0);
        }, 0);
    }, [milestones]);

    const totalMilestoneTopics = useMemo(() => {
        return milestones.reduce((sum, m) => sum + (m.topics?.length || 0), 0);
    }, [milestones]);

    const gpaBaseTotal = (Number(gpaForm.topicMark) || 0) + (Number(gpaForm.disciplinePoint) || 0);
    const isGpaValid =
        gpaBaseTotal === 100 &&
        gpaForm.topicMark >= 0 &&
        gpaForm.disciplinePoint >= 0 &&
        gpaForm.bonusPoint >= 0 &&
        gpaForm.bonusPoint <= 100 &&
        gpaForm.penaltyPoint >= 0 &&
        gpaForm.penaltyPoint <= 100;

    const invalidPassingTopic = useMemo(() => {
        for (const m of milestones) {
            for (const t of m.topics || []) {
                const max = Number(t.maxScore ?? 10) || 10;
                const passing = Number(t.passingScore ?? 6);
                if (!Number.isFinite(passing) || passing < 0 || passing > max) {
                    return { milestoneName: m.name, topic: t.topic, max, passing };
                }
            }
        }
        return null;
    }, [milestones]);

    const handleToggleMilestoneStatus = (milestoneId: number) => {
        setMilestones((prev) =>
            prev.map((m) =>
                m.id === milestoneId
                    ? { ...m, status: m.status === "Draft" ? "Baselined" : "Draft" }
                    : m
            )
        );
    };

    const handleUpdateMilestoneField = (
        milestoneId: number,
        field: "checkpointType" | "salaryPaid",
        value: string
    ) => {
        setMilestones((prev) =>
            prev.map((m) =>
                m.id === milestoneId && m.status === "Draft" ? { ...m, [field]: value } : m
            )
        );
    };

    const handleUpdateTopicPassingScore = (
        milestoneId: number,
        topicId: number,
        value: number
    ) => {
        setMilestones((prev) =>
            prev.map((m) => {
                if (m.id !== milestoneId || m.status !== "Draft") return m;
                return {
                    ...m,
                    topics: (m.topics || []).map((t) =>
                        t.id === topicId ? { ...t, passingScore: value } : t
                    ),
                };
            })
        );
    };

    // 2.6: Save changes (persisted directly to H2 database)
    const handleSaveChanges = () => {
        if (!isGpaValid) {
            toast.error(
                `Tổng trọng số Topic Mark (${gpaForm.topicMark}%) + Discipline Point (${gpaForm.disciplinePoint}%) bắt buộc phải bằng 100%!`
            );
            return;
        }
        if (invalidPassingTopic) {
            toast.error(
                `Passing Score của chuyên đề "${invalidPassingTopic.topic}" (${invalidPassingTopic.passing}) phải nằm trong khoảng 0 đến ${invalidPassingTopic.max}!`
            );
            return;
        }

        const payload: ClassOperationData = {
            classId: classItem.id,
            operatingInfo: {
                actualStartDate: serverOpData?.operatingInfo?.actualStartDate || classItem.startDate || "",
                earlyGraduatedDate: serverOpData?.operatingInfo?.earlyGraduatedDate || classItem.endDate || "",
                actualEndDate,
                gpaCalculation: gpaForm,
                hasNoAllocationNeeds,
            },
            milestones,
            totalWeightedNumber,
        };

        saveOpMutation.mutate(payload, {
            onSuccess: () => {
                toast.success("Lưu thông tin vận hành, GPA và milestone vào H2 thành công!");
                addActivityMutation.mutate({
                    content: "has updated class operating info, GPA calculation and milestone configuration.",
                    type: "history",
                });
            },
            onError: (err: unknown) => {
                const msg =
                    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    "Không thể lưu thông tin vận hành vào cơ sở dữ liệu H2!";
                toast.error(msg);
            },
        });
    };

    const handleExportOperationReport = () => {
        const safeCode = (classItem.code || `CLASS_${classItem.id}`).replace(/[^a-zA-Z0-9_-]/g, "_");
        const wb = utils.book_new();

        // Sheet 1: Operating & GPA Info
        const opSheetRows: Array<Array<string | number>> = [
            ["Field", "Value", "Notes"],
            ["Class Code", classItem.code || `CLASS_${classItem.id}`, "H2 TrainingClass"],
            ["Class Name", classItem.name || "", ""],
            ["Site", classItem.site || "TP. Hồ Chí Minh", ""],
            ["Planned Size", classItem.plannedSize ?? 25, "Trainees"],
            ["Actual Start Date", formatDate(serverOpData?.operatingInfo?.actualStartDate || classItem.startDate || ""), ""],
            ["Early Graduated Date", formatDate(serverOpData?.operatingInfo?.earlyGraduatedDate || classItem.endDate || ""), ""],
            ["Actual End Date", actualEndDate ? formatDate(actualEndDate) : "Not set", ""],
            ["Has No Allocation Needs", hasNoAllocationNeeds ? "Yes" : "No", ""],
            ["Total Weighted Number", totalWeightedNumber, "Across all milestones"],
            ["Total Milestones", milestones.length, ""],
            ["Total Topics", totalMilestoneTopics, ""],
            ["", "", ""],
            ["GPA Calculation Component", "Weight (%)", "Rule / Validation"],
            ["Topic Mark", gpaForm.topicMark, "Topic Mark + Discipline Point must equal 100%"],
            ["Discipline Point", gpaForm.disciplinePoint, "Topic Mark + Discipline Point must equal 100%"],
            ["Base Total (Topic + Discipline)", gpaBaseTotal, isGpaValid ? "Valid (100%)" : "Invalid (!= 100%)"],
            ["Bonus Point", gpaForm.bonusPoint, "0 - 100%"],
            ["Penalty Point", gpaForm.penaltyPoint, "0 - 100%"],
        ];
        const ws1 = autoFitWorksheetColumns(utils.aoa_to_sheet(opSheetRows), {
            Field: 32,
            Value: 28,
            Notes: 42,
        });
        utils.book_append_sheet(wb, ws1, "Operating & GPA Info");

        // Sheet 2: Milestone Schedule
        const msHeaders = [
            "Milestone No.",
            "Milestone Name",
            "Status",
            "Checkpoint Type",
            "Salary Paid",
            "Milestone Start",
            "Milestone End",
            "Topic No.",
            "Topic",
            "Topic Start Date",
            "Topic End Date",
            "Max Score",
            "Passing Score",
            "Weighted Number",
        ];
        const msRows: Array<Array<string | number>> = [];
        milestones.forEach((m, mIdx) => {
            const mTopics = m.topics || [];
            if (mTopics.length === 0) {
                msRows.push([
                    mIdx + 1,
                    m.name,
                    m.status || "Baselined",
                    m.checkpointType || "STANDARD",
                    m.salaryPaid || "Yes",
                    formatDate(m.startDate),
                    formatDate(m.endDate),
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    0,
                ]);
                return;
            }
            mTopics.forEach((t, tIdx) => {
                msRows.push([
                    mIdx + 1,
                    m.name,
                    m.status || "Baselined",
                    m.checkpointType || "STANDARD",
                    m.salaryPaid || "Yes",
                    formatDate(m.startDate),
                    formatDate(m.endDate),
                    tIdx + 1,
                    t.topic,
                    formatDate(t.startDate || m.startDate),
                    formatDate(t.endDate || m.endDate),
                    t.maxScore ?? 10,
                    t.passingScore ?? 6,
                    t.weightedNumber,
                ]);
            });
        });
        const ws2 = autoFitWorksheetColumns(utils.aoa_to_sheet([msHeaders, ...msRows]), {
            "Milestone No.": 14,
            "Milestone Name": 16,
            Status: 12,
            "Checkpoint Type": 16,
            "Salary Paid": 12,
            "Milestone Start": 15,
            "Milestone End": 15,
            "Topic No.": 10,
            Topic: 44,
            "Topic Start Date": 16,
            "Topic End Date": 16,
            "Max Score": 11,
            "Passing Score": 14,
            "Weighted Number": 16,
        });
        utils.book_append_sheet(wb, ws2, "Milestone Schedule");

        // Sheet 3: Topic Assessments
        const taHeaders = [
            "Topic",
            "Assessment Name",
            "Weighted Number (%)",
            "Quantity",
            "Note",
            "Action",
            "Change Status",
            "Topic Total (%)",
        ];
        const taRows: Array<Array<string | number>> = [];
        (Array.isArray(serverTopics) ? serverTopics : []).forEach((topic) => {
            const topicTotal = calculateTopicTotal(topic);
            const items = topic.assessments || [];
            if (items.length === 0) {
                taRows.push([topic.title, "", 0, 0, "", "", "", topicTotal]);
                return;
            }
            items.forEach((a) => {
                taRows.push([
                    topic.title,
                    a.name,
                    Number(a.weightedNumber) || 0,
                    Number(a.quantity) || 1,
                    a.note || "",
                    a.action || "Keep",
                    a.changeStatus || "none",
                    topicTotal,
                ]);
            });
        });
        const ws3 = autoFitWorksheetColumns(utils.aoa_to_sheet([taHeaders, ...taRows]), {
            Topic: 44,
            "Assessment Name": 30,
            "Weighted Number (%)": 20,
            Quantity: 10,
            Note: 28,
            Action: 10,
            "Change Status": 15,
            "Topic Total (%)": 15,
        });
        utils.book_append_sheet(wb, ws3, "Topic Assessments");

        // Sheet 4: Activities & Audit Log
        const actHeaders = ["No.", "Type", "Author", "Initials", "Timestamp", "Content"];
        const actRows: Array<Array<string | number>> = (Array.isArray(serverActivities) ? serverActivities : []).map(
            (act, idx) => [
                idx + 1,
                (act.type || "history").toUpperCase(),
                act.author || "",
                act.initials || "",
                act.timestamp || "",
                act.content || "",
            ]
        );
        const ws4 = autoFitWorksheetColumns(utils.aoa_to_sheet([actHeaders, ...actRows]), {
            "No.": 6,
            Type: 12,
            Author: 24,
            Initials: 10,
            Timestamp: 22,
            Content: 60,
        });
        utils.book_append_sheet(wb, ws4, "Activities & Audit Log");

        const fileName = `${safeCode}_Budget_Operation_Report.xlsx`;
        writeFile(wb, fileName);
        toast.success(`Đã xuất báo cáo 4 sheet: ${fileName}`);
    };

    const handleLogActivity = (content: string) => {
        addActivityMutation.mutate({
            content,
            type: "history",
        });
    };

    if (isLoading) {
        return (
            <div className="space-y-4 p-2">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="space-y-6 pb-8">
                {/* Top Action Bar: Export Multi-Sheet Excel Report */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                        Quản lý thông tin vận hành, công thức GPA, cấu hình đánh giá chuyên đề &amp; các mốc đào tạo (H2 Database).
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportOperationReport}
                        className="text-xs font-semibold gap-1.5 border-[#5944d3]/40 text-[#5944d3] hover:bg-[#5944d3]/10 dark:text-purple-300"
                    >
                        <Download className="size-3.5" />
                        Export Budget &amp; Operation Report
                    </Button>
                </div>

                {/* 2.1: Operating Info Section */}
                <Collapsible
                    open={openOperating}
                    onOpenChange={setOpenOperating}
                    className="rounded-xl border bg-card shadow-xs overflow-hidden"
                >
                    <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-3.5 text-left font-semibold text-sm bg-muted/20 hover:bg-muted/40 transition-colors">
                        <span>Operating Info</span>
                        <ChevronDown className={cn("size-4 transition-transform text-muted-foreground", openOperating && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="border-t p-5 space-y-6 bg-white dark:bg-card">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Actual Start Date */}
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground font-medium">Actual Start Date</p>
                                    <p className="text-sm font-semibold text-foreground">
                                        {formatDate(serverOpData?.operatingInfo?.actualStartDate || classItem.startDate || "2026-01-23")}
                                    </p>
                                </div>

                                {/* Early Graduated Date */}
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground font-medium">Early Graduated Date</p>
                                    <p className="text-sm font-semibold text-foreground">
                                        {formatDate(serverOpData?.operatingInfo?.earlyGraduatedDate || "2026-07-22")}
                                    </p>
                                </div>

                                {/* Actual End Date (Input) */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="actual-end-date" className="text-xs text-muted-foreground font-medium">
                                        Actual End Date
                                    </Label>
                                    <div className="relative max-w-xs">
                                        <Input
                                            id="actual-end-date"
                                            type="date"
                                            value={actualEndDate}
                                            onChange={(e) => setActualEndDate(e.target.value)}
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Editable GPA Calculation Block */}
                            <div className="rounded-lg border bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        <span>GPA Calculation</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button type="button" className="text-blue-600 hover:text-blue-800 focus:outline-none">
                                                    <Info className="size-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent className="text-xs max-w-xs p-2">
                                                Công thức tính GPA toàn khóa: Topic Mark (%) + Discipline Point (%) bắt buộc phải bằng 100%.
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[11px] font-bold px-2.5 py-0.5",
                                                isGpaValid
                                                    ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/60 dark:text-green-300"
                                                    : "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300"
                                            )}
                                        >
                                            Topic + Discipline: {gpaBaseTotal}/100%
                                        </Badge>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setGpaForm(DEFAULT_GPA_CALCULATION)}
                                            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                                            title="Khôi phục mặc định 70 / 30 / 10 / 20"
                                        >
                                            <RotateCcw className="size-3" />
                                            Mặc định (70/30)
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                    <div className="space-y-1">
                                        <Label htmlFor="gpa-topic-mark" className="text-[11px] text-muted-foreground">
                                            Topic Mark (%)
                                        </Label>
                                        <Input
                                            id="gpa-topic-mark"
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={gpaForm.topicMark}
                                            onChange={(e) =>
                                                setGpaForm((prev) => ({
                                                    ...prev,
                                                    topicMark: Math.max(0, Number(e.target.value) || 0),
                                                }))
                                            }
                                            className={cn(
                                                "h-8 text-xs font-semibold bg-white dark:bg-card",
                                                gpaBaseTotal !== 100 && "border-red-400 text-red-600"
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="gpa-discipline-point" className="text-[11px] text-muted-foreground">
                                            Discipline Point (%)
                                        </Label>
                                        <Input
                                            id="gpa-discipline-point"
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={gpaForm.disciplinePoint}
                                            onChange={(e) =>
                                                setGpaForm((prev) => ({
                                                    ...prev,
                                                    disciplinePoint: Math.max(0, Number(e.target.value) || 0),
                                                }))
                                            }
                                            className={cn(
                                                "h-8 text-xs font-semibold bg-white dark:bg-card",
                                                gpaBaseTotal !== 100 && "border-red-400 text-red-600"
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="gpa-bonus-point" className="text-[11px] text-muted-foreground">
                                            Bonus Point (%)
                                        </Label>
                                        <Input
                                            id="gpa-bonus-point"
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={gpaForm.bonusPoint}
                                            onChange={(e) =>
                                                setGpaForm((prev) => ({
                                                    ...prev,
                                                    bonusPoint: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                                }))
                                            }
                                            className="h-8 text-xs font-semibold bg-white dark:bg-card"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="gpa-penalty-point" className="text-[11px] text-muted-foreground">
                                            Penalty Point (%)
                                        </Label>
                                        <Input
                                            id="gpa-penalty-point"
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={gpaForm.penaltyPoint}
                                            onChange={(e) =>
                                                setGpaForm((prev) => ({
                                                    ...prev,
                                                    penaltyPoint: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                                }))
                                            }
                                            className="h-8 text-xs font-semibold bg-white dark:bg-card"
                                        />
                                    </div>
                                </div>

                                {!isGpaValid && (
                                    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                                        <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                                        <span>
                                            Tổng <strong>Topic Mark ({gpaForm.topicMark}%) + Discipline Point ({gpaForm.disciplinePoint}%)</strong> hiện là{" "}
                                            <strong>{gpaBaseTotal}%</strong>. Bắt buộc phải bằng <strong>100%</strong> mới được phép lưu!
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Actions & Switch: 2.2 & 2.3 */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setConfigModalOpen(true)}
                                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg px-4 h-9 shadow-xs"
                                >
                                    Config Topic Assessment
                                </Button>

                                <div className="flex items-center gap-3">
                                    <Label htmlFor="no-allocation" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                        Has no allocation needs
                                    </Label>
                                    <Switch
                                        id="no-allocation"
                                        checked={hasNoAllocationNeeds}
                                        onCheckedChange={setHasNoAllocationNeeds}
                                    />
                                </div>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                {/* 2.5: Milestone Configuration Section */}
                <Collapsible
                    open={openMilestones}
                    onOpenChange={setOpenMilestones}
                    className="rounded-xl border bg-card shadow-xs overflow-hidden"
                >
                    <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-3.5 text-left font-semibold text-sm bg-muted/20 hover:bg-muted/40 transition-colors">
                        <span>Milestone Configuration</span>
                        <ChevronDown className={cn("size-4 transition-transform text-muted-foreground", openMilestones && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="border-t p-5 space-y-4 bg-white dark:bg-card">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Total Weighted Number: <span className="text-blue-700 dark:text-blue-400 font-mono text-sm">{totalWeightedNumber}</span>
                                </p>
                                <span className="text-xs text-muted-foreground">
                                    {milestones.length} Milestones
                                    {milestones.length > 0 && ` (${milestones[0].name} đến ${milestones[milestones.length - 1].name})`}
                                    {" • "}
                                    {totalMilestoneTopics} Chuyên đề
                                </span>
                            </div>

                            {/* Milestones and Sub-topics Table: Scrollable container with fixed header */}
                            <div className="rounded-lg border overflow-x-auto">
                                <Table className="text-xs relative">
                                    <TableHeader className="bg-[#eef8fb] dark:bg-slate-900 border-b">
                                        <TableRow>
                                            <TableHead className="w-12 font-bold text-slate-700 dark:text-slate-300">No.</TableHead>
                                            <TableHead className="min-w-[260px] font-bold text-slate-700 dark:text-slate-300">Milestone Name</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Checkpoint Type</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Salary Paid</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Start Date</TableHead>
                                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">End Date</TableHead>
                                            <TableHead className="text-right pr-6 font-bold text-slate-700 dark:text-slate-300">Weighted Number</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {milestones.map((m, mIdx) => {
                                            const milestoneWeight = (m.topics || []).reduce(
                                                (sum, t) => sum + (Number(t.weightedNumber) || 0),
                                                0
                                            );
                                            const isDraft = m.status === "Draft";
                                            return (
                                            <Fragment key={`milestone-block-${m.id}`}>
                                                {/* Parent Milestone Row */}
                                                <TableRow className="bg-slate-50/80 dark:bg-slate-900/60 font-semibold border-t">
                                                    <TableCell className="font-bold">{mIdx + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-800 dark:text-slate-100">{m.name}</span>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleToggleMilestoneStatus(m.id)}
                                                                        className={cn(
                                                                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer",
                                                                            isDraft
                                                                                ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                                                                                : "bg-[#c8f7d4] text-green-800 border-green-300 hover:bg-green-200 dark:bg-green-950/60 dark:text-green-300"
                                                                        )}
                                                                    >
                                                                        {isDraft ? (
                                                                            <Unlock className="size-2.5" />
                                                                        ) : (
                                                                            <Lock className="size-2.5" />
                                                                        )}
                                                                        {m.status || "Baselined"}
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="text-xs p-2">
                                                                    {isDraft
                                                                        ? "Đang ở chế độ Draft (cho phép sửa). Bấm để chốt Baselined."
                                                                        : "Đã khóa Baselined. Bấm để chuyển sang Draft và chỉnh sửa."}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {isDraft ? (
                                                            <select
                                                                aria-label={`Checkpoint Type ${m.name}`}
                                                                value={m.checkpointType || "STANDARD"}
                                                                onChange={(e) =>
                                                                    handleUpdateMilestoneField(m.id, "checkpointType", e.target.value)
                                                                }
                                                                className="h-7 px-2 text-xs rounded border border-amber-300 bg-white dark:bg-card text-foreground font-medium"
                                                            >
                                                                <option value="STANDARD">STANDARD</option>
                                                                <option value="SPECIAL">SPECIAL</option>
                                                            </select>
                                                        ) : (
                                                            m.checkpointType || "STANDARD"
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isDraft ? (
                                                            <select
                                                                aria-label={`Salary Paid ${m.name}`}
                                                                value={m.salaryPaid || "Yes"}
                                                                onChange={(e) =>
                                                                    handleUpdateMilestoneField(m.id, "salaryPaid", e.target.value)
                                                                }
                                                                className="h-7 px-2 text-xs rounded border border-amber-300 bg-white dark:bg-card text-foreground font-medium"
                                                            >
                                                                <option value="Yes">Yes</option>
                                                                <option value="No">No</option>
                                                            </select>
                                                        ) : (
                                                            m.salaryPaid || "Yes"
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{formatDate(m.startDate)}</TableCell>
                                                    <TableCell>{formatDate(m.endDate)}</TableCell>
                                                    <TableCell className="text-right pr-6 font-mono font-bold text-blue-700 dark:text-blue-400">
                                                        {milestoneWeight}
                                                    </TableCell>
                                                </TableRow>

                                                {/* Subtopics Header */}
                                                <TableRow className="bg-slate-100/50 dark:bg-slate-950/40 text-[11px] text-muted-foreground border-b">
                                                    <TableCell className="pl-6 font-semibold">No.</TableCell>
                                                    <TableCell className="font-semibold">Topic</TableCell>
                                                    <TableCell className="font-semibold">Max Score</TableCell>
                                                    <TableCell className="font-semibold">Passing Score</TableCell>
                                                    <TableCell className="font-semibold">Start Date</TableCell>
                                                    <TableCell className="font-semibold">End Date</TableCell>
                                                    <TableCell className="font-semibold text-right pr-6">Weighted Number</TableCell>
                                                </TableRow>

                                                {/* Subtopics List */}
                                                {m.topics.map((t, tIdx) => {
                                                    const maxScore = t.maxScore ?? 10;
                                                    const passingScore = t.passingScore ?? 6;
                                                    const isPassingInvalid = passingScore < 0 || passingScore > maxScore;
                                                    return (
                                                    <TableRow key={`topic-${t.id}`} className="hover:bg-muted/30 text-xs">
                                                        <TableCell className="pl-6 text-muted-foreground">{tIdx + 1}</TableCell>
                                                        <TableCell className="font-medium text-slate-700 dark:text-slate-200">
                                                            {t.topic}
                                                        </TableCell>
                                                        <TableCell>{maxScore}</TableCell>
                                                        <TableCell>
                                                            {isDraft ? (
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={maxScore}
                                                                    step={0.5}
                                                                    value={passingScore}
                                                                    onChange={(e) =>
                                                                        handleUpdateTopicPassingScore(
                                                                            m.id,
                                                                            t.id,
                                                                            Number(e.target.value)
                                                                        )
                                                                    }
                                                                    className={cn(
                                                                        "h-7 w-20 text-xs bg-white dark:bg-card",
                                                                        isPassingInvalid
                                                                            ? "border-red-400 text-red-600 font-bold"
                                                                            : "border-amber-300"
                                                                    )}
                                                                />
                                                            ) : (
                                                                passingScore
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-slate-600 dark:text-slate-300">
                                                            {formatDate(t.startDate || m.startDate)}
                                                        </TableCell>
                                                        <TableCell className="text-slate-600 dark:text-slate-300">
                                                            {formatDate(t.endDate || m.endDate)}
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6 font-mono font-medium text-slate-900 dark:text-slate-100">
                                                            {t.weightedNumber}
                                                        </TableCell>
                                                    </TableRow>
                                                    );
                                                })}
                                            </Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                {/* Bottom Actions: 2.6 Back to Class List & Save changes */}
                <div className="sticky bottom-0 z-20 flex items-center justify-between pt-4 pb-2 bg-card/95 backdrop-blur-xs border-t mt-4">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        asChild
                        className="text-xs"
                    >
                        <Link to="/classes">Back to Class List</Link>
                    </Button>

                    <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveChanges}
                        disabled={!isGpaValid || Boolean(invalidPassingTopic) || saveOpMutation.isPending}
                        className="bg-[#5944d3] hover:bg-[#4b39b5] text-white text-xs px-5 shadow-sm gap-1.5"
                    >
                        <Save className="size-3.5" />
                        {saveOpMutation.isPending ? "Đang lưu..." : "Save changes"}
                    </Button>
                </div>

                {/* Config Topic Assessment Modal */}
                <TopicAssessmentModal
                    open={configModalOpen}
                    onClose={() => setConfigModalOpen(false)}
                    classId={classId}
                    onActivityLog={handleLogActivity}
                />
            </div>
        </TooltipProvider>
    );
}
