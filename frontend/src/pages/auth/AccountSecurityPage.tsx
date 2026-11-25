import { authApi } from "@/api/features/auth.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoleSwitch } from "@/contexts/RoleSwitchContext";
import { performAppLogout } from "@/utils/auth-logout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { KeyRound, Laptop, LogOut, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const formatTimestamp = (value?: string | null) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
};

const getApiError = (err: unknown, fallback: string): string => {
    if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message;
        if (typeof msg === "string" && msg.trim()) return msg;
    }
    if (err instanceof Error && err.message) return err.message;
    return fallback;
};

export default function AccountSecurityPage() {
    const queryClient = useQueryClient();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { setViewRole } = useRoleSwitch();

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [revokeOthersOnChange, setRevokeOthersOnChange] = useState(true);
    const [formError, setFormError] = useState("");

    const sessionsQuery = useQuery({
        queryKey: ["auth-active-sessions"],
        queryFn: () => authApi.listSessions(),
    });

    const changePasswordMutation = useMutation({
        mutationFn: () =>
            authApi.changePassword({
                currentPassword,
                newPassword,
                revokeOtherSessions: revokeOthersOnChange,
            }),
        onSuccess: () => {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setFormError("");
            toast.success("Password updated successfully");
            void queryClient.invalidateQueries({ queryKey: ["auth-active-sessions"] });
        },
        onError: (err) => {
            const msg = getApiError(err, "Failed to update password");
            setFormError(msg);
            toast.error(msg);
        },
    });

    const revokeSessionMutation = useMutation({
        mutationFn: async (session: { sessionId: string; current: boolean }) => {
            await authApi.revokeSession(session.sessionId);
            return session;
        },
        onSuccess: (session) => {
            if (session.current) {
                toast.success("Current session revoked");
                void performAppLogout({
                    dispatch,
                    queryClient,
                    navigate,
                    clearViewRole: () => setViewRole(null),
                    skipApi: true,
                });
                return;
            }
            toast.success("Session revoked");
            void queryClient.invalidateQueries({ queryKey: ["auth-active-sessions"] });
        },
        onError: (err) => toast.error(getApiError(err, "Failed to revoke session")),
    });

    const revokeOthersMutation = useMutation({
        mutationFn: () => authApi.revokeOtherSessions(),
        onSuccess: (res) => {
            toast.success(`Signed out ${res.revokedCount} other session(s)`);
            void queryClient.invalidateQueries({ queryKey: ["auth-active-sessions"] });
        },
        onError: (err) => toast.error(getApiError(err, "Failed to revoke other sessions")),
    });

    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");
        if (newPassword.length < 8) {
            setFormError("New password must be at least 8 characters long.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setFormError("Password confirmation does not match.");
            return;
        }
        changePasswordMutation.mutate();
    };

    const sessions = sessionsQuery.data ?? [];
    const otherSessionsCount = sessions.filter((s) => !s.current).length;

    return (
        <MainLayout>
            <div className="mx-auto max-w-5xl space-y-6 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                            <ShieldCheck className="size-6" />
                            Account Security &amp; Sessions
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Change your password and manage active sign-in sessions across devices.
                        </p>
                    </div>
                </div>

                {/* Change Password */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <KeyRound className="size-5" />
                            Change Password
                        </CardTitle>
                        <CardDescription>
                            Use at least 8 characters. Optionally sign out all other devices immediately after updating.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {formError && (
                            <div className="mb-4 rounded-md border border-slate-300 bg-slate-100 p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                                {formError}
                            </div>
                        )}
                        <form onSubmit={handleChangePassword} className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-1.5">
                                <label htmlFor="current-password" className="text-sm font-medium">
                                    Current Password
                                </label>
                                <Input
                                    id="current-password"
                                    type="password"
                                    required
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="new-password" className="text-sm font-medium">
                                    New Password
                                </label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    required
                                    minLength={8}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min. 8 characters"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="confirm-password" className="text-sm font-medium">
                                    Confirm New Password
                                </label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    required
                                    minLength={8}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter new password"
                                />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 md:col-span-3 pt-1">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="revoke-others-pw"
                                        checked={revokeOthersOnChange}
                                        onCheckedChange={(checked) => setRevokeOthersOnChange(checked === true)}
                                    />
                                    <label htmlFor="revoke-others-pw" className="cursor-pointer text-sm text-muted-foreground">
                                        Sign out all other active devices after changing password
                                    </label>
                                </div>
                                <Button type="submit" disabled={changePasswordMutation.isPending}>
                                    {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Active Sessions */}
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Laptop className="size-5" />
                                Active Sessions ({sessions.length})
                            </CardTitle>
                            <CardDescription>
                                Revoking a session immediately invalidates both its refresh cookie and access token.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void sessionsQuery.refetch()}
                                disabled={sessionsQuery.isFetching}
                            >
                                <RefreshCw className="mr-1.5 size-4" />
                                Refresh
                            </Button>
                            <Button
                                type="button"
                                variant="default"
                                size="sm"
                                disabled={otherSessionsCount === 0 || revokeOthersMutation.isPending}
                                onClick={() => revokeOthersMutation.mutate()}
                            >
                                <LogOut className="mr-1.5 size-4" />
                                Sign Out Other Devices ({otherSessionsCount})
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {sessionsQuery.isPending ? (
                            <div className="space-y-3">
                                <Skeleton className="h-14 w-full" />
                                <Skeleton className="h-14 w-full" />
                            </div>
                        ) : sessionsQuery.isError ? (
                            <div className="rounded-md border p-4 text-sm text-muted-foreground">
                                Failed to load active sessions. Please click Refresh to try again.
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                No active sessions found.
                            </div>
                        ) : (
                            <div className="divide-y rounded-md border">
                                {sessions.map((session) => (
                                    <div
                                        key={session.sessionId}
                                        className="flex flex-wrap items-center justify-between gap-4 p-4"
                                    >
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {session.ipAddress || "Unknown IP"}
                                                </span>
                                                {session.current && (
                                                    <Badge className="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                                                        Current Session
                                                    </Badge>
                                                )}
                                                <Badge variant="outline" className="border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300">
                                                    {session.rememberMe ? "Remembered" : "Standard"}
                                                </Badge>
                                            </div>
                                            <p className="truncate text-sm font-medium" title={session.userAgent ?? ""}>
                                                {session.userAgent || "Unknown browser / device"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Started: {formatTimestamp(session.createdAt)} · Last active:{" "}
                                                {formatTimestamp(session.lastUsedAt)} · Expires:{" "}
                                                {formatTimestamp(session.expiresAt)}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={revokeSessionMutation.isPending}
                                            onClick={() =>
                                                revokeSessionMutation.mutate({
                                                    sessionId: session.sessionId,
                                                    current: session.current,
                                                })
                                            }
                                        >
                                            <Trash2 className="mr-1.5 size-4" />
                                            Revoke
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
