import { authApi } from "@/api/features/auth.api";
import { ForgotEmailForm } from "@/components/auth/ForgotEmailForm";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import type { ForgotPasswordEmailRequest, ResetPasswordData } from "@/types/features/auth";
import { useEffect, useState } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const navigator = useNavigate();
    const [loading, setLoading] = useState(false);
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    const firstSignIn = searchParams.get("first") === "1";

    useEffect(() => {
        if (cooldownSeconds === 0) {
            return;
        }

        const timer = window.setTimeout(() => {
            setCooldownSeconds((seconds) => Math.max(0, seconds - 1));
        }, 1000);

        return () => window.clearTimeout(timer);
    }, [cooldownSeconds]);

    useEffect(() => {
        if (token && firstSignIn) {
            toast.info("This is your first sign-in. Please create your own password to continue.");
        }
    }, [token, firstSignIn]);

    const onForgotPasswordSubmit = async (data: ForgotPasswordEmailRequest) => {
        setLoading(true);
        try {
            await authApi.forgotPassword(data);
            setCooldownSeconds(60);
            toast.success("Reset link sent to your email!");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Send email failed");
        } finally {
            setLoading(false);
        }
    };

    const onResetPasswordSubmit = async (data: ResetPasswordData) => {
        if (!token) {
            toast.error("Invalid password reset link.");
            return;
        }

        setLoading(true);
        try {
            await authApi.resetPassword({
                token,
                newPassword: data.password,
            });
            toast.success(firstSignIn ? "Password created. You can sign in now." : "Password reset successful!");
            navigator("/login");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Password reset failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg">
                {!token ? (
                    <ForgotEmailForm
                        onSubmit={onForgotPasswordSubmit}
                        loading={loading}
                        cooldownSeconds={cooldownSeconds}
                    />
                ) : (
                    <ResetPasswordForm onSubmit={onResetPasswordSubmit} loading={loading} />
                )}
            </div>
        </div>
    );
}
