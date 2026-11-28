import { useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    AlertTriangle,
    Ban,
    CalendarPlus,
    CheckCircle2,
    ShieldAlert,
    ShieldCheck,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    securityAlertApi,
    type BlockedUserDTO,
    type SecurityAlertDTO,
    type SecurityAlertStatus,
} from "@/api/features/audit/security-alert.api";

type DialogState =
    | {
          mode: "block" | "extend";
          userId: number;
          label: string;
          currentUntil: string | null;
      }
    | null;

const PRESET_DAYS = [1, 3, 7, 30];

const TYPE_LABEL: Record<string, string> = {
    RATE_LIMIT: "Request spam (F5)",
    REPEATED_DENIED: "Repeated unauthorized access",
};

const STATUS_STYLE: Record<SecurityAlertStatus, string> = {
    OPEN: "bg-red-500/10 text-red-600 dark:text-red-400",
    BLOCKED: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    DISMISSED: "bg-muted text-muted-foreground",
};

function formatDateTime(value: string | null) {
    if (!value) return "—";
    return new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function errorMessage(error: unknown) {
    const data = (error as { response?: { data?: { message?: string } } })
        ?.response?.data;
    return data?.message ?? "Something went wrong. Please try again.";
}

export function AuditSecurityPanel() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<
        SecurityAlertStatus | "ALL"
    >("OPEN");
    const [dialog, setDialog] = useState<DialogState>(null);

    const alertsQuery = useQuery({
        queryKey: ["security-alerts", statusFilter],
        queryFn: () =>
            securityAlertApi.getAlerts(
                statusFilter === "ALL" ? undefined : statusFilter,
                0,
                50,
            ),
        refetchInterval: 15_000,
    });

    const blockedQuery = useQuery({
        queryKey: ["security-blocked-users"],
        queryFn: securityAlertApi.getBlockedUsers,
        refetchInterval: 30_000,
    });

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["security-alerts"] });
        void queryClient.invalidateQueries({
            queryKey: ["security-open-count"],
        });
        void queryClient.invalidateQueries({
            queryKey: ["security-blocked-users"],
        });
        void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    };

    const dismissMutation = useMutation({
        mutationFn: securityAlertApi.dismiss,
        onSuccess: refresh,
    });

    const unblockMutation = useMutation({
        mutationFn: securityAlertApi.unblockUser,
        onSuccess: refresh,
    });

    const alerts = alertsQuery.data?.content ?? [];
    const blocked = blockedQuery.data ?? [];

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
                    <div>
                        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                            Security alerts
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Raised automatically on request spam or repeated
                            unauthorized access. Admins are notified and decide
                            whether to block.
                        </p>
                    </div>

                    <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
                        {(["OPEN", "BLOCKED", "DISMISSED", "ALL"] as const).map(
                            (item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setStatusFilter(item)}
                                    className={`rounded-md px-2.5 py-1 font-medium capitalize transition ${
                                        statusFilter === item
                                            ? "bg-indigo-600 text-white"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {item.toLowerCase()}
                                </button>
                            ),
                        )}
                    </div>
                </div>

                {alertsQuery.isLoading ? (
                    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                        Loading alerts…
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-muted-foreground">
                        <ShieldCheck className="h-6 w-6 text-emerald-500" />
                        No {statusFilter === "ALL" ? "" : statusFilter.toLowerCase()}{" "}
                        security alerts.
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {alerts.map((alert) => (
                            <AlertRow
                                key={alert.id}
                                alert={alert}
                                busy={dismissMutation.isPending}
                                onDismiss={() =>
                                    dismissMutation.mutate(alert.id)
                                }
                                onBlock={() =>
                                    alert.userId &&
                                    setDialog({
                                        mode: alert.blockedUntil
                                            ? "extend"
                                            : "block",
                                        userId: alert.userId,
                                        label: alert.userEmail ?? "",
                                        currentUntil: alert.blockedUntil,
                                    })
                                }
                            />
                        ))}
                    </ul>
                )}
            </section>

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-4 py-3 md:px-5">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <Ban className="h-4 w-4 text-amber-500" />
                        Blocked users
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/70">
                            {blocked.length}
                        </span>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Blocked accounts are unlocked automatically at the end
                        date. You can also unblock or extend them at any time.
                    </p>
                </div>

                {blocked.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                        No user is blocked right now.
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {blocked.map((user) => (
                            <BlockedRow
                                key={user.userId}
                                user={user}
                                busy={unblockMutation.isPending}
                                onUnblock={() =>
                                    unblockMutation.mutate(user.userId)
                                }
                                onExtend={() =>
                                    setDialog({
                                        mode: "extend",
                                        userId: user.userId,
                                        label: user.email,
                                        currentUntil: user.blockedUntil,
                                    })
                                }
                            />
                        ))}
                    </ul>
                )}

                {unblockMutation.isError && (
                    <p className="border-t border-border px-5 py-2 text-xs text-red-600">
                        {errorMessage(unblockMutation.error)}
                    </p>
                )}
            </section>

            {dialog && (
                <BlockDialog
                    state={dialog}
                    onClose={() => setDialog(null)}
                    onDone={() => {
                        setDialog(null);
                        refresh();
                    }}
                />
            )}
        </div>
    );
}

function AlertRow({
    alert,
    busy,
    onDismiss,
    onBlock,
}: {
    alert: SecurityAlertDTO;
    busy: boolean;
    onDismiss: () => void;
    onBlock: () => void;
}) {
    const isOpen = alert.status === "OPEN";

    return (
        <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-5">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-semibold text-foreground">
                        {TYPE_LABEL[alert.type] ?? alert.type}
                    </span>
                    <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[alert.status]}`}
                    >
                        {alert.status}
                    </span>
                    {alert.hits > 1 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/70">
                            repeated {alert.hits}×
                        </span>
                    )}
                </div>

                <p className="text-sm text-foreground/80">
                    <span className="font-medium">
                        {alert.userEmail ?? "Not signed in"}
                    </span>
                    {alert.ipAddress && (
                        <span className="text-muted-foreground">
                            {" "}
                            · IP {alert.ipAddress}
                        </span>
                    )}
                </p>

                <p className="text-xs text-muted-foreground">
                    {alert.requestCount}{" "}
                    {alert.type === "RATE_LIMIT" ? "requests" : "denied calls"}{" "}
                    in {alert.windowSeconds}s
                    {alert.lastPath ? ` · last path ${alert.lastPath}` : ""} ·
                    first seen {formatDateTime(alert.createdAt)} · last seen{" "}
                    {formatDateTime(alert.lastSeenAt)}
                </p>

                {alert.blockedUntil && (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        Blocked until {formatDateTime(alert.blockedUntil)}
                    </p>
                )}
                {!isOpen && alert.resolvedBy && (
                    <p className="text-xs text-muted-foreground">
                        Handled by {alert.resolvedBy} on{" "}
                        {formatDateTime(alert.resolvedAt)}
                    </p>
                )}
                {!alert.userId && (
                    <p className="text-xs text-muted-foreground">
                        No account is linked to this alert (IP only), so it
                        cannot be blocked from here.
                    </p>
                )}
            </div>

            <div className="flex shrink-0 gap-2">
                {alert.userId && (
                    <button
                        type="button"
                        onClick={onBlock}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700"
                    >
                        <Ban className="h-3.5 w-3.5" />
                        {alert.blockedUntil ? "Extend block" : "Block user"}
                    </button>
                )}
                {isOpen && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onDismiss}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted disabled:opacity-50"
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Dismiss
                    </button>
                )}
            </div>
        </li>
    );
}

