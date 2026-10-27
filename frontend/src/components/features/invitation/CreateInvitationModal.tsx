import { invitationApi } from "@/api";
import type {
    AnonymousInvitationRequest,
    BatchInvitationRequest,
    InvitationCreateRequest,
    InvitationDTO,
    ReminderRequest,
    ReminderType,
} from "@/types";
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
import { Copy, Link2, Mail, QrCode, RefreshCw, Share2, Users, X } from "lucide-react";
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
    expiresAt: string;
}

interface SelectedStudent {
    id: string;
    email: string;
    fullName: string;
}

interface AnonForm {
    maxAccessAttempts: string;
}

const DEFAULT_AUTH: AuthForm = { userId: "", note: "", expiresAt: "" };
const DEFAULT_ANON: AnonForm = { maxAccessAttempts: "1" };

const REMINDER_OPTIONS: { value: ReminderType; label: string }[] = [
    { value: "ONE_HOUR", label: "1 hour before" },
    { value: "ONE_DAY", label: "1 day before" },
    { value: "CUSTOM", label: "Custom" },
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
                        selected,
                        onChange,
                        onSelectionChange,
                    }: {
    value: string;
    selected: SelectedStudent[];
    onChange: (id: string) => void;
    onSelectionChange: (students: SelectedStudent[]) => void;
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

    const { data: students, isLoading: isLoadingStudents } = useQuery({
        queryKey: ["student-list"],
        queryFn: async () => {
            const { userApi } = await import("@/api");
            return userApi.getStudents();
        },
    });

    const selectedIds = new Set(selected.map((s) => s.id));

    const toggleStudent = (student: SelectedStudent) => {
        if (selectedIds.has(student.id)) {
            onSelectionChange(selected.filter((s) => s.id !== student.id));
        } else {
            onSelectionChange([...selected, student]);
        }
    };

    const selectAllStudents = () => {
        if (!students) return;
        onSelectionChange(
            students.map((s) => ({ id: String(s.id), email: s.email, fullName: s.fullName })),
        );
    };

    const clearSelection = () => onSelectionChange([]);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label>Student</Label>
                {students && students.length > 0 && (
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={selectAllStudents}>
                            Select all ({students.length})
                        </Button>
                        {selected.length > 0 && (
                            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                                Clear
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {selected.length > 0 && (
                <div className="rounded-md border border-green-200 bg-green-50 p-2">
                    <p className="mb-1 text-xs font-medium text-green-800">
                        Selected {selected.length} student(s)
                    </p>
                    <div className="max-h-24 space-y-0.5 overflow-y-auto">
                        {selected.map((s) => (
                            <div key={s.id} className="flex items-center justify-between text-xs text-green-800">
                                <span className="truncate">
                                    {s.fullName} <span className="text-green-700">({s.email})</span>
                                </span>
                                <button
                                    type="button"
                                    className="ml-2 text-green-700 hover:text-red-600"
                                    onClick={() => toggleStudent({ id: s.id, email: s.email, fullName: s.fullName })}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isLoadingStudents && <p className="text-sm text-muted-foreground">Loading students...</p>}

            {students && students.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                    {students.map((s) => {
                        const id = String(s.id);
                        const isSelected = selectedIds.has(id);
                        return (
                            <button
                                key={s.id}
                                type="button"
                                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                                    isSelected ? "bg-muted font-medium" : ""
                                }`}
                                onClick={() =>
                                    toggleStudent({ id, email: s.email, fullName: s.fullName })
                                }
                            >
                                <span className="w-4 shrink-0">{isSelected ? "✓" : ""}</span>
                                <span>{s.fullName}</span>
                                <span className="text-muted-foreground">({s.email})</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <Input
                placeholder="Type name or email to search (other users)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            {isLoading && <p className="text-sm text-muted-foreground">Searching...</p>}
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
                            <span>{u.firstName} {u.lastName ?? ""}</span>
                            <span className="text-muted-foreground">({u.email})</span>
                        </button>
                    ))}
                </div>
            )}
            {value && (
                <p className="text-xs text-muted-foreground">
                    Selected ID: <span className="font-medium text-foreground">{value}</span>
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

    const [auth, setAuth] = useState<AuthForm>(DEFAULT_AUTH);

    const [selectedStudents, setSelectedStudents] = useState<SelectedStudent[]>([]);

    const [anon, setAnon] = useState<AnonForm>(DEFAULT_ANON);

    const [authInvitations, setAuthInvitations] = useState<InvitationDTO[]>([]);
    const [anonInvitations, setAnonInvitations] = useState<Map<number, { inv: InvitationDTO; qr: string | null }>>(new Map());

    const resetForm = () => {
        setAuth(DEFAULT_AUTH);
        setAnon(DEFAULT_ANON);
        setReminderType("NONE");
        setCustomReminder("");
        setAuthInvitations([]);
        setAnonInvitations(new Map());
        setSelectedStudents([]);
    };

    const createAuthMutation = useMutation({
        mutationFn: async () => {
            const request: InvitationCreateRequest = {
                userId: Number(auth.userId),
                note: auth.note || undefined,
                expiresAt: toIso(auth.expiresAt) || undefined,
            };
            return invitationApi.create(examId, request);
        },
        onSuccess: async (inv) => {
            setAuthInvitations((prev) => [...prev, inv]);
            toast.success("Invitation created.");

            if (reminderType !== "NONE") {
                const req: ReminderRequest = {
                    reminderType: reminderType as ReminderType,
                    scheduledAt: reminderType === "CUSTOM" ? toIso(customReminder) : undefined,
                };
                try {
                    await invitationApi.scheduleReminder(examId, req);
                    toast.success("Email reminder scheduled.");
                } catch {
                }
            }

            setAuth(DEFAULT_AUTH);
            onSuccess?.();
            void queryClient.invalidateQueries({ queryKey: ["exam-invitations", examId] });
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Failed to create invitation."));
        },
    });

    const createBatchMutation = useMutation({
        mutationFn: async () => {
            const request: BatchInvitationRequest = {
                invitations: selectedStudents.map((s) => ({
                    userId: Number(s.id),
                    note: auth.note || undefined,
                    expiresAt: toIso(auth.expiresAt) || undefined,
                })),
                sendEmail: true,
            };
            return invitationApi.createBatch(examId, request);
        },
        onSuccess: async (res) => {
            if (res.successfulInvitations?.length) {
                setAuthInvitations((prev) => [...prev, ...res.successfulInvitations!]);
            }
            const success = res.successCount ?? res.successfulInvitations?.length ?? 0;
            const failed = res.failureCount ?? res.errors?.length ?? 0;

            if (failed > 0) {
                toast.warning(`Created ${success}, failed ${failed}.`, {
                    description: res.errors?.slice(0, 3).join(" | "),
                });
            } else {
                toast.success(`Created ${success} invitation(s).`);
            }

            if (reminderType !== "NONE") {
                const req: ReminderRequest = {
                    reminderType: reminderType as ReminderType,
                    scheduledAt: reminderType === "CUSTOM" ? toIso(customReminder) : undefined,
                };
                try {
                    await invitationApi.scheduleReminder(examId, req);
                } catch {
                }
            }

            setSelectedStudents([]);
            setAuth(DEFAULT_AUTH);
            onSuccess?.();
            void queryClient.invalidateQueries({ queryKey: ["exam-invitations", examId] });
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Failed to create invitations."));
        },
    });

    const createAnonMutation = useMutation({
        mutationFn: async () => {
            const request: AnonymousInvitationRequest = {
                maxAccessAttempts: Number(anon.maxAccessAttempts) || 1,
            };
            return invitationApi.createAnonymous(examId, request);
        },
        onSuccess: async (inv) => {
            let qr: string | null = null;
            if (inv.id) {
                try {
                    qr = await invitationApi.getQrDataUrl(inv.id);
                } catch {
                }
            }
            setAnonInvitations((prev) => new Map(prev).set(inv.id!, { inv, qr }));
            toast.success("Share link created!");

            setAnon(DEFAULT_ANON);
            onSuccess?.();
            void queryClient.invalidateQueries({ queryKey: ["exam-invitations", examId] });
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Failed to create share link."));
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
                    <DialogTitle>Create Exam Invitations</DialogTitle>
                    <DialogDescription>{examTitle}</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="account" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="account" className="gap-2">
                            <Users className="size-4" />
                            Registered Account
                        </TabsTrigger>
                        <TabsTrigger value="share" className="gap-2">
                            <Share2 className="size-4" />
                            Shareable Link
                        </TabsTrigger>
                    </TabsList>

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
                                selected={selectedStudents}
                                onChange={(id) => setAuth((f) => ({ ...f, userId: id }))}
                                onSelectionChange={setSelectedStudents}
                            />

                            <div className="space-y-2">
                                <Label>Note (optional)</Label>
                                <Input
                                    placeholder="e.g., Class A, Morning shift..."
                                    value={auth.note}
                                    onChange={(e) =>
                                        setAuth((f) => ({ ...f, note: e.target.value }))
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Confirmation Deadline (optional)</Label>
                                <Input
                                    type="datetime-local"
                                    value={auth.expiresAt}
                                    onChange={(e) =>
                                        setAuth((f) => ({ ...f, expiresAt: e.target.value }))
                                    }
                                />
                            </div>

                            <div className="space-y-3 border-t pt-4">
                                <Label>Email Reminder (optional)</Label>
                                <RadioGroup
                                    value={reminderType}
                                    onValueChange={(v) => setReminderType(v as typeof reminderType)}
                                    className="flex flex-wrap gap-3"
                                >
                                    <Label className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-muted/50">
                                        <RadioGroupItem value="NONE" />
                                        None
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
                                {selectedStudents.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={createBatchMutation.isPending}
                                        onClick={() => createBatchMutation.mutate()}
                                    >
                                        {createBatchMutation.isPending ? (
                                            <>
                                                <RefreshCw className="size-4 animate-spin" />
                                                Creating {selectedStudents.length}...
                                            </>
                                        ) : (
                                            <>
                                                <Users className="size-4" />
                                                Create for {selectedStudents.length} student(s)
                                            </>
                                        )}
                                    </Button>
                                )}
                                <Button
                                    type="submit"
                                    disabled={!canSubmitAuth || createAuthMutation.isPending}
                                >
                                    {createAuthMutation.isPending ? (
                                        <>
                                            <RefreshCw className="size-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="size-4" />
                                            Create & Send
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>

                        {authInvitations.length > 0 && (
                            <div className="border-t pt-4 mt-4">
                                <h4 className="font-medium mb-3">Created Invitations</h4>
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
                                    <p className="font-medium">Share Exam Link</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Generate a public link to share with students — no account is required to take the exam. Students enter their own name and email when opening the link.
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
                                <Label>Maximum Attempts Allowed</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={anon.maxAccessAttempts}
                                    onChange={(e) =>
                                        setAnon((f) => ({ ...f, maxAccessAttempts: e.target.value }))
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    Number of times a student can take the exam using this link
                                </p>
                            </div>

                            <DialogFooter>
                                <Button
                                    type="submit"
                                    disabled={createAnonMutation.isPending}
                                >
                                    {createAnonMutation.isPending ? (
                                        <>
                                            <RefreshCw className="size-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Link2 className="size-4" />
                                            Generate Share Link
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>

                        {anonInvitations.size > 0 && (
                            <div className="border-t pt-4 mt-4">
                                <h4 className="font-medium mb-3">Generated Share Links</h4>
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {Array.from(anonInvitations.entries()).map(([id, { inv, qr }]) => (
                                        <ShareLinkCard
                                            key={id}
                                            invitation={inv}
                                            qrDataUrl={qr}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        <X className="size-4" />
                        Close
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
            toast.success("Access code copied!");
        }
    };

    const copyLink = () => {
        if (shareableUrl) {
            void navigator.clipboard.writeText(shareableUrl);
            toast.success("Link copied!");
        }
    };

    return (
        <div className="rounded-md border p-3 space-y-3">
            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Access Code</p>
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
                <p className="text-xs text-muted-foreground">Shareable Link</p>
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
                    Max Attempts: {invitation.maxAccessAttempts ?? 1}
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
                        Download QR
                    </Button>
                )}
            </div>
        </div>
    );
}
