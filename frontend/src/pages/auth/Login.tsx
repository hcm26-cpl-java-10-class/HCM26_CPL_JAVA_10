import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "motion/react";
import { useDispatch } from "react-redux";
import { setLogin } from "@/store/slices/auth/authSlice";
import { authApi, PasswordChangeRequiredError } from "@/api/features/auth.api";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import { getHomePathByRole } from "@/utils/rbac.utils";

const getOAuthErrorMessage = (errorParam: string | null): string => {
    switch (errorParam) {
        case "google_auth_failed":
            return "Đăng nhập Google thất bại. Vui lòng thử lại.";
        case "google_not_registered":
            return "Tài khoản Google này chưa được đăng ký. Vui lòng liên hệ quản trị viên.";
        case "google_email_unverified":
            return "Email Google của bạn chưa được xác minh.";
        case "google_domain_not_allowed":
            return "Tên miền email này không được phép đăng nhập.";
        case "google_account_disabled":
            return "Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.";
        case "google_account_locked":
            return "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.";
        case "google_token_missing":
            return "Không nhận được mã truy cập khi đăng nhập.";
        case "google_token_invalid":
            return "Mã truy cập đăng nhập không hợp lệ.";
        case "true":
            return "Không thể hoàn tất đăng nhập. Vui lòng thử lại.";
        default:
            return "";
    }
};

export const Login: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isRememberedMe, setIsRememberedMe] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch();

    useEffect(() => {
        const oauthErrorMessage = getOAuthErrorMessage(searchParams.get("error"));
        if (oauthErrorMessage) {
            setError(oauthErrorMessage);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        const cleanEmail = email.trim();
        const cleanPassword = password.trim();
        try {
            const res = await authApi.login({ email: cleanEmail, password: cleanPassword, isRememberedMe });
            dispatch(setLogin(res));
            navigate(getHomePathByRole(res.role), { replace: true });
        } catch (err) {
            if (err instanceof PasswordChangeRequiredError) {
                navigate(`/forgot-password?token=${encodeURIComponent(err.setupToken)}&first=1`, { replace: true });
                return;
            }
            if (axios.isAxiosError(err)) {
                const backendMsg = err.response?.data?.message;
                setError(
                    err.response?.status === 401
                        ? "Email hoặc mật khẩu không chính xác."
                        : typeof backendMsg === "string"
                          ? backendMsg
                          : "Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.",
                );
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="grid min-h-screen bg-white md:grid-cols-2">
            <section className="flex min-h-[260px] flex-col justify-between bg-[#0F172A] px-8 py-10 text-white sm:px-12 md:min-h-screen md:px-16 md:py-14">
                <div className="text-3xl font-extrabold tracking-[0.16em] text-[#EA580C]">FAMS</div>
                <div className="max-w-lg py-8 md:py-0">
                    <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Future Academy
                    </p>
                    <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                        Future Academy Management System
                    </h1>
                </div>
                <p className="text-sm text-slate-400">© {new Date().getFullYear()} FAMS</p>
            </section>

            <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-10 md:min-h-screen">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="w-full max-w-md"
                >
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Đăng nhập</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Đăng nhập bằng tài khoản FAMS của bạn.
                        </p>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            aria-live="polite"
                            className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                        >
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-slate-900">
                                Email công ty
                            </label>
                            <Input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="username"
                                placeholder="trainer@fams.edu.vn"
                                className="h-11 border-slate-300 bg-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-slate-900">
                                Mật khẩu
                            </label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    placeholder="Nhập mật khẩu"
                                    className="h-11 border-slate-300 bg-white pr-12"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                                    aria-pressed={showPassword}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:bg-slate-100"
                                >
                                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="remember"
                                    checked={isRememberedMe}
                                    onCheckedChange={(checked) => setIsRememberedMe(checked === true)}
                                />
                                <label htmlFor="remember" className="cursor-pointer text-sm text-slate-700">
                                    Ghi nhớ đăng nhập
                                </label>
                            </div>
                            <Link
                                to="/forgot-password"
                                className="text-sm font-medium text-[#EA580C] hover:text-[#C2410C] hover:underline"
                            >
                                Quên mật khẩu?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="h-11 w-full bg-[#EA580C] text-white hover:bg-[#C2410C]"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Đang đăng nhập...
                                </span>
                            ) : (
                                "Đăng nhập"
                            )}
                        </Button>
                    </form>
                </motion.div>
            </section>
        </main>
    );
};
