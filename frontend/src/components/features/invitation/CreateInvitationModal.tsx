import { invitationApi } from "@/api";
import type {
    AnonymousInvitationRequest,
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
import { useEffect, useState } from "react";
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
            <Label>Student</Label>
            <Input
                placeholder="Type name or email to search..."
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

    // Auth form
    const [auth, setAuth] = useState<AuthForm>(DEFAULT_AUTH);

    // Anon form
    const [anon, setAnon] = useState<AnonForm>(DEFAULT_ANON);

    // Created invitations
    const [authInvitations, setAuthInvitations] = useState<InvitationDTO[]>([]);
    const [anonInvitations, setAnonInvitations] = useState<Map<number, { inv: InvitationDTO; qr: string | null }>>(new Map());

    useEffect(() => {
        if (!open) {
            setAuth(DEFAULT_AUTH);
            setAnon(DEFAULT_ANON);
            setReminderType("NONE");
            setCustomReminder("");
            setAuthInvitations([]);
            setAnonInvitations(new Map());
        }
    }, [open]);

    // Create authenticated invitation
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
                    // ignore
                }
            }

            // Reset form
            setAuth(DEFAULT_AUTH);
            onSuccess?.();
            void queryClient.invalidateQueries({ queryKey: ["exam-invitations", examId] });
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Failed to create invitation."));
        },
    });

    // Create anonymous invitation (share link)
    const createAnonMutation = useMutation({
        mutationFn: async () => {
            const request: AnonymousInvitationRequest = {
                studentName: undefined,
                studentEmail: undefined,
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
                    // ignore
                }
            }
            setAnonInvitations((prev) => new Map(prev).set(inv.id!, { inv, qr }));
            toast.success("Share link created!");

            // Reset form
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

                    {/* TAB 1: Registered Account */}
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

                        {/* List of Created Invitations */}
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

                    {/* TAB 2: Shareable Link */}
                    <TabsContent value="share" className="space-y-4 pt-4">
                        <div className="rounded-md border-2 border-dashed border-primary/30 bg-primary/5 p-4">
                            <div className="flex items-start gap-3">
                                <Share2 className="size-5 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium">Share Exam Link</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Generate a public link to share with students — no account is required to take the exam.
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

                        {/* List of Created Share Links */}
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
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const shareableUrl = invitation.accessCode
        ? `${API_BASE}/anonymous-exam?code=${invitation.accessCode}`
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
            {/* Access Code */}
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

            {/* Shareable Link */}
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

            {/* QR Code */}
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