import { invitationApi } from "@/api";
import type {
    AnonymousInvitationRequest,
    InvitationCreateRequest,
    InvitationDTO,
    ReminderRequest,
    ReminderType,
} from "@/types";
import { BulkInviteByClassTab } from "@/components/features/invitation/BulkInviteByClassTab";
import {
    ExamScheduleSelector,
    type ScheduleMode,
} from "@/components/features/invitation/ExamScheduleSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, GraduationCap, Link2, Mail, QrCode, RefreshCw, Share2, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CreateInvitationModalProps {
    examId: number;
    examTitle: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

interface AuthForm {
    userId: string;
    note: string;
    availableFrom: string;
    expiresAt: string;
}

interface AnonForm {
    maxAccessAttempts: string;
    availableFrom: string;
    maxAccessTime: string;
}

const DEFAULT_AUTH: AuthForm = { userId: "", note: "", availableFrom: "", expiresAt: "" };
const DEFAULT_ANON: AnonForm = { maxAccessAttempts: "1", availableFrom: "", maxAccessTime: "" };

const REMINDER_OPTIONS: { value: ReminderType; label: string }[] = [
    { value: "ONE_HOUR", label: "Trước 1 giờ" },
    { value: "ONE_DAY", label: "Trước 1 ngày" },
    { value: "CUSTOM", label: "Tùy chỉnh" },
];

const getErrorMessage = (error: unknown, fallback: string): string => {
    const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
    const data = err?.response?.data;
    const fieldError = data?.errors ? Object.values(data.errors).flat()[0] : undefined;
    return fieldError || data?.message || fallback;
};

function toIso(value: string) {
    return value ? new Date(value).toISOString() : undefined;
}

