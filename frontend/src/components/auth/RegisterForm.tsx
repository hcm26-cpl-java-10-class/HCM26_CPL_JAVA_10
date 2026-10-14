import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, ArrowRight, Mail, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import type { RegisterRequest } from "@/types";
import { useState } from "react";

const registerSchema = z
    .object({
        firstName: z.string().min(1, "Required"),
        lastName: z.string().min(1, "Required"),
        email: z.string().email("Invalid email format"),
        password: z.string().min(6, "Min 6 characters"),
        confirmPassword: z.string().min(6, "Min 6 characters"),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

interface RegisterFormProps {
    onSubmit: (data: RegisterRequest) => void;
    loading: boolean;
}

export function RegisterForm({ onSubmit, loading }: RegisterFormProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const form = useForm<RegisterRequest>({
        resolver: zodResolver(registerSchema),
        mode: "onChange",
        defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-10 space-y-7">
                <div className="text-center space-y-3">
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Create Account</h1>
                    <p className="text-lg text-gray-500">Join our RBAC system today</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input {...field} placeholder="First Name" className="h-14 text-lg rounded-2xl" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input {...field} placeholder="Last Name" className="h-14 text-lg rounded-2xl" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={22} />
                                <FormControl>
                                    <Input
                                        {...field}
                                        type="email"
                                        placeholder="Email Address"
                                        className="pl-12 h-14 text-lg rounded-2xl"
                                    />
                                </FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

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
                    className="w-full h-13 text-xl font-bold rounded-2xl shadow-lg"
                >
                    {loading ? (
                        <Loader2 className="animate-spin" />
                    ) : (
                        <>
                            Get Started <ArrowRight className="ml-2" size={22} />
                        </>
                    )}
                </Button>
            </form>
        </Form>
    );
}
