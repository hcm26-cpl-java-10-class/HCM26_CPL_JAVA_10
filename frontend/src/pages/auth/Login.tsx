import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "motion/react";
import { FcGoogle } from "react-icons/fc";
import { useDispatch } from "react-redux";
import { setLogin } from "@/store/slices/auth/authSlice";
import { authApi } from "@/api/features/auth.api";
import axios from "axios";
import { Eye, EyeOff, GraduationCap, LoaderCircle } from "lucide-react";
import { getHomePathByRole } from "@/utils/rbac.utils";

const URL_LOGIN_WITH_GOOGLE =
    import.meta.env.VITE_API_URL_FOR_GOOGLE || "http://localhost:8080/oauth2/authorization/google";

const LOGIN_ERROR_MESSAGE = "Không thể đăng nhập. Vui lòng kiểm tra thông tin và thử lại.";

const getOAuthErrorMessage = (errorParam: string | null): string => {
    switch (errorParam) {
        case "google_auth_failed":
            return "Đăng nhập bằng Google không thành công. Vui lòng thử lại.";
        case "google_token_missing":
            return "Không nhận được thông tin xác thực từ Google.";
        case "google_token_invalid":
            return "Thông tin xác thực từ Google không hợp lệ.";
        case "true":
            return "Không thể hoàn tất đăng nhập. Vui lòng thử lại.";
        default:
            return "";
    }
};