function UserPicker({
    value,
    onChange,
}: {
    value: string;
    onChange: (id: string) => void;
}) {
    const [search, setSearch] = useState("");

    const { data: users, isLoading } = useQuery({
        queryKey: ["user-picker", search],
        queryFn: async () => {
            const { userApi } = await import("@/api");
            return userApi.getPage({ page: 0, size: 20, sort: "firstName,asc" }, search);
        },
        enabled: search.length >= 2,
    });

    return (
        <div className="space-y-2">
            <Label>Học viên (Student)</Label>

            <Input
                placeholder="Nhập tên hoặc email học viên để tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            {isLoading && <p className="text-sm text-muted-foreground">Đang tìm kiếm...</p>}
            {users?.content && users.content.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                    {users.content.map((u) => (
                        <button
                            key={u.id}
                            type="button"
                            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                                value === String(u.id) ? "bg-muted font-medium" : ""
                            }`}
                            onClick={() => {
                                onChange(String(u.id));
                                setSearch("");
                            }}
                        >
                            <span>
                                {u.firstName} {u.lastName ?? ""}
                            </span>
                            <span className="text-muted-foreground">({u.email})</span>
                        </button>
                    ))}
                </div>
            )}
            {value && (
                <p className="text-xs text-muted-foreground">
                    Đã chọn ID: <span className="font-medium text-foreground">{value}</span>
                </p>
            )}
        </div>
    );
}

export function CreateInvitationModal({
    examId,
    examTitle,
    open,
    onOpenChange,
    onSuccess,
}: CreateInvitationModalProps) {
    const queryClient = useQueryClient();
    const [reminderType, setReminderType] = useState<ReminderType | "NONE">("NONE");
    const [customReminder, setCustomReminder] = useState("");

    // Chế độ lịch cho tab Tài khoản và tab Link chia sẻ
    const [authScheduleMode, setAuthScheduleMode] = useState<ScheduleMode>("FLEXIBLE");
    const [anonScheduleMode, setAnonScheduleMode] = useState<ScheduleMode>("FLEXIBLE");

    const [auth, setAuth] = useState<AuthForm>(DEFAULT_AUTH);
    const [anon, setAnon] = useState<AnonForm>(DEFAULT_ANON);

    const [authInvitations, setAuthInvitations] = useState<InvitationDTO[]>([]);
    const [anonInvitations, setAnonInvitations] = useState<
        Map<number, { inv: InvitationDTO; qr: string | null }>
    >(new Map());

    // Lấy thông tin thời lượng bài thi
    const examDetailQuery = useQuery({
        queryKey: ["exam-detail-for-invitation", examId],
        queryFn: async () => {
            const { examApi } = await import("@/api");
            return examApi.getById(String(examId));
        },
        enabled: examId > 0 && open,
        staleTime: 5 * 60 * 1000,
    });
    const durationMinutes = examDetailQuery.data?.durationMinutes || 60;

    const resetForm = () => {
        setAuth(DEFAULT_AUTH);
        setAnon(DEFAULT_ANON);
        setReminderType("NONE");
        setCustomReminder("");
        setAuthInvitations([]);
        setAnonInvitations(new Map());
    };

    const createAuthMutation = useMutation({
        mutationFn: async () => {
            const request: InvitationCreateRequest = {
                userId: Number(auth.userId),
                note: auth.note || undefined,
                availableFrom: toIso(auth.availableFrom) || undefined,
                expiresAt: toIso(auth.expiresAt) || undefined,
            };
            return invitationApi.create(examId, request);
        },
        onSuccess: async (inv) => {
            setAuthInvitations((prev) => [...prev, inv]);
            toast.success("Đã tạo lời mời thành công.");

            if (reminderType !== "NONE") {
                const req: ReminderRequest = {
                    reminderType: reminderType as ReminderType,
                    scheduledAt: reminderType === "CUSTOM" ? toIso(customReminder) : undefined,
                    invitationId: inv.id,
                };
                try {
                    await invitationApi.scheduleReminder(examId, req);
                    toast.success("Đã lên lịch nhắc nhở qua email.");
                } catch (error) {
                    toast.error(
                        getErrorMessage(error, "Không thể lên lịch gửi email nhắc nhở."),
                    );
                }
            }

            setAuth(DEFAULT_AUTH);
            onSuccess?.();
            void queryClient.invalidateQueries({ queryKey: ["exam-invitations", examId] });
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Không thể tạo lời mời."));
        },
    });

    const createAnonMutation = useMutation({
        mutationFn: async () => {
            const request: AnonymousInvitationRequest = {
                maxAccessAttempts: Number(anon.maxAccessAttempts) || 1,
                availableFrom: toIso(anon.availableFrom) || undefined,
                maxAccessTime: toIso(anon.maxAccessTime) || undefined,
                expiresAt: toIso(anon.maxAccessTime) || undefined,
            };
            return invitationApi.createAnonymous(examId, request);
        },
        onSuccess: async (inv) => {
            let qr: string | null = null;
            if (inv.id) {
                try {
                    qr = await invitationApi.getQrDataUrl(inv.id);
                } catch (error) {
                    toast.error(getErrorMessage(error, "Không thể tạo mã QR."));
                }
            }
            setAnonInvitations((prev) => new Map(prev).set(inv.id!, { inv, qr }));
            toast.success("Đã tạo link chia sẻ thành công!");

            setAnon(DEFAULT_ANON);
            onSuccess?.();
            void queryClient.invalidateQueries({ queryKey: ["exam-invitations", examId] });
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Không thể tạo link chia sẻ."));
        },
    });

    const canSubmitAuth = Boolean(auth.userId);

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Tạo Lời Mời Dự Thi (Exam Invitations)</DialogTitle>
                    <DialogDescription className="flex items-center gap-2">
                        <span>{examTitle}</span>
                        <Badge variant="outline" className="text-xs">
                            ⏱ {durationMinutes} phút
                        </Badge>
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="account" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="account" className="gap-2">
                            <Users className="size-4" />
                            Tài khoản cá nhân
                        </TabsTrigger>
                        <TabsTrigger value="class" className="gap-2">
                            <GraduationCap className="size-4" />
                            Theo lớp học (By Class)
                        </TabsTrigger>
                        <TabsTrigger value="share" className="gap-2">
                            <Share2 className="size-4" />
                            Link chia sẻ tự do
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="class">
                        <BulkInviteByClassTab
                            key={open ? "open" : "closed"}
                            examId={examId}
                            onSuccess={onSuccess}
                        />
                    </TabsContent>

                    <TabsContent value="account" className="space-y-4 pt-4">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                createAuthMutation.mutate();
                            }}
                            className="space-y-4"
                        >
                            <UserPicker
                                value={auth.userId}
                                onChange={(id) => setAuth((f) => ({ ...f, userId: id }))}
                            />

                            <div className="space-y-2">
                                <Label>Ghi chú lời mời (Note - tùy chọn)</Label>
                                <Input
                                    placeholder="ví dụ: Ca thi sáng, Kiểm tra tiến độ đợt 1..."
                                    value={auth.note}
                                    onChange={(e) =>
                                        setAuth((f) => ({ ...f, note: e.target.value }))
                                    }
                                />
                            </div>

                            {/* Bộ chọn 2 chế độ: Tự do có hạn chót HOẶC Ca thi cố định */}
                            <ExamScheduleSelector
                                durationMinutes={durationMinutes}
                                scheduleMode={authScheduleMode}
                                onScheduleModeChange={setAuthScheduleMode}
                                availableFrom={auth.availableFrom}
                                onAvailableFromChange={(val) =>
                                    setAuth((f) => ({ ...f, availableFrom: val }))
                                }
                                expiresAt={auth.expiresAt}
                                onExpiresAtChange={(val) =>
                                    setAuth((f) => ({ ...f, expiresAt: val }))
                                }
                            />

                            <div className="space-y-3 border-t pt-4">
                                <Label>Nhắc nhở qua Email (Email Reminder)</Label>
                                <RadioGroup
                                    value={reminderType}
                                    onValueChange={(v) =>
                                        setReminderType(v as typeof reminderType)
                                    }
                                    className="flex flex-wrap gap-3"
                                >
                                    <Label className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-muted/50">
                                        <RadioGroupItem value="NONE" />
                                        Không nhắc
                                    </Label>
                                    {REMINDER_OPTIONS.map((opt) => (
                                        <Label
                                            key={opt.value}
                                            className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-muted/50"
                                        >
                                            <RadioGroupItem value={opt.value} />
                                            {opt.label}
                                        </Label>
                                    ))}
                                </RadioGroup>
                                {reminderType === "CUSTOM" && (
                                    <Input
                                        type="datetime-local"
                                        value={customReminder}
                                        onChange={(e) => setCustomReminder(e.target.value)}
                                        className="max-w-xs"
                                    />
                                )}
                            </div>

                            <DialogFooter>
                                <Button
                                    type="submit"
                                    disabled={!canSubmitAuth || createAuthMutation.isPending}
                                >
                                    {createAuthMutation.isPending ? (
                                        <>
                                            <RefreshCw className="size-4 animate-spin" />
                                            Đang tạo...
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="size-4" />
                                            Tạo & Gửi lời mời
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>

                        {authInvitations.length > 0 && (
                            <div className="border-t pt-4 mt-4">
                                <h4 className="font-medium mb-3">Lời mời vừa tạo</h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {authInvitations.map((inv) => (
                                        <div
                                            key={inv.id}
                                            className="flex items-center justify-between rounded-md border bg-green-50 px-3 py-2 text-sm"
                                        >
                                            <span className="text-green-800">
                                                ✓ {inv.userFullName ?? inv.userEmail}
                                            </span>
                                            <Badge variant="secondary">{inv.status}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="share" className="space-y-4 pt-4">
                        <div className="rounded-md border-2 border-dashed border-primary/30 bg-primary/5 p-4">
                            <div className="flex items-start gap-3">
                                <Share2 className="size-5 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium">Tạo Link Dự Thi Tự Do (Shareable Link)</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Tạo đường link công khai để chia sẻ cho thí sinh — không bắt buộc đăng nhập tài khoản trước. Thí sinh tự nhập họ tên và email khi mở link để làm bài.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                createAnonMutation.mutate();
                            }}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Số lượt làm bài tối đa (Max Attempts)</Label>
                                    <span className="text-xs text-muted-foreground">Tối đa 100 lượt</span>
                                </div>
                                <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={anon.maxAccessAttempts}
                                    onChange={(e) =>
                                        setAnon((f) => ({
                                            ...f,
                                            maxAccessAttempts: e.target.value,
                                        }))
                                    }
                                />
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <span className="text-[11px] text-muted-foreground">Gợi ý nhanh:</span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-[11px]"
                                        onClick={() => setAnon((f) => ({ ...f, maxAccessAttempts: "1" }))}
                                    >
                                        1 lượt (Đơn lẻ)
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-[11px]"
                                        onClick={() => setAnon((f) => ({ ...f, maxAccessAttempts: "30" }))}
                                    >
                                        30 lượt (Lớp nhỏ)
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-[11px]"
                                        onClick={() => setAnon((f) => ({ ...f, maxAccessAttempts: "50" }))}
                                    >
                                        50 lượt (Lớp lớn)
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-[11px]"
                                        onClick={() => setAnon((f) => ({ ...f, maxAccessAttempts: "100" }))}
                                    >
                                        100 lượt
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    💡 Nếu chia sẻ link vào nhóm lớp cho nhiều người làm, hãy đặt số lượt tương ứng với sĩ số học viên.
                                </p>
                            </div>

                            {/* Cấu hình lịch cho Shareable Link */}
                            <ExamScheduleSelector
                                durationMinutes={durationMinutes}
                                scheduleMode={anonScheduleMode}
                                onScheduleModeChange={setAnonScheduleMode}
                                availableFrom={anon.availableFrom}
                                onAvailableFromChange={(val) =>
                                    setAnon((f) => ({ ...f, availableFrom: val }))
                                }
                                expiresAt={anon.maxAccessTime}
                                onExpiresAtChange={(val) =>
                                    setAnon((f) => ({ ...f, maxAccessTime: val }))
                                }
                            />

                            <DialogFooter>
                                <Button
                                    type="submit"
                                    disabled={createAnonMutation.isPending}
                                >
                                    {createAnonMutation.isPending ? (
                                        <>
                                            <RefreshCw className="size-4 animate-spin" />
                                            Đang tạo link...
                                        </>
                                    ) : (
                                        <>
                                            <Link2 className="size-4" />
                                            Tạo Link Chia Sẻ
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>

                        {anonInvitations.size > 0 && (
                            <div className="border-t pt-4 mt-4">
                                <h4 className="font-medium mb-3">Link chia sẻ đã tạo</h4>
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {Array.from(anonInvitations.entries()).map(
                                        ([id, { inv, qr }]) => (
                                            <ShareLinkCard
                                                key={id}
                                                invitation={inv}
                                                qrDataUrl={qr}
                                            />
                                        ),
                                    )}
                                </div>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        <X className="size-4" />
                        Đóng
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface ShareLinkCardProps {
    invitation: InvitationDTO;
    qrDataUrl: string | null;
}

function ShareLinkCard({ invitation, qrDataUrl }: ShareLinkCardProps) {
    const FRONTEND_BASE = import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173";
    const shareableUrl = invitation.accessCode
        ? `${FRONTEND_BASE}/anonymous-exam?code=${invitation.accessCode}`
        : null;

    const copyCode = () => {
        if (invitation.accessCode) {
            void navigator.clipboard.writeText(invitation.accessCode);
            toast.success("Đã sao chép mã truy cập!");
        }
    };

    const copyLink = () => {
        if (shareableUrl) {
            void navigator.clipboard.writeText(shareableUrl);
            toast.success("Đã sao chép link dự thi!");
        }
    };

    return (
        <div className="rounded-md border p-3 space-y-3">
            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Mã truy cập (Access Code)</p>
                <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border bg-muted/50 px-4 py-2 font-mono text-lg font-bold tracking-widest text-center">
                        {invitation.accessCode}
                    </div>
                    <Button variant="outline" size="icon" onClick={copyCode}>
                        <Copy className="size-4" />
                    </Button>
                </div>
            </div>

            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Link dự thi (Shareable Link)</p>
                <div className="flex items-center gap-2">
                    <div className="flex-1 overflow-hidden text-ellipsis rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
                        {shareableUrl}
                    </div>
                    <Button variant="outline" size="icon" onClick={copyLink}>
                        <Copy className="size-4" />
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">
                    Số lượt tối đa: {invitation.maxAccessAttempts ?? 1}
                </span>
                {qrDataUrl && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            const a = document.createElement("a");
                            a.href = qrDataUrl;
                            a.download = `qr-${invitation.accessCode}.png`;
                            a.click();
                        }}
                    >
                        <QrCode className="size-4" />
                        Tải mã QR
                    </Button>
                )}
            </div>
        </div>
    );
}
