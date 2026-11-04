import { Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "../ui/form";
import { Input } from "../ui/input";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { ResetPasswordData } from "@/types";
import { Button } from "../ui/button";
import { useState } from "react";
import { validatePasswordStrength } from "@/utils/password.utils";

const resetSchema = z
    .object({
        password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự.").superRefine((value, ctx) => {
            if (value.length < 8) return;
            const problem = validatePasswordStrength(value);
            if (problem) {
                const message =
                    problem === "Password must be 8-64 characters."
                        ? "Mật khẩu không được vượt quá 64 ký tự."
                        : problem === "Password must not contain spaces."
                          ? "Mật khẩu không được chứa khoảng trắng."
                          : problem === "Password must contain at least one letter and one number."
                            ? "Mật khẩu phải có ít nhất một chữ cái và một chữ số."
                            : "Mật khẩu quá phổ biến. Vui lòng chọn mật khẩu khác.";
                ctx.addIssue({ code: "custom", message });
            }
        }),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Mật khẩu xác nhận không khớp.",
        path: ["confirmPassword"],
    });

interface ResetPasswordFormProps {
    onSubmit: (data: ResetPasswordData) => Promise<void>;
    loading: boolean;
}

export const ResetPasswordForm = ({ onSubmit, loading }: ResetPasswordFormProps) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const form = useForm<ResetPasswordData>({
        resolver: zodResolver(resetSchema),
        mode: "onChange", // show problems while typing, not only on submit
        defaultValues: { password: "", confirmPassword: "" },
    });

    return (
        <div className="space-y-7 p-8 sm:p-10">
            <div className="space-y-3 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Đặt lại mật khẩu</h1>
                <p className="text-sm text-slate-600">Mật khẩu cần có ít nhất 8 ký tự.</p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-slate-900">
                                    Mật khẩu mới
                                </label>
                                <div className="relative">
                                    <FormControl>
                                        <Input
                                            {...field}
                                            id="new-password"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            placeholder="Nhập mật khẩu mới"
                                            className="h-11 rounded-lg border-slate-300 bg-white pr-12 focus-visible:border-orange-600 focus-visible:ring-orange-500"
                                        />
                                    </FormControl>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={showPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                                        aria-pressed={showPassword}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:bg-slate-100"
                                        type="button"
                                        onClick={() => setShowPassword((visible) => !visible)}
                                    >
                                        {showPassword ? (
                                            <EyeOff aria-hidden="true" />
                                        ) : (
                                            <Eye aria-hidden="true" />
                                        )}
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                            <FormItem>
                                <label
                                    htmlFor="confirm-new-password"
                                    className="mb-2 block text-sm font-medium text-slate-900"
                                >
                                    Xác nhận mật khẩu mới
                                </label>
                                <div className="relative">
                                    <FormControl>
                                        <Input
                                            {...field}
                                            id="confirm-new-password"
                                            type={showConfirmPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            placeholder="Nhập lại mật khẩu mới"
                                            className="h-11 rounded-lg border-slate-300 bg-white pr-12 focus-visible:border-orange-600 focus-visible:ring-orange-500"
                                        />
                                    </FormControl>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={
                                            showConfirmPassword
                                                ? "Ẩn mật khẩu xác nhận"
                                                : "Hiện mật khẩu xác nhận"
                                        }
                                        aria-pressed={showConfirmPassword}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:bg-slate-100"
                                        type="button"
                                        onClick={() => setShowConfirmPassword((visible) => !visible)}
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff aria-hidden="true" />
                                        ) : (
                                            <Eye aria-hidden="true" />
                                        )}
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        disabled={loading}
                        className="h-11 w-full rounded-lg bg-orange-600 font-semibold text-white hover:bg-orange-700"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" aria-hidden="true" />
                                Đang cập nhật...
                            </>
                        ) : (
                            <>
                                Xác nhận đổi mật khẩu
                                <CheckCircle2 className="ml-2" size={18} aria-hidden="true" />
                            </>
                        )}
                    </Button>
                </form>
            </Form>
        </div>
    );
};
