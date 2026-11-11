import { Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "../ui/form";
import { Input } from "../ui/input";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { ResetPasswordData } from "@/types";
import { Button } from "../ui/button";
import { useState } from "react";

const resetSchema = z
    .object({
        password: z.string().min(6, "Password must be at least 6 characters"),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

interface ResetPasswordFormProps {
    onSubmit: (data: ResetPasswordData) => void;
    loading: boolean;
}

export const ResetPasswordForm = ({ onSubmit, loading }: ResetPasswordFormProps) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const form = useForm<ResetPasswordData>({
        resolver: zodResolver(resetSchema),
        defaultValues: { password: "", confirmPassword: "" },
    });

    return (
        <div className="p-10 space-y-7">
            <div className="text-center space-y-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">New Password</h1>
                <p className="text-lg text-gray-500">Please enter your new secure password</p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <div className="relative">
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Password"
                                            className="h-14 text-lg rounded-2xl"
                                        />
                                    </FormControl>
                                    <button
                                        className="absolute right-3 top-4"
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <Eye size={22}></Eye> : <EyeOff size={22}></EyeOff>}
                                    </button>
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
                                <div className="relative">
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type={showConfirmPassword ? "text" : "password"}
                                            placeholder="Confirm Password"
                                            className="h-14 text-lg rounded-2xl"
                                        />
                                    </FormControl>
                                    <button
                                        className="absolute right-3 top-4"
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? <Eye size={22}></Eye> : <EyeOff size={22}></EyeOff>}
                                    </button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-13 text-xl font-bold rounded-2xl bg-green-600 hover:bg-green-700"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <>
                                Update Password <CheckCircle2 className="ml-2" size={22} />
                            </>
                        )}
                    </Button>
                </form>
            </Form>
        </div>
    );
};