export const Login: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isRememberedMe, setIsRememberedMe] = useState<boolean>(false);
    const [error, setError] = useState("");
    const [identifierError, setIdentifierError] = useState("");
    const [passwordError, setPasswordError] = useState("");
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

    const validateFields = () => {
        const nextIdentifierError = email.trim() ? "" : "Vui lòng nhập username hoặc email.";
        const nextPasswordError = password.trim() ? "" : "Vui lòng nhập mật khẩu.";
        setIdentifierError(nextIdentifierError);
        setPasswordError(nextPasswordError);
        return !nextIdentifierError && !nextPasswordError;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!validateFields()) return;

        setIsLoading(true);
        try {
            const res = await authApi.login({
                email: email.trim(),
                password: password.trim(),
                isRememberedMe,
            });
            dispatch(setLogin(res));
            navigate(getHomePathByRole(res.role), { replace: true });
        } catch (err) {
            if (!axios.isAxiosError(err) && !(err instanceof Error)) {
                console.error("Unexpected login error", err);
            }
            setError(LOGIN_ERROR_MESSAGE);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        setIsLoading(true);
        setError("");
        window.location.href = URL_LOGIN_WITH_GOOGLE;
    };

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />

            <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl shadow-indigo-950/10 lg:min-h-[640px] lg:grid-cols-[1fr_0.9fr]"
            >
                <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-900 to-blue-800 p-10 text-white lg:flex xl:p-14">
                    <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full border border-white/10" />
                    <div className="pointer-events-none absolute -right-12 top-32 h-48 w-48 rounded-full border border-white/10" />
                    <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-blue-400/10 blur-2xl" />

                    <div className="relative flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                            <GraduationCap className="h-7 w-7" aria-hidden="true" />
                        </div>
                        <div>
                            <p className="text-lg font-bold tracking-wide">TOMS Academy</p>
                            <p className="text-xs text-indigo-200">Learning management system</p>
                        </div>
                    </div>

                    <div className="relative max-w-md">
                        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">
                            Chào mừng trở lại
                        </p>
                        <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
                            Học tập và phát triển cùng TOMS.
                        </h1>
                        <p className="mt-6 text-base leading-7 text-indigo-100/80">
                            Đăng nhập để tiếp tục hành trình học tập, giảng dạy và kết nối với cộng đồng của bạn.
                        </p>
                        <div className="mt-10 flex items-center gap-3 text-sm text-indigo-100/80">
                            <span className="h-px w-10 bg-indigo-300/60" />
                            Một nền tảng, nhiều cơ hội
                        </div>
                    </div>

                    <p className="relative text-xs text-indigo-200/70">© TOMS Academy</p>
                </section>

                <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12">
                    <div className="w-full max-w-md">
                        <div className="mb-8 text-center lg:text-left">
                            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
                                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                                    <GraduationCap className="h-6 w-6" aria-hidden="true" />
                                </span>
                                <span className="text-lg font-bold text-indigo-950">TOMS Academy</span>
                            </div>
                            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
                                Tài khoản của bạn
                            </p>
                            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Đăng nhập</h2>
                            <p className="mt-2 text-sm text-slate-500">
                                Nhập thông tin để truy cập vào tài khoản TOMS Academy.
                            </p>
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                            >
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} noValidate className="space-y-5">
                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-semibold text-slate-700">
                                    Username hoặc Email
                                </label>
                                <Input
                                    type="text"
                                    id="email"
                                    autoComplete="username"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (identifierError) setIdentifierError("");
                                        if (error) setError("");
                                    }}
                                    onBlur={() =>
                                        setIdentifierError(email.trim() ? "" : "Vui lòng nhập username hoặc email.")
                                    }
                                    aria-invalid={Boolean(identifierError)}
                                    aria-describedby={identifierError ? "identifier-error" : undefined}
                                    disabled={isLoading}
                                    placeholder="Nhập username hoặc email"
                                    className="h-12 rounded-xl border-slate-200 bg-white px-4 placeholder:text-slate-400 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
                                />
                                {identifierError && (
                                    <p id="identifier-error" className="text-sm text-red-600">
                                        {identifierError}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                                    Mật khẩu
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            if (passwordError) setPasswordError("");
                                            if (error) setError("");
                                        }}
                                        onBlur={() =>
                                            setPasswordError(password.trim() ? "" : "Vui lòng nhập mật khẩu.")
                                        }
                                        aria-invalid={Boolean(passwordError)}
                                        aria-describedby={passwordError ? "password-error" : undefined}
                                        disabled={isLoading}
                                        placeholder="Nhập mật khẩu"
                                        className="h-12 rounded-xl border-slate-200 bg-white px-4 pr-12 placeholder:text-slate-400 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        disabled={isLoading}
                                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                                        aria-pressed={showPassword}
                                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition-colors hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 disabled:cursor-not-allowed"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5" aria-hidden="true" />
                                        ) : (
                                            <Eye className="h-5 w-5" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                                {passwordError && (
                                    <p id="password-error" className="text-sm text-red-600">
                                        {passwordError}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <label htmlFor="remember" className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                                    <Checkbox
                                        id="remember"
                                        checked={isRememberedMe}
                                        disabled={isLoading}
                                        onCheckedChange={(checked) => setIsRememberedMe(checked === true)}
                                    />
                                    Ghi nhớ đăng nhập
                                </label>
                                <button
                                    type="button"
                                    onClick={() => navigate("/forgot-password")}
                                    className="text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-800"
                                >
                                    Quên mật khẩu?
                                </button>
                            </div>

                            <Button
                                type="submit"
                                className="h-12 w-full rounded-xl bg-indigo-600 text-base font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                                        Đang đăng nhập...
                                    </>
                                ) : (
                                    "Đăng nhập"
                                )}
                            </Button>
                        </form>

                        <div className="my-6 flex items-center gap-4">
                            <span className="h-px flex-1 bg-slate-200" />
                            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Hoặc</span>
                            <span className="h-px flex-1 bg-slate-200" />
                        </div>

                        <Button
                            type="button"
                            disabled={isLoading}
                            onClick={handleGoogleLogin}
                            variant="outline"
                            className="h-12 w-full rounded-xl border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <FcGoogle className="h-5 w-5" aria-hidden="true" />
                            Đăng nhập bằng Google
                        </Button>

                        <p className="mt-7 text-center text-sm text-slate-500">
                            Chưa có tài khoản?{" "}
                            <button
                                type="button"
                                onClick={() => navigate("/register")}
                                className="font-semibold text-indigo-600 transition-colors hover:text-indigo-800"
                            >
                                Đăng ký ngay
                            </button>
                        </p>
                    </div>
                </section>
            </motion.div>
        </main>
    );
};