function BlockedRow({
    user,
    busy,
    onUnblock,
    onExtend,
}: {
    user: BlockedUserDTO;
    busy: boolean;
    onUnblock: () => void;
    onExtend: () => void;
}) {
    return (
        <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
            <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                    {user.fullName ? `${user.fullName} · ` : ""}
                    {user.email}
                </p>
                <p className="text-xs text-muted-foreground">
                    Blocked until {formatDateTime(user.blockedUntil)}
                    {user.reason ? ` · ${user.reason}` : ""}
                </p>
            </div>

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={onExtend}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted"
                >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Add days
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={onUnblock}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Unblock
                </button>
            </div>
        </li>
    );
}

function BlockDialog({
    state,
    onClose,
    onDone,
}: {
    state: NonNullable<DialogState>;
    onClose: () => void;
    onDone: () => void;
}) {
    const [days, setDays] = useState(1);
    const [reason, setReason] = useState("");
    const isExtend = state.mode === "extend";

    const mutation = useMutation({
        mutationFn: () => {
            const payload = { days, reason: reason.trim() || undefined };
            return isExtend
                ? securityAlertApi.extendBlock(state.userId, payload)
                : securityAlertApi.blockUser(state.userId, payload);
        },
        onSuccess: onDone,
    });

    const validDays = Number.isInteger(days) && days >= 1 && days <= 365;

    return (
        <Dialog open onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isExtend ? "Add more blocked days" : "Block user"}
                    </DialogTitle>
                    <DialogDescription>
                        {state.label}
                        {isExtend && state.currentUntil
                            ? ` is blocked until ${formatDateTime(state.currentUntil)}. The days below are added on top.`
                            : " will not be able to use the system. The account unlocks automatically at 00:00 after the last blocked day."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                            {isExtend ? "Add" : "Block for"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            {PRESET_DAYS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setDays(preset)}
                                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                                        days === preset
                                            ? "border-indigo-600 bg-indigo-600 text-white"
                                            : "border-border text-foreground/80 hover:bg-muted"
                                    }`}
                                >
                                    {preset} {preset === 1 ? "day" : "days"}
                                </button>
                            ))}
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={days}
                                onChange={(event) =>
                                    setDays(Number(event.target.value))
                                }
                                aria-label="Number of days"
                                className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            htmlFor="block-reason"
                            className="mb-1 block text-xs font-medium text-muted-foreground"
                        >
                            Reason (optional)
                        </label>
                        <textarea
                            id="block-reason"
                            rows={3}
                            maxLength={500}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="e.g. 300 requests in 10 seconds"
                        />
                    </div>

                    {mutation.isError && (
                        <p className="text-xs text-red-600">
                            {errorMessage(mutation.error)}
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground/80 hover:bg-muted"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={!validDays || mutation.isPending}
                            onClick={() => mutation.mutate()}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                            {mutation.isPending
                                ? "Saving…"
                                : isExtend
                                  ? "Extend block"
                                  : "Block user"}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
